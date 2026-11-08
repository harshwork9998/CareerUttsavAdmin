import { NextResponse } from "next/server";

import { createPartnerSpeakerPhotoUploadIntent } from "@/lib/server/partner-portal-speaker-photo";
import { requirePartnerPortalServiceAuth } from "@/lib/server/partner-portal-service-auth";
import { getPartnerByIdForApi } from "@/lib/server/partner-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authError = requirePartnerPortalServiceAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const partner = await getPartnerByIdForApi(id);
  if (!partner) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const result = await createPartnerSpeakerPhotoUploadIntent({
    partner,
    eventId: String(body?.eventId ?? ""),
    seminarId: String(body?.seminarId ?? ""),
    speakerId: String(body?.speakerId ?? ""),
    fileName: String(body?.fileName ?? ""),
    mimeType: String(body?.mimeType ?? ""),
    fileSizeBytes: Number(body?.fileSizeBytes) || 0,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ...result.intent, speakerId: result.speakerId });
}
