import { PORTAL_STORAGE_PROVIDER_SUPABASE } from "@/lib/partner-portal-document";
import type { PartnerSeminarSpeakerDetail } from "@/types";

export type SpeakerPhotoStorageFields = Pick<
  PartnerSeminarSpeakerDetail,
  | "photoUrl"
  | "photoStorageProvider"
  | "photoStorageBucket"
  | "photoStoragePath"
  | "photoFileName"
  | "photoMimeType"
  | "photoFileSizeBytes"
>;

export function isStorageBackedSpeakerPhoto(
  speaker: Pick<
    PartnerSeminarSpeakerDetail,
    "photoStorageProvider" | "photoStorageBucket" | "photoStoragePath"
  > | null | undefined
): boolean {
  return (
    speaker?.photoStorageProvider === PORTAL_STORAGE_PROVIDER_SUPABASE &&
    Boolean(speaker.photoStorageBucket?.trim()) &&
    Boolean(speaker.photoStoragePath?.trim())
  );
}

export function speakerHasPersistedPhoto(
  speaker: SpeakerPhotoStorageFields | null | undefined
): boolean {
  if (!speaker) return false;
  if (isStorageBackedSpeakerPhoto(speaker)) return true;
  const url = speaker.photoUrl?.trim() ?? "";
  return (
    url.startsWith("data:") ||
    url.startsWith("http://") ||
    url.startsWith("https://")
  );
}

export function speakerPhotoStorageRef(
  speaker: SpeakerPhotoStorageFields | null | undefined
): { storageBucket: string; storagePath: string } | null {
  if (!speaker || !isStorageBackedSpeakerPhoto(speaker)) return null;
  return {
    storageBucket: speaker.photoStorageBucket!.trim(),
    storagePath: speaker.photoStoragePath!.trim(),
  };
}
