import { NextResponse } from "next/server";

import {
  applyMeaningfulPartnerActivity,
  notifyReadinessTransition,
} from "@/lib/server/partner-communication-service";
import { toPartnerPortalPartnerDto } from "@/lib/server/partner-portal-dto";
import { commitPartnerSpeakerPhotoUpload } from "@/lib/server/partner-portal-speaker-photo";
import { requirePartnerPortalServiceAuth } from "@/lib/server/partner-portal-service-auth";
import { getPartnerByIdForApi } from "@/lib/server/partner-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authError = requirePartnerPortalServiceAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const before = await getPartnerByIdForApi(id);
  if (!before) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const result = await commitPartnerSpeakerPhotoUpload({
    partner: before,
    eventId: String(body?.eventId ?? ""),
    seminarId: String(body?.seminarId ?? ""),
    speakerId: String(body?.speakerId ?? ""),
    fileName: String(body?.fileName ?? ""),
    mimeType: String(body?.mimeType ?? ""),
    fileSizeBytes: Number(body?.fileSizeBytes) || 0,
    storageBucket: String(body?.storageBucket ?? ""),
    storagePath: String(body?.storagePath ?? ""),
    ifMatchToken:
      body?.ifMatchToken === undefined ? undefined : String(body.ifMatchToken ?? ""),
  });
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        ...(result.partner ? toPartnerPortalPartnerDto(result.partner) : {}),
      },
      { status: result.status }
    );
  }

  let partner = result.partner;
  if (result.persisted) {
    try {
      partner = await applyMeaningfulPartnerActivity(before, partner);
      await notifyReadinessTransition(before, partner);
    } catch (error) {
      console.info("[partner-communication]", {
        partnerId: partner.id,
        outcome: "unknown",
        error: error instanceof Error ? error.message : "Partner communication failed",
      });
    }
  }

  return NextResponse.json({
    ...toPartnerPortalPartnerDto(partner),
    persisted: result.persisted,
    speakerId: result.speakerId,
    storageBucket: result.storageBucket,
    storagePath: result.storagePath,
    mimeType: result.mimeType,
    fileSizeBytes: result.fileSizeBytes,
    fileName: result.fileName,
  });
}
