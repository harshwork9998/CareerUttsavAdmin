import { NextResponse } from "next/server";

import { requireSuperuser } from "@/lib/server/admin-auth";
import { validateCampaignPdfBuffer } from "@/lib/server/whatsapp/campaign-header-document";
import { updateCampaignDraft } from "@/lib/server/whatsapp/campaign-store";
import { assessTemplateCapability } from "@/lib/server/whatsapp/campaign-template-capability";
import type { CampaignVariableMapping } from "@/lib/server/whatsapp/campaign-variable-mapping";
import { isWhatsAppCampaignDryRun } from "@/lib/server/whatsapp/campaign-dry-run";
import { uploadWhatsAppMedia } from "@/lib/server/whatsapp/meta-client";
import type { MetaMessageTemplate } from "@/lib/server/whatsapp/meta-templates";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireSuperuser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;

  const campaign = await prisma.whatsAppCampaign.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      deletedAt: true,
      templateSnapshot: true,
      variableMapping: true,
    },
  });

  if (!campaign || campaign.deletedAt) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }
  if (campaign.status !== "DRAFT") {
    return NextResponse.json(
      { error: "This campaign cannot accept a new PDF." },
      { status: 400 }
    );
  }

  let snapshot = campaign.templateSnapshot as MetaMessageTemplate | null;

  const formData = await request.formData();
  const file = formData.get("file");
  const mediaIdRaw = String(formData.get("mediaId") ?? "").trim();
  const templateJson = formData.get("template");

  if (!snapshot && templateJson) {
    try {
      const parsed = JSON.parse(String(templateJson)) as MetaMessageTemplate;
      if (parsed?.name && parsed?.language) {
        snapshot = parsed;
        await updateCampaignDraft(id, {
          templateName: parsed.name,
          templateLanguage: parsed.language,
          templateSnapshot: parsed,
        });
      }
    } catch {
      return NextResponse.json({ error: "Invalid template data." }, { status: 400 });
    }
  }

  if (!snapshot) {
    return NextResponse.json(
      { error: "Choose a template before attaching a PDF." },
      { status: 400 }
    );
  }

  const capability = assessTemplateCapability(snapshot);
  if (!capability.requiresHeaderDocument) {
    return NextResponse.json(
      { error: "This template does not need a PDF attachment." },
      { status: 400 }
    );
  }

  const existing =
    (campaign.variableMapping as CampaignVariableMapping | null) ?? {};

  if (mediaIdRaw) {
    if (!/^[a-zA-Z0-9._-]+$/.test(mediaIdRaw)) {
      return NextResponse.json(
        { error: "Enter a valid Meta media ID." },
        { status: 400 }
      );
    }
    await updateCampaignDraft(id, {
      variableMapping: {
        ...existing,
        headerDocumentMediaId: mediaIdRaw,
        headerDocumentFilename: String(formData.get("filename") ?? "").trim() || undefined,
      },
    });
    return NextResponse.json({ ok: true, mediaId: mediaIdRaw, dryRunStorageOnly: true });
  }

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Upload a PDF file or paste a Meta media ID." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const validationError = validateCampaignPdfBuffer(buffer, file.name);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  let mediaId: string;
  if (isWhatsAppCampaignDryRun()) {
    mediaId = `dry_run_doc_${id}`;
  } else {
    const upload = await uploadWhatsAppMedia({
      mimeType: "application/pdf",
      filename: file.name,
      contentBase64: buffer.toString("base64"),
    });

    if (!upload.success) {
      return NextResponse.json(
        { error: "The PDF could not be uploaded to WhatsApp. Try again later." },
        { status: 502 }
      );
    }
    mediaId = upload.mediaId;
  }

  await updateCampaignDraft(id, {
    variableMapping: {
      ...existing,
      headerDocumentMediaId: mediaId,
      headerDocumentFilename: file.name,
    },
  });

  return NextResponse.json({
    ok: true,
    mediaId,
    dryRun: isWhatsAppCampaignDryRun(),
  });
}