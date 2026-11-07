import {
  SEMINAR_ALLOCATION_EXCEEDED,
  SEMINAR_DUPLICATE_TOPIC,
  SEMINAR_PARTNERSHIP_REQUIRED,
  SEMINAR_SLOTS_MUST_BE_ONE,
  SEMINAR_WRONG_EVENT,
  activeSeminarAssignments,
  decideSeminarClaims,
  occupancyBySeminar,
  seminarSelectionSummary,
  type SeminarAssignmentRef,
} from "@/lib/seminar-allocation";
import {
  normalizePartnerSeminarConfirmations,
  seminarTitleWithoutConfirmationMarker,
} from "@/lib/seminar-assignment-confirmation";

export const SEMINAR_TOPICS_LOCKED = "Confirmed seminar topics cannot be changed.";
export const SEMINAR_TOPICS_CONFIRM_INCOMPLETE =
  "Select every allocated seminar topic before confirming.";
export const SEMINAR_TOPICS_ALREADY_CONFIRMED = "Seminar topics are already confirmed.";
export const SEMINAR_TOPICS_NOT_ALLOCATED = "No seminar topics are allocated.";
export const SEMINAR_TOPIC_INVALID = "That seminar could not be selected.";

export type SeminarTopicAssignment = SeminarAssignmentRef & {
  seminarTitle?: string;
  confirmedAt?: string | null;
};

export type SeminarTopicPartner = {
  id: string;
  seminarSlotsConfirmedAt?: string | null;
  seminarSlotAssignments?: readonly SeminarTopicAssignment[] | null;
  eventPartnerships?: readonly {
    eventId: string;
    seminarSlotCount?: number | null;
  }[] | null;
};

export type SeminarTopicSeminar = {
  id: string;
  title?: string | null;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  hall?: number | null;
  panelistSlots?: number | null;
};

export type SeminarTopicEvent = {
  id: string;
  title?: string | null;
  city?: string | null;
  seminars?: readonly SeminarTopicSeminar[] | null;
};

export type SeminarTopicChoice = {
  eventId: string;
  seminarId: string;
  title: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  hall: number | null;
  selected: boolean;
  locked: boolean;
};

export type SeminarTopicEventGroup = {
  eventId: string;
  title: string;
  city: string;
  allocated: number;
  selected: number;
  remaining: number;
  topics: SeminarTopicChoice[];
};

export type PartnerSeminarTopicCatalog = {
  confirmedAt: string | null;
  fullyConfirmed: boolean;
  canConfirm: boolean;
  events: SeminarTopicEventGroup[];
};

export type SeminarTopicWritePlan =
  | {
      ok: true;
      assignments: SeminarTopicAssignment[];
      seminarSlotsConfirmedAt?: string;
    }
  | { ok: false; status: number; error: string };

type Occupant = {
  id: string;
  seminarSlotAssignments?: readonly SeminarAssignmentRef[] | null;
};

function topicKey(eventId: string, seminarId: string): string {
  return `${eventId}:${seminarId}`;
}

function partnershipsOf(partner: SeminarTopicPartner) {
  return partner.eventPartnerships ?? [];
}

function managedEventIds(partner: SeminarTopicPartner): Set<string> {
  return new Set(
    partnershipsOf(partner)
      .filter((row) => Math.floor(row.seminarSlotCount ?? 0) > 0)
      .map((row) => row.eventId)
  );
}

function storedAssignments(partner: SeminarTopicPartner): SeminarTopicAssignment[] {
  return activeSeminarAssignments(partner.seminarSlotAssignments);
}

function confirmedBaselineKeys(partner: SeminarTopicPartner): Set<string> {
  return new Set(
    storedAssignments(partner)
      .filter((row) => Boolean(row.confirmedAt?.trim()))
      .map((row) => topicKey(row.eventId, row.seminarId))
  );
}

function hasOpenAddition(partner: SeminarTopicPartner): boolean {
  const managed = managedEventIds(partner);
  return storedAssignments(partner).some(
    (row) => managed.has(row.eventId) && !row.confirmedAt?.trim()
  );
}

export function seminarTopicsFullyConfirmed(partner: SeminarTopicPartner): boolean {
  partner = normalizePartnerSeminarConfirmations(partner);
  if (!partner.seminarSlotsConfirmedAt?.trim()) return false;
  const managed = [...managedEventIds(partner)];
  if (managed.length === 0) return false;
  const exact = managed.every((eventId) => {
    const allocated =
      partnershipsOf(partner).find((row) => row.eventId === eventId)
        ?.seminarSlotCount ?? 0;
    return (
      seminarSelectionSummary({
        seminarSlotCount: allocated,
        assignments: partner.seminarSlotAssignments,
        eventId,
      }).selected === Math.floor(allocated)
    );
  });
  return exact && !hasOpenAddition(partner);
}

function seminarLookup(events: readonly SeminarTopicEvent[]) {
  const byId = new Map<string, SeminarTopicSeminar & { eventId: string }>();
  for (const event of events) {
    for (const seminar of event.seminars ?? []) {
      if (!byId.has(seminar.id)) {
        byId.set(seminar.id, { ...seminar, eventId: event.id });
      }
    }
  }
  return byId;
}

function capacityRefs(events: readonly SeminarTopicEvent[]) {
  return events.flatMap((event) =>
    (event.seminars ?? []).map((seminar) => ({
      id: seminar.id,
      eventId: event.id,
      panelistSlots: seminar.panelistSlots ?? null,
    }))
  );
}

export function buildPartnerSeminarTopicCatalog(input: {
  partner: SeminarTopicPartner;
  events: readonly SeminarTopicEvent[];
  partners: readonly Occupant[];
}): PartnerSeminarTopicCatalog {
  const partner = normalizePartnerSeminarConfirmations(input.partner);
  const confirmedAt = partner.seminarSlotsConfirmedAt?.trim() || null;
  const fullyConfirmed = seminarTopicsFullyConfirmed(partner);
  const baseline = confirmedBaselineKeys(partner);
  const own = new Map(
    storedAssignments(partner).map((row) => [
      topicKey(row.eventId, row.seminarId),
      row,
    ])
  );
  const others = occupancyBySeminar(input.partners, input.partner.id);
  const groups: SeminarTopicEventGroup[] = [];

  for (const partnership of partnershipsOf(partner)) {
    const summary = seminarSelectionSummary({
      seminarSlotCount: partnership.seminarSlotCount,
      assignments: partner.seminarSlotAssignments,
      eventId: partnership.eventId,
    });
    if (summary.allocated <= 0) continue;
    const event = input.events.find((row) => row.id === partnership.eventId);
    const topics: SeminarTopicChoice[] = [];

    for (const seminar of event?.seminars ?? []) {
      const key = topicKey(partnership.eventId, seminar.id);
      const held = own.get(key);
      const selected = held != null;
      const panelistSlots = seminar.panelistSlots ?? null;
      const otherSeats = others.get(seminar.id) ?? 0;
      const openForNew =
        !selected &&
        typeof panelistSlots === "number" &&
        Number.isInteger(panelistSlots) &&
        panelistSlots >= 1 &&
        panelistSlots - otherSeats >= 1;
      if (!selected && (fullyConfirmed || !openForNew)) continue;
      topics.push({
        eventId: partnership.eventId,
        seminarId: seminar.id,
        title:
          seminar.title?.trim() ||
          seminarTitleWithoutConfirmationMarker(held?.seminarTitle) ||
          seminar.id,
        date: seminar.date ?? null,
        startTime: seminar.startTime ?? null,
        endTime: seminar.endTime ?? null,
        hall: seminar.hall ?? null,
        selected,
        locked: selected && baseline.has(key),
      });
    }

    groups.push({
      eventId: partnership.eventId,
      title: event?.title?.trim() || partnership.eventId,
      city: event?.city?.trim() || "",
      allocated: summary.allocated,
      selected: summary.selected,
      remaining: summary.remaining,
      topics,
    });
  }

  const canConfirm =
    !fullyConfirmed &&
    groups.length > 0 &&
    groups.every((group) => group.selected === group.allocated);

  return { confirmedAt, fullyConfirmed, canConfirm, events: groups };
}

export function readSeminarTopicSelection(body: unknown):
  | {
      ok: true;
      topics: Array<{ eventId: string; seminarId: string }>;
      confirm: boolean;
    }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: SEMINAR_TOPIC_INVALID };
  }
  const record = body as {
    topics?: unknown;
    confirm?: unknown;
    slots?: unknown;
  };
  if (record.slots != null && record.slots !== 1) {
    return { ok: false, status: 400, error: SEMINAR_SLOTS_MUST_BE_ONE };
  }
  if (!Array.isArray(record.topics)) {
    return { ok: false, status: 400, error: SEMINAR_TOPIC_INVALID };
  }
  const topics: Array<{ eventId: string; seminarId: string }> = [];
  const seen = new Set<string>();
  for (const entry of record.topics) {
    if (!entry || typeof entry !== "object") {
      return { ok: false, status: 400, error: SEMINAR_TOPIC_INVALID };
    }
    const row = entry as { eventId?: unknown; seminarId?: unknown; slots?: unknown };
    if (row.slots != null && row.slots !== 1) {
      return { ok: false, status: 400, error: SEMINAR_SLOTS_MUST_BE_ONE };
    }
    const eventId = typeof row.eventId === "string" ? row.eventId.trim() : "";
    const seminarId = typeof row.seminarId === "string" ? row.seminarId.trim() : "";
    if (!eventId || !seminarId) {
      return { ok: false, status: 400, error: SEMINAR_TOPIC_INVALID };
    }
    const key = topicKey(eventId, seminarId);
    if (seen.has(key)) {
      return { ok: false, status: 400, error: SEMINAR_DUPLICATE_TOPIC };
    }
    seen.add(key);
    topics.push({ eventId, seminarId });
  }
  return { ok: true, topics, confirm: record.confirm === true };
}

export function planPartnerSeminarTopicWrite(input: {
  partner: SeminarTopicPartner;
  events: readonly SeminarTopicEvent[];
  partners: readonly Occupant[];
  topics: readonly { eventId: string; seminarId: string }[];
  confirm: boolean;
  now?: string;
}): SeminarTopicWritePlan {
  const partner = normalizePartnerSeminarConfirmations(input.partner);
  const managed = managedEventIds(partner);
  const existing = storedAssignments(partner);
  const existingByKey = new Map(
    existing.map((row) => [topicKey(row.eventId, row.seminarId), row])
  );
  const seminars = seminarLookup(input.events);
  const seen = new Set<string>();
  const requested: SeminarTopicAssignment[] = [];

  for (const topic of input.topics) {
    const key = topicKey(topic.eventId, topic.seminarId);
    if (seen.has(key)) {
      return { ok: false, status: 400, error: SEMINAR_DUPLICATE_TOPIC };
    }
    seen.add(key);
    const partnership = partnershipsOf(partner).find(
      (row) => row.eventId === topic.eventId
    );
    if (!partnership) {
      return { ok: false, status: 400, error: SEMINAR_PARTNERSHIP_REQUIRED };
    }
    if (!managed.has(topic.eventId)) {
      return { ok: false, status: 400, error: SEMINAR_ALLOCATION_EXCEEDED };
    }
    const seminar = seminars.get(topic.seminarId);
    if (!seminar) return { ok: false, status: 400, error: SEMINAR_TOPIC_INVALID };
    if (seminar.eventId !== topic.eventId) {
      return { ok: false, status: 400, error: SEMINAR_WRONG_EVENT };
    }
    const previous = existingByKey.get(key);
    requested.push({
      eventId: topic.eventId,
      seminarId: topic.seminarId,
      slots: previous && previous.slots > 1 ? previous.slots : 1,
      seminarTitle:
        seminarTitleWithoutConfirmationMarker(previous?.seminarTitle) ??
        seminarTitleWithoutConfirmationMarker(seminar.title),
      confirmedAt: input.confirm
        ? previous?.confirmedAt?.trim() || input.now || new Date().toISOString()
        : previous?.confirmedAt?.trim() || null,
    });
  }

  const baseline = confirmedBaselineKeys(partner);
  for (const key of baseline) {
    if (!seen.has(key)) {
      return { ok: false, status: 400, error: SEMINAR_TOPICS_LOCKED };
    }
    const previous = existingByKey.get(key);
    const next = requested.find((row) => topicKey(row.eventId, row.seminarId) === key);
    if (!previous || !next || next.slots !== previous.slots) {
      return { ok: false, status: 400, error: SEMINAR_TOPICS_LOCKED };
    }
  }

  if (seminarTopicsFullyConfirmed(partner)) {
    const same =
      existing.filter((row) => managed.has(row.eventId)).length === requested.length &&
      requested.every((row) => {
        const previous = existingByKey.get(topicKey(row.eventId, row.seminarId));
        return previous != null && previous.slots === row.slots;
      });
    if (!same || input.confirm) {
      return {
        ok: false,
        status: 400,
        error: input.confirm ? SEMINAR_TOPICS_ALREADY_CONFIRMED : SEMINAR_TOPICS_LOCKED,
      };
    }
  }

  const preserved = existing
    .filter((row) => !managed.has(row.eventId))
    .map((row) => ({
      ...row,
      seminarTitle: seminarTitleWithoutConfirmationMarker(row.seminarTitle),
      confirmedAt: row.confirmedAt?.trim() || null,
    }));
  const confirming = input.confirm === true;
  if (confirming && managed.size === 0) {
    return { ok: false, status: 400, error: SEMINAR_TOPICS_NOT_ALLOCATED };
  }

  const nextAssignments = [...preserved, ...requested];
  const decision = decideSeminarClaims({
    existingAssignments: existing,
    nextAssignments,
    previousPartnerships: partnershipsOf(partner).map((row) => ({
      eventId: row.eventId,
      seminarSlotCount: Math.floor(row.seminarSlotCount ?? 0),
    })),
    nextPartnerships: partnershipsOf(partner).map((row) => ({
      eventId: row.eventId,
      seminarSlotCount: Math.floor(row.seminarSlotCount ?? 0),
    })),
    seminars: capacityRefs(input.events),
    otherOccupancy: occupancyBySeminar(input.partners, input.partner.id),
  });
  if (!decision.ok) return decision;

  if (confirming) {
    const exact = [...managed].every((eventId) => {
      const allocated =
        partnershipsOf(partner).find((row) => row.eventId === eventId)
          ?.seminarSlotCount ?? 0;
      return (
        seminarSelectionSummary({
          seminarSlotCount: allocated,
          assignments: nextAssignments,
          eventId,
        }).selected === Math.floor(allocated)
      );
    });
    if (!exact) {
      return { ok: false, status: 400, error: SEMINAR_TOPICS_CONFIRM_INCOMPLETE };
    }
    return {
      ok: true,
      assignments: nextAssignments,
      seminarSlotsConfirmedAt: input.now ?? new Date().toISOString(),
    };
  }

  const confirmedAt = partner.seminarSlotsConfirmedAt?.trim();
  return {
    ok: true,
    assignments: nextAssignments,
    seminarSlotsConfirmedAt: confirmedAt || undefined,
  };
}
