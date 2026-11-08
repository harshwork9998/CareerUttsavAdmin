import { NextResponse } from "next/server";

import { resolveSpeakerPhotoAccessUrl } from "@/lib/server/partner-portal-speaker-photo";
import { requirePartnerPortalServiceAuth } from "@/lib/server/partner-portal-service-auth";
import { getPartnerByIdForApi } from "@/lib/server/partner-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const authError = requirePartnerPortalServiceAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId")?.trim() ?? "";
  const seminarId = url.searchParams.get("seminarId")?.trim() ?? "";
  const speakerId = url.searchParams.get("speakerId")?.trim() ?? "";
  if (!eventId || !seminarId || !speakerId) {
    return NextResponse.json({ error: "Invalid speaker photo." }, { status: 400 });
  }

  const partner = await getPartnerByIdForApi(id);
  if (!partner) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const resolved = await resolveSpeakerPhotoAccessUrl(partner, eventId, seminarId, speakerId);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  return NextResponse.json({ url: resolved.url });
}
