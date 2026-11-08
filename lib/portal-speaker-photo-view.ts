import { isStorageBackedSpeakerPhoto } from "@/lib/partner-portal-speaker";
import type { PartnerSeminarSpeakerDetail, SeminarSpeaker } from "@/types";

export async function resolvePortalSpeakerPhotoHref(input: {
  partnerId: string;
  eventId: string;
  seminarId: string;
  speaker:
    | Pick<
        PartnerSeminarSpeakerDetail,
        | "id"
        | "photoUrl"
        | "photoStorageProvider"
        | "photoStorageBucket"
        | "photoStoragePath"
      >
    | Pick<
        SeminarSpeaker,
        | "portalSpeakerId"
        | "photoUrl"
        | "photoStorageProvider"
        | "photoStorageBucket"
        | "photoStoragePath"
      >;
}): Promise<string | null> {
  const speakerId =
    "portalSpeakerId" in input.speaker
      ? input.speaker.portalSpeakerId
      : "id" in input.speaker
        ? input.speaker.id
        : undefined;
  if (isStorageBackedSpeakerPhoto(input.speaker) && speakerId) {
    const params = new URLSearchParams({
      eventId: input.eventId,
      seminarId: input.seminarId,
      speakerId,
    });
    const res = await fetch(
      `/api/partners/${encodeURIComponent(input.partnerId)}/speaker-photo/access-url?${params}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const payload = (await res.json().catch(() => null)) as { url?: string } | null;
    return typeof payload?.url === "string" ? payload.url : null;
  }
  const legacy = input.speaker.photoUrl?.trim() ?? "";
  return legacy || null;
}
