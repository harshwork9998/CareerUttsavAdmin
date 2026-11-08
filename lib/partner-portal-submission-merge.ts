import type {
  PartnerPortalDocument,
  PartnerRepresentativesSubmission,
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
