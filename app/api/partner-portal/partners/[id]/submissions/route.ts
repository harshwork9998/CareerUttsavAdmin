import { NextResponse } from "next/server";

import {
  applyMeaningfulPartnerActivity,
  notifyReadinessTransition,
  notifySpeakerReceived,
} from "@/lib/server/partner-communication-service";
import { isStorageBackedPortalDocument } from "@/lib/partner-portal-document";
import { toPartnerPortalPartnerDto } from "@/lib/server/partner-portal-dto";
import { validatePartnerPortalContent } from "@/lib/server/partner-portal-content";
import {
  writePartnerPortalSubmission,
  type PortalSubmissionMutation,
} from "@/lib/server/partner-portal-submission-write";
import { speakerPhotosNoLongerReferenced } from "@/lib/server/partner-portal-speaker-photo";
import { removePortalStorageObject } from "@/lib/server/partner-portal-storage";
import { requirePartnerPortalServiceAuth } from "@/lib/server/partner-portal-service-auth";
import { getPartnerByIdForApi } from "@/lib/server/partner-service";
import type { Partner } from "@/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function mutationFromBody(body: unknown): PortalSubmissionMutation | null {
  if (!body || typeof body !== "object") return null;
  const record = body as {
    op?: string;
    field?: string;
    value?: unknown;
    document?: PortalSubmissionMutation extends { op: "upsert_document" }
      ? PortalSubmissionMutation["document"]
      : never;
    kind?: PortalSubmissionMutation extends { op: "remove_document" }
      ? PortalSubmissionMutation["kind"]
      : never;
    row?: Record<string, unknown>;
  };
  if (
    record.op === "set_field" &&
    (record.field === "portalFasciaName" ||
      record.field === "portalWebsiteUrl" ||
      record.field === "portalSmsContent")
  ) {
    return { op: "set_field", field: record.field, value: String(record.value ?? "") };
  }
  if (record.op === "upsert_document" && record.document) {
    return { op: "upsert_document", document: record.document };
  }
  if (record.op === "remove_document" && record.kind) {
    return { op: "remove_document", kind: record.kind };
  }
  if (record.op === "upsert_speakers" && record.row) {
    return {
      op: "upsert_speakers",
      row: record.row as unknown as Extract<
        PortalSubmissionMutation,
        { op: "upsert_speakers" }
      >["row"],
    };
  }
  if (record.op === "upsert_representatives" && record.row) {
    return {
      op: "upsert_representatives",
      row: record.row as unknown as Extract<
        PortalSubmissionMutation,
        { op: "upsert_representatives" }
      >["row"],
    };
  }
  return null;
}

function patchForValidation(mutation: PortalSubmissionMutation): Partial<Partner> {
  if (mutation.op === "set_field") return { [mutation.field]: mutation.value };
  if (mutation.op === "upsert_document") return { portalDocuments: [mutation.document] };
  if (mutation.op === "remove_document") return {};
  if (mutation.op === "upsert_speakers") return { portalSeminarSpeakers: [mutation.row] };
  if (mutation.op === "patch_speaker_photo") {
    return {
      portalSeminarSpeakers: [
        {
          eventId: mutation.eventId,
          seminarId: mutation.seminarId,
          speakers: [mutation.speaker],
          updatedAt: new Date().toISOString(),
        },
      ],
    };
  }
  return { portalRepresentatives: [mutation.row] };
}

export async function POST(request: Request, context: RouteContext) {
  const authError = requirePartnerPortalServiceAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const before = await getPartnerByIdForApi(id);
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const mutation = mutationFromBody(await request.json().catch(() => null));
  if (!mutation) return NextResponse.json({ error: "Invalid submission" }, { status: 400 });

  const contentError = validatePartnerPortalContent(patchForValidation(mutation));
  if (contentError) return NextResponse.json({ error: contentError }, { status: 400 });

  const saved = await writePartnerPortalSubmission(id, mutation);
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: saved.status });

  if (
    mutation.op === "remove_document" &&
    saved.replacedDocument &&
    isStorageBackedPortalDocument(saved.replacedDocument)
  ) {
    await removePortalStorageObject(
      saved.replacedDocument.storageBucket!,
      saved.replacedDocument.storagePath!
    );
  }
  if (mutation.op === "upsert_speakers") {
    for (const orphan of speakerPhotosNoLongerReferenced(
      before.portalSeminarSpeakers,
      saved.partner.portalSeminarSpeakers
    )) {
      await removePortalStorageObject(orphan.storageBucket, orphan.storagePath);
    }
  }

  let partner = saved.partner;
  try {
    partner = await applyMeaningfulPartnerActivity(before, partner);
    if (mutation.op === "upsert_speakers") await notifySpeakerReceived(before, partner);
    await notifyReadinessTransition(before, partner);
  } catch (error) {
    console.info("[partner-communication]", {
      partnerId: partner.id,
      outcome: "unknown",
      error: error instanceof Error ? error.message : "Partner communication failed",
    });
  }

  return NextResponse.json(toPartnerPortalPartnerDto(partner));
}
