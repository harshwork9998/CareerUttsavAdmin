"use client";

import { useEffect, useState } from "react";

import { resolvePortalSpeakerPhotoHref } from "@/lib/portal-speaker-photo-view";
import { isStorageBackedSpeakerPhoto } from "@/lib/partner-portal-speaker";
import type { PartnerSeminarSpeakerDetail, SeminarSpeaker } from "@/types";

type SpeakerPhotoSource =
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

export function PortalSpeakerPhoto({
  partnerId,
  eventId,
  seminarId,
  speaker,
  alt,
  className,
}: {
  partnerId?: string;
  eventId: string;
  seminarId: string;
  speaker: SpeakerPhotoSource;
  alt: string;
  className?: string;
}) {
  const legacy = speaker.photoUrl?.trim() ?? "";
  const storageBacked = isStorageBackedSpeakerPhoto(speaker);
  const speakerKey =
    "portalSpeakerId" in speaker
      ? speaker.portalSpeakerId
      : "id" in speaker
        ? speaker.id
        : undefined;
  const [src, setSrc] = useState<string | null>(storageBacked ? null : legacy || null);

  useEffect(() => {
    if (!storageBacked) {
      setSrc(legacy || null);
      return;
    }
    if (!partnerId) {
      setSrc(null);
      return;
    }
    let cancelled = false;
    void resolvePortalSpeakerPhotoHref({
      partnerId,
      eventId,
      seminarId,
      speaker,
    }).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [
    partnerId,
    eventId,
    seminarId,
    storageBacked,
    legacy,
    speakerKey,
    speaker.photoStoragePath,
  ]);

  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  );
}
