import { randomUUID } from "node:crypto";

import {
  PORTAL_STORAGE_PROVIDER_SUPABASE,
} from "@/lib/partner-portal-document";
import {
  isStorageBackedSpeakerPhoto,
  speakerPhotoStorageRef,
} from "@/lib/partner-portal-speaker";
import {
  fileExtension,
  validateUploadFile,
} from "@/lib/partner-upload-policy";
import {
  assertPortalPathUsesBucket,
  assertSpeakerPhotoPathOwnedByPartner,
  buildSpeakerPhotoObjectPath,
  isUuidLike,
} from "@/lib/server/partner-portal-storage-paths";
import {
  createPortalDocumentReadUrl,
  createSignedUploadIntent,
  removePortalStorageObject,
  verifyPortalStorageObject,
} from "@/lib/server/partner-portal-storage";
import { writePartnerPortalSubmission } from "@/lib/server/partner-portal-submission-write";
import type { Partner, PartnerSeminarSpeakerDetail } from "@/types";

function speakerSeminarAssigned(partner: Partner, eventId: string, seminarId: string): boolean {
  const linked = new Set([
    ...(partner.eventIds ?? []),
    ...(partner.eventPartnerships ?? []).map((row) => row.eventId),
  ]);
  if (!linked.has(eventId)) return false;
  return (partner.seminarSlotAssignments ?? []).some(
    (row) => row.eventId === eventId && row.seminarId === seminarId && row.slots > 0
  );
}

export function findPortalSpeaker(
  partner: Partner,
  eventId: string,
  seminarId: string,
  speakerId: string
): PartnerSeminarSpeakerDetail | undefined {
  const row = (partner.portalSeminarSpeakers ?? []).find(
    (entry) => entry.eventId === eventId && entry.seminarId === seminarId
  );
  return row?.speakers.find((speaker) => speaker.id === speakerId);
}

export function resolveSpeakerPhotoId(speakerId?: string): string {
  const requested = speakerId?.trim() ?? "";
  if (requested && isUuidLike(requested)) return requested;
  return randomUUID();
}

export async function createPartnerSpeakerPhotoUploadIntent(input: {
  partner: Partner;
  eventId: string;
  seminarId: string;
  speakerId?: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
}): Promise<
  | {
      ok: true;
      intent: { bucket: string; path: string; token: string; tusEndpoint: string };
      speakerId: string;
    }
  | { ok: false; error: string; status: number }
> {
  const eventId = input.eventId.trim();
  const seminarId = input.seminarId.trim();
  if (!speakerSeminarAssigned(input.partner, eventId, seminarId)) {
    return {
      ok: false,
      error: "Speaker details can only be saved for an assigned seminar.",
      status: 403,
    };
  }
  const validationError = validateUploadFile({
    fileName: input.fileName,
    fileSizeBytes: input.fileSizeBytes,
    kind: "speaker_photo",
    mimeType: input.mimeType,
  });
  if (validationError) {
    return { ok: false, error: validationError, status: 400 };
  }
  const speakerId = resolveSpeakerPhotoId(input.speakerId);
  const path = buildSpeakerPhotoObjectPath(
    input.partner.id,
    speakerId,
    fileExtension(input.fileName)
  );
  const signed = await createSignedUploadIntent(path);
  if (!signed.ok) {
    return { ok: false, error: signed.error, status: signed.status };
  }
  return { ok: true, intent: signed.intent, speakerId };
}

export async function commitPartnerSpeakerPhotoUpload(input: {
  partner: Partner;
  eventId: string;
  seminarId: string;
  speakerId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageBucket: string;
  storagePath: string;
  ifMatchToken?: string;
}): Promise<
  | {
      ok: true;
      persisted: boolean;
      speakerId: string;
      storageBucket: string;
      storagePath: string;
      mimeType: string;
      fileSizeBytes: number;
      fileName: string;
      partner: Partner;
    }
  | { ok: false; error: string; status: number; partner?: Partner }
> {
  const eventId = input.eventId.trim();
  const seminarId = input.seminarId.trim();
  const speakerId = input.speakerId.trim();
  if (!speakerSeminarAssigned(input.partner, eventId, seminarId)) {
    return {
      ok: false,
      error: "Speaker details can only be saved for an assigned seminar.",
      status: 403,
    };
  }
  if (!isUuidLike(speakerId)) {
    return { ok: false, error: "Invalid upload path.", status: 403 };
  }
  if (
    !assertSpeakerPhotoPathOwnedByPartner(input.storagePath, input.partner.id, speakerId) ||
    !assertPortalPathUsesBucket(input.storageBucket)
  ) {
    return { ok: false, error: "Invalid upload path.", status: 403 };
  }
  const validationError = validateUploadFile({
    fileName: input.fileName,
    fileSizeBytes: input.fileSizeBytes,
    kind: "speaker_photo",
    mimeType: input.mimeType,
  });
  if (validationError) {
    return { ok: false, error: validationError, status: 400 };
  }

  const verified = await verifyPortalStorageObject(
    input.storageBucket,
    input.storagePath
  );
  if (!verified.ok) {
    const status =
      verified.reason === "missing" ? 400 : verified.reason === "unconfigured" ? 503 : 502;
    return {
      ok: false,
      error: "Uploaded file could not be verified. Please try again.",
      status,
    };
  }

  const existing = findPortalSpeaker(input.partner, eventId, seminarId, speakerId);
  const photoFields: PartnerSeminarSpeakerDetail = {
    ...(existing ?? { name: "" }),
    id: speakerId,
    photoUrl: "",
    photoStorageProvider: PORTAL_STORAGE_PROVIDER_SUPABASE,
    photoStorageBucket: input.storageBucket,
    photoStoragePath: input.storagePath,
    photoFileName: input.fileName,
    photoMimeType: input.mimeType.trim() || verified.info.mimeType,
    photoFileSizeBytes: verified.info.size,
    photoUploadedAt: new Date().toISOString(),
  };

  if (!existing) {
    return {
      ok: true,
      persisted: false,
      speakerId,
      storageBucket: input.storageBucket,
      storagePath: input.storagePath,
      mimeType: photoFields.photoMimeType ?? verified.info.mimeType,
      fileSizeBytes: verified.info.size,
      fileName: input.fileName,
      partner: input.partner,
    };
  }

  const saved = await writePartnerPortalSubmission(input.partner.id, {
    op: "patch_speaker_photo",
    eventId,
    seminarId,
    speaker: photoFields,
    ifMatchToken: input.ifMatchToken,
  });
  if (!saved.ok) {
    if (saved.status === 409 && saved.partner) {
      const live = findPortalSpeaker(
        saved.partner,
        eventId,
        seminarId,
        speakerId
      );
      if (live?.photoStoragePath?.trim() === input.storagePath.trim()) {
        return {
          ok: true,
          persisted: true,
          speakerId,
          storageBucket: input.storageBucket,
          storagePath: input.storagePath,
          mimeType: live.photoMimeType ?? photoFields.photoMimeType ?? verified.info.mimeType,
          fileSizeBytes: live.photoFileSizeBytes ?? verified.info.size,
          fileName: live.photoFileName ?? input.fileName,
          partner: saved.partner,
        };
      }
    }
    await removePortalStorageObject(input.storageBucket, input.storagePath).catch(
      () => undefined
    );
    return {
      ok: false,
      error: saved.error,
      status: saved.status,
      partner: saved.partner,
    };
  }

  const previous = speakerPhotoStorageRef(existing);
  if (previous && previous.storagePath !== input.storagePath) {
    await removePortalStorageObject(previous.storageBucket, previous.storagePath).catch(
      () => undefined
    );
  }

  return {
    ok: true,
    persisted: true,
    speakerId,
    storageBucket: input.storageBucket,
    storagePath: input.storagePath,
    mimeType: photoFields.photoMimeType ?? verified.info.mimeType,
    fileSizeBytes: verified.info.size,
    fileName: input.fileName,
    partner: saved.partner,
  };
}

export async function resolveSpeakerPhotoAccessUrl(
  partner: Partner,
  eventId: string,
  seminarId: string,
  speakerId: string
): Promise<{ url: string } | { error: string; status: number }> {
  const speaker = findPortalSpeaker(partner, eventId, seminarId, speakerId);
  if (!speaker) {
    return { error: "Document not found.", status: 404 };
  }
  if (isStorageBackedSpeakerPhoto(speaker)) {
    const signed = await createPortalDocumentReadUrl(
      speaker.photoStorageBucket!,
      speaker.photoStoragePath!
    );
    if (!signed) {
      return { error: "Could not open this file.", status: 502 };
    }
    return { url: signed };
  }
  const legacy = speaker.photoUrl?.trim() ?? "";
  if (!legacy) {
    return { error: "Document not found.", status: 404 };
  }
  return { url: legacy };
}

export function speakerPhotosNoLongerReferenced(
  before: Partner["portalSeminarSpeakers"],
  after: Partner["portalSeminarSpeakers"]
): Array<{ storageBucket: string; storagePath: string }> {
  const remaining = new Set(
    (after ?? []).flatMap((row) =>
      row.speakers
        .map((speaker) => speakerPhotoStorageRef(speaker))
        .filter((ref): ref is { storageBucket: string; storagePath: string } => Boolean(ref))
        .map((ref) => `${ref.storageBucket}:${ref.storagePath}`)
    )
  );
  const removed: Array<{ storageBucket: string; storagePath: string }> = [];
  for (const row of before ?? []) {
    for (const speaker of row.speakers) {
      const ref = speakerPhotoStorageRef(speaker);
      if (!ref) continue;
      const key = `${ref.storageBucket}:${ref.storagePath}`;
      if (!remaining.has(key)) removed.push(ref);
    }
  }
  return removed;
}
