import type {
  PartnerPortalDocument,
  PartnerRepresentativesSubmission,
  PartnerSeminarSpeakerDetail,
  PartnerSeminarSpeakerSubmission,
} from "@/types";

export function upsertPortalDocumentByKind(
  documents: readonly PartnerPortalDocument[] | null | undefined,
  next: PartnerPortalDocument
): { documents: PartnerPortalDocument[]; replaced?: PartnerPortalDocument } {
  const list = [...(documents ?? [])];
  const index = list.findIndex((doc) => doc.kind === next.kind);
  const replaced = index >= 0 ? list[index] : undefined;
  if (index >= 0) list[index] = next;
  else list.push(next);
  return { documents: list, replaced };
}

export function removePortalDocumentByKind(
  documents: readonly PartnerPortalDocument[] | null | undefined,
  kind: PartnerPortalDocument["kind"]
): { documents: PartnerPortalDocument[]; removed?: PartnerPortalDocument } {
  const list = [...(documents ?? [])];
  const removed = list.find((doc) => doc.kind === kind);
  return {
    documents: list.filter((doc) => doc.kind !== kind),
    removed,
  };
}

export function upsertSeminarSpeakers(
  rows: readonly PartnerSeminarSpeakerSubmission[] | null | undefined,
  next: PartnerSeminarSpeakerSubmission
): PartnerSeminarSpeakerSubmission[] {
  const list = [...(rows ?? [])];
  const index = list.findIndex(
    (row) => row.eventId === next.eventId && row.seminarId === next.seminarId
  );
  if (index >= 0) list[index] = next;
  else list.push(next);
  return list;
}

export function patchSeminarSpeakerPhoto(
  rows: readonly PartnerSeminarSpeakerSubmission[] | null | undefined,
  input: {
    eventId: string;
    seminarId: string;
    speaker: PartnerSeminarSpeakerDetail;
  }
): PartnerSeminarSpeakerSubmission[] {
  const speakerId = input.speaker.id?.trim();
  const list = [...(rows ?? [])];
  const index = list.findIndex(
    (row) => row.eventId === input.eventId && row.seminarId === input.seminarId
  );
  const current =
    index >= 0
      ? list[index]!
      : {
          eventId: input.eventId,
          seminarId: input.seminarId,
          speakers: [] as PartnerSeminarSpeakerDetail[],
          updatedAt: new Date().toISOString(),
        };
  const speakers = [...current.speakers];
  const speakerIndex = speakerId
    ? speakers.findIndex((speaker) => speaker.id === speakerId)
    : -1;
  if (speakerIndex >= 0) {
    speakers[speakerIndex] = { ...speakers[speakerIndex], ...input.speaker, id: speakerId };
  } else {
    speakers.push({ ...input.speaker, id: speakerId || input.speaker.id });
  }
  const nextRow: PartnerSeminarSpeakerSubmission = {
    ...current,
    speakers,
    updatedAt: new Date().toISOString(),
  };
  if (index >= 0) list[index] = nextRow;
  else list.push(nextRow);
  return list;
}

export function upsertEventRepresentatives(
  rows: readonly PartnerRepresentativesSubmission[] | null | undefined,
  next: PartnerRepresentativesSubmission
): PartnerRepresentativesSubmission[] {
  const list = [...(rows ?? [])];
  const index = list.findIndex((row) => row.eventId === next.eventId);
  if (index >= 0) list[index] = next;
  else list.push(next);
  return list;
}
