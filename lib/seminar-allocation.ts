import type {
  Partner,
  PartnerSeminarSlotAssignment,
} from "@/types";

export const SEMINAR_TOPIC_SLOT_COUNT = 1;

export const SEMINAR_CAPACITY_NOT_DECIDED =
  "Seminar capacity is not decided yet, so new seats cannot be allocated.";
export const SEMINAR_CAPACITY_ZERO =
  "This seminar has no partner panelist capacity.";
export const SEMINAR_FULL = "This seminar is full.";
export const SEMINAR_ALLOCATION_EXCEEDED =
  "Selected seminar topics cannot exceed the allocated seminar slots.";
export const SEMINAR_DUPLICATE_TOPIC =
  "This partner is already assigned to that seminar.";
export const SEMINAR_WRONG_EVENT =
  "That seminar does not belong to this event.";
export const SEMINAR_PARTNERSHIP_REQUIRED =
  "Seminar assignment requires a partnership for that event.";
export const SEMINAR_SLOTS_MUST_BE_ONE =
  "Each seminar topic uses exactly one slot.";
export const SPEAKER_SEMINAR_NOT_ASSIGNED =
  "Speaker details can only be saved for an assigned seminar.";

export class SeminarAllocationWriteError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "SeminarAllocationWriteError";
    this.status = status;
  }
}

export type SeminarAssignmentRef = {
  eventId: string;
  seminarId: string;
  slots: number;
};

export type SeminarCapacityRef = {
  id: string;
  eventId: string;
  panelistSlots: number | null;
};

export type SeminarPartnershipCount = {
  eventId: string;
  seminarSlotCount: number;
};

export type SeminarAllocationDecision =
  | { ok: true }
  | { ok: false; status: number; error: string };

export function seminarAssignmentKey(eventId: string, seminarId: string): string {
  return `${eventId}:${seminarId}`;
}

export function activeSeminarAssignments<T extends SeminarAssignmentRef>(
  assignments: readonly T[] | null | undefined
): T[] {
  return (assignments ?? []).filter(
    (assignment) =>
      assignment.slots > 0 &&
      Boolean(assignment.eventId) &&
      Boolean(assignment.seminarId)
  );
}

/** Topics currently held. One saved row with slots > 0 counts as one topic. */
export function selectedSeminarTopicCount(
  assignments: readonly SeminarAssignmentRef[] | null | undefined,
  eventId: string
): number {
  const topics = new Set<string>();
  for (const assignment of activeSeminarAssignments(assignments)) {
    if (assignment.eventId === eventId) topics.add(assignment.seminarId);
  }
  return topics.size;
}

export function seminarSelectionSummary(input: {
  seminarSlotCount: number | null | undefined;
  assignments: readonly SeminarAssignmentRef[] | null | undefined;
  eventId: string;
}): { allocated: number; selected: number; remaining: number } {
  const allocated = Math.max(0, Math.floor(input.seminarSlotCount ?? 0));
  const selected = selectedSeminarTopicCount(input.assignments, input.eventId);
  return {
    allocated,
    selected,
    remaining: Math.max(0, allocated - selected),
  };
}

export function seminarSlotReductionMessage(
  topicsToRemove: number,
  nextAllocated: number
): string {
  const topics =
    topicsToRemove === 1 ? "one seminar topic" : `${topicsToRemove} seminar topics`;
  return `Remove or reassign ${topics} before reducing the allocated seminar slots to ${nextAllocated}.`;
}

/** Seats reserved by one assignment. Non-positive values reserve nothing. */
export function occupiedSeatCount(slots: number | null | undefined): number {
  if (typeof slots !== "number" || !Number.isFinite(slots) || slots <= 0) return 0;
  return slots;
}

/**
 * Panelist seats reserved on each seminar.
 * A legacy row with slots > 1 reserves that many seats. Topic count stays separate.
 */
export function occupancyBySeminar(
  partners: readonly {
    id: string;
    seminarSlotAssignments?: readonly SeminarAssignmentRef[] | null;
  }[],
  excludePartnerId: string
): Map<string, number> {
  const seats = new Map<string, number>();
  for (const partner of partners) {
    if (partner.id === excludePartnerId) continue;
    for (const assignment of partner.seminarSlotAssignments ?? []) {
      const reserved = occupiedSeatCount(assignment.slots);
      if (reserved <= 0 || !assignment.seminarId) continue;
      seats.set(
        assignment.seminarId,
        (seats.get(assignment.seminarId) ?? 0) + reserved
      );
    }
  }
  return seats;
}

function partnershipCount(
  partnerships: readonly SeminarPartnershipCount[],
  eventId: string
): number | null {
  const row = partnerships.find((partnership) => partnership.eventId === eventId);
  if (!row) return null;
  return Math.floor(row.seminarSlotCount ?? 0);
}

function findExisting(
  existing: readonly SeminarAssignmentRef[],
  assignment: SeminarAssignmentRef
): SeminarAssignmentRef | undefined {
  return existing.find(
    (row) =>
      row.eventId === assignment.eventId && row.seminarId === assignment.seminarId
  );
}

function isUnchangedLegacyStack(
  existing: SeminarAssignmentRef | undefined,
  next: SeminarAssignmentRef
): boolean {
  return (
    existing != null &&
    existing.slots === next.slots &&
    Number.isInteger(next.slots) &&
    next.slots > SEMINAR_TOPIC_SLOT_COUNT
  );
}

/**
 * Saved selections reserve seats immediately, including before Confirm Topics.
 * Occupancy is the sum of positive `slots` values. A new row uses 1 seat.
 * A historical row with slots > 1 keeps reserving that many seats and is not rewritten.
 */
export function decideSeminarClaims(input: {
  existingAssignments: readonly SeminarAssignmentRef[];
  nextAssignments: readonly SeminarAssignmentRef[];
  previousPartnerships: readonly SeminarPartnershipCount[];
  nextPartnerships: readonly SeminarPartnershipCount[];
  seminars: readonly SeminarCapacityRef[];
  otherOccupancy: ReadonlyMap<string, number>;
}): SeminarAllocationDecision {
  const existing = activeSeminarAssignments(input.existingAssignments);
  const next = input.nextAssignments ?? [];
  const seenTopics = new Set<string>();
  const seminarsById = new Map(input.seminars.map((seminar) => [seminar.id, seminar]));

  for (const assignment of next) {
    if (!assignment.eventId || !assignment.seminarId) {
      return { ok: false, status: 400, error: SEMINAR_WRONG_EVENT };
    }
    if (!Number.isInteger(assignment.slots) || assignment.slots <= 0) {
      return { ok: false, status: 400, error: SEMINAR_SLOTS_MUST_BE_ONE };
    }

    const topicKey = seminarAssignmentKey(assignment.eventId, assignment.seminarId);
    if (seenTopics.has(topicKey)) {
      return { ok: false, status: 400, error: SEMINAR_DUPLICATE_TOPIC };
    }
    seenTopics.add(topicKey);

    const previous = findExisting(existing, assignment);
    if (
      assignment.slots !== SEMINAR_TOPIC_SLOT_COUNT &&
      !isUnchangedLegacyStack(previous, assignment)
    ) {
      return { ok: false, status: 400, error: SEMINAR_SLOTS_MUST_BE_ONE };
    }

    if (partnershipCount(input.nextPartnerships, assignment.eventId) == null) {
      return { ok: false, status: 400, error: SEMINAR_PARTNERSHIP_REQUIRED };
    }

    const seminar = seminarsById.get(assignment.seminarId);
    if (!seminar || seminar.eventId !== assignment.eventId) {
      return { ok: false, status: 400, error: SEMINAR_WRONG_EVENT };
    }

    const alreadyHeld = previous != null && previous.slots > 0;
    if (!alreadyHeld) {
      if (seminar.panelistSlots == null) {
        return { ok: false, status: 400, error: SEMINAR_CAPACITY_NOT_DECIDED };
      }
      if (seminar.panelistSlots === 0) {
        return { ok: false, status: 400, error: SEMINAR_CAPACITY_ZERO };
      }
      if (!Number.isInteger(seminar.panelistSlots) || seminar.panelistSlots < 1) {
        return { ok: false, status: 400, error: SEMINAR_CAPACITY_NOT_DECIDED };
      }
      const others = input.otherOccupancy.get(assignment.seminarId) ?? 0;
      if (others + occupiedSeatCount(assignment.slots) > seminar.panelistSlots) {
        return { ok: false, status: 409, error: SEMINAR_FULL };
      }
    }
  }

  const eventIds = new Set<string>([
    ...input.previousPartnerships.map((row) => row.eventId),
    ...input.nextPartnerships.map((row) => row.eventId),
    ...existing.map((row) => row.eventId),
    ...activeSeminarAssignments(next).map((row) => row.eventId),
  ]);

  for (const eventId of eventIds) {
    const nextAllocated = partnershipCount(input.nextPartnerships, eventId);
    if (nextAllocated == null) continue;
    if (!Number.isInteger(nextAllocated) || nextAllocated < 0) {
      return {
        ok: false,
        status: 400,
        error: "Allocated seminar slots must be a whole number of 0 or more.",
      };
    }
    const selected = selectedSeminarTopicCount(next, eventId);
    if (selected <= nextAllocated) continue;

    const previousAllocated = partnershipCount(input.previousPartnerships, eventId);
    const sameImbalance =
      previousAllocated != null &&
      previousAllocated === nextAllocated &&
      selectedSeminarTopicCount(existing, eventId) === selected;
    if (sameImbalance) continue;

    if (previousAllocated != null && nextAllocated < previousAllocated) {
      return {
        ok: false,
        status: 400,
        error: seminarSlotReductionMessage(selected - nextAllocated, nextAllocated),
      };
    }
    return { ok: false, status: 400, error: SEMINAR_ALLOCATION_EXCEEDED };
  }

  return { ok: true };
}

export function preserveSeminarConfirmation<
  T extends {
    seminarSlotsConfirmedAt?: string | null;
    seminarSlotAssignments?: readonly SeminarAssignmentRef[] | null;
  },
>(existing: T, next: T): T {
  const previous = existing.seminarSlotsConfirmedAt?.trim();
  if (!previous) return next;
  if (next.seminarSlotsConfirmedAt?.trim()) return next;

  const stillHeld = new Set(
    activeSeminarAssignments(next.seminarSlotAssignments).map((assignment) =>
      seminarAssignmentKey(assignment.eventId, assignment.seminarId)
    )
  );
  const keptAll = activeSeminarAssignments(existing.seminarSlotAssignments).every(
    (assignment) =>
      stillHeld.has(seminarAssignmentKey(assignment.eventId, assignment.seminarId))
  );
  if (!keptAll) return next;
  return { ...next, seminarSlotsConfirmedAt: previous };
}

function speakerSignature(row: {
  eventId?: string;
  seminarId?: string;
  speakers?: readonly {
    name?: string;
    designation?: string;
    contact?: string;
    phone?: string;
    introduction?: string;
    photoUrl?: string;
    linkedinProfile?: string;
  }[];
}): string {
  return JSON.stringify({
    eventId: row.eventId ?? "",
    seminarId: row.seminarId ?? "",
    speakers: (row.speakers ?? []).map((speaker) => ({
      name: speaker.name ?? "",
      designation: speaker.designation ?? "",
      contact: speaker.contact ?? speaker.phone ?? "",
      introduction: speaker.introduction ?? "",
      photoUrl: speaker.photoUrl ?? "",
      linkedinProfile: speaker.linkedinProfile ?? "",
    })),
  });
}

export function portalSpeakerRowsError(input: {
  existingSpeakers?: readonly {
    eventId: string;
    seminarId: string;
    speakers?: readonly {
      name?: string;
      designation?: string;
      contact?: string;
      phone?: string;
      introduction?: string;
      photoUrl?: string;
      linkedinProfile?: string;
    }[];
  }[] | null;
  nextSpeakers: readonly {
    eventId?: string;
    seminarId?: string;
    speakers?: readonly {
      name?: string;
      designation?: string;
      contact?: string;
      phone?: string;
      introduction?: string;
      photoUrl?: string;
      linkedinProfile?: string;
    }[];
  }[];
  assignments?: readonly SeminarAssignmentRef[] | null;
  eventIds?: readonly string[] | null;
  partnershipEventIds?: readonly string[] | null;
  seminars: readonly { id: string; eventId: string }[];
}): string | null {
  const previous = new Map(
    (input.existingSpeakers ?? []).map((row) => [speakerSignature(row), row])
  );
  const linkedEvents = new Set([
    ...(input.eventIds ?? []),
    ...(input.partnershipEventIds ?? []),
  ]);
  const seminars = new Map(
    input.seminars.map((seminar) => [seminar.id, seminar.eventId])
  );

  for (const row of input.nextSpeakers) {
    if (previous.has(speakerSignature(row))) continue;
    const eventId = row.eventId?.trim() ?? "";
    const seminarId = row.seminarId?.trim() ?? "";
    if (!eventId || !seminarId || !linkedEvents.has(eventId)) {
      return SPEAKER_SEMINAR_NOT_ASSIGNED;
    }
    if (seminars.get(seminarId) !== eventId) {
      return SEMINAR_WRONG_EVENT;
    }
    const assigned = activeSeminarAssignments(input.assignments).some(
      (assignment) =>
        assignment.eventId === eventId && assignment.seminarId === seminarId
    );
    if (!assigned) return SPEAKER_SEMINAR_NOT_ASSIGNED;
  }
  return null;
}

export function seminarAllocationSignature(
  partner: Pick<Partner, "eventPartnerships" | "seminarSlotAssignments">
): string {
  const counts = (partner.eventPartnerships ?? [])
    .map((partnership) => `${partnership.eventId}:${partnership.seminarSlotCount ?? 0}`)
    .sort();
  const seats = activeSeminarAssignments(partner.seminarSlotAssignments)
    .map(
      (assignment) =>
        `${assignment.eventId}:${assignment.seminarId}:${assignment.slots}`
    )
    .sort();
  return JSON.stringify({ counts, seats });
}
