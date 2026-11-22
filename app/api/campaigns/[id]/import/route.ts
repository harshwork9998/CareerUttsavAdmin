import { NextResponse } from "next/server";

import { requireSuperuser } from "@/lib/server/admin-auth";
import { importCampaignContacts } from "@/lib/server/whatsapp/campaign-service";
import { parseContactUploadBuffer } from "@/lib/server/whatsapp/campaign-spreadsheet";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireSuperuser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const formData = await request.formData();
  const file = formData.get("file");
  const mobileColumn = String(formData.get("mobileColumn") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a contact file." }, { status: 400 });
  }

  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "The file is too large." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseContactUploadBuffer({
      fileName: file.name,
      buffer,
    });

  const column = mobileColumn || parsed.detectedMobileColumn;
  if (!column) {
    return NextResponse.json(
      { error: "Choose which column contains mobile numbers." },
      { status: 400 }
    );
  }

    const summary = await importCampaignContacts({
      campaignId: id,
      headers: parsed.headers,
      rows: parsed.rows,
      mobileColumn: column,
    });

    return NextResponse.json({
      ...summary,
      headers: parsed.headers,
      detectedMobileColumn: parsed.detectedMobileColumn,
      mobileColumn: column,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "This file could not be read.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}