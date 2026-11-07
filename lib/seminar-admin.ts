import {
  SEMINAR_CAPACITY_NOT_DECIDED,
  SEMINAR_CAPACITY_ZERO,
  SEMINAR_DUPLICATE_TOPIC,
  SEMINAR_FULL,
  SEMINAR_WRONG_EVENT,
  occupancyBySeminar,
  occupiedSeatCount,
  seminarSelectionSummary,
} from "@/lib/seminar-allocation";
import { isSeminarAvailableForPartnerAllocation } from "@/lib/seminar-schedule";
import type {
  EventSeminar,
  PartnerSeminarSlotAssignment,
  SeminarSessionRoster,
  SeminarSpeaker,
} from "@/types";

export const SEMINAR_MOVE_SAME_TOPIC = "Choose a different seminar.";
export const SEMINAR_ASSIGNMENT_NOT_FOUND = "That seminar assignment was not found.";
export const LEGACY_STACKED_ASSIGNMENT_MOVE =
  "Legacy multi-seat assignments must be removed before using the new one-topic-per-slot workflow.";

export function seminarAssignmentCanBeReassigned(slots: number): boolean {
  return slots === 1;
}

export type SeminarTopicConfirmationLabel =
  | "Confirmed"
  | "Pending Partner Confirmation";

export type AdminSeminarConfirmationLabel = "Confirmed" | "Pending Confirmation";

export type SeminarChapterTopic = {
  eventId: string;
  seminarId: string;
  title: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  hall: number | null;
  slots: number;
  status: SeminarTopicConfirmationLabel;
};

export type SeminarChapterEventStatus = {
  eventId: string;
  title: string;
  allocated: number;
  selected: number;
  remaining: number;
  topics: SeminarChapterTopic[];
};

type SeminarEvent = {
  id: string;
  title?: string;
  seminars?: readonly (Pick<
    EventSeminar,
    "id" | "title" | "date" | "startTime" | "endTime" | "hall" | "panelistSlots"
  > | null)[] | null;
};

type StatusPartner = {
  eventIds?: readonly string[] | null;
  eventPartnerships?: readonly { eventId: string; seminarSlotCount?: number | null }[] | null;
  seminarSlotAssignments?: readonly (PartnerSeminarSlotAssignment | SeminarMoveAssignment)[] | null;
};

export type SeminarMoveAssignment = {
  eventId: string;
  seminarId: string;
  slots: number;
  seminarTitle?: string;
  confirmedAt?: string | null;
};

export function adminListsSeminar(seminar: {
  panelistSlots?: number | null;
}): boolean {
  void seminar;
  return true;
}

export function listAdminSeminarSessions<T extends { id: string; seminars?: readonly (EventSeminar | null)[] | null }>(
  events: readonly T[]
): Array<{ event: T; seminar: EventSeminar }> {
  const sessions: Array<{ event: T; seminar: EventSeminar }> = [];
  for (const event of events) {
    for (const seminar of event.seminars ?? []) {
      if (!seminar || !adminListsSeminar(seminar)) continue;
      sessions.push({ event, seminar });
    }
  }
  return sessions;
}

/**
 * Chapter 6 does not block the journey and does not confirm topics.
 * After deliverables, commercials are the next required step.
 */
export function adminJourneyChapterAfterDeliverables(partner: {
  commercialsConfirmedAt?: string | null;
  seminarSlotsConfirmedAt?: string | null;
}): 7 | 8 {
  if (!partner.commercialsConfirmedAt) return 7;
  return 8;
}

export function chapter6Continuation<T extends StatusPartner>(partner: T): {
  canContinue: true;
  seminarSlotsConfirmedAt?: string;
  seminarSlotAssignments: SeminarMoveAssignment[];
} {
  return {
    canContinue: true,
    seminarSlotsConfirmedAt: partnerConfirmation(partner) || undefined,
    seminarSlotAssignments: (partner.seminarSlotAssignments ?? []).map((row) => ({
      ...row,
    })),
  };
}

function partnerConfirmation(partner: StatusPartner): string | null | undefined {
  return (partner as { seminarSlotsConfirmedAt?: string | null }).seminarSlotsConfirmedAt;
}

function seminarById(
  events: readonly SeminarEvent[],
  eventId: string,
  seminarId: string
) {
  const event = events.find((row) => row.id === eventId);
  const seminar = event?.seminars?.find((row) => row?.id === seminarId) ?? null;
  return { event, seminar };
}

export function seminarChapterStatus(
  partner: StatusPartner,
  events: readonly SeminarEvent[]
): SeminarChapterEventStatus[] {
  const eventIds = new Set<string>([
    ...(partner.eventPartnerships ?? []).map((row) => row.eventId),
    ...(partner.seminarSlotAssignments ?? []).map((row) => row.eventId),
  ]);
  const groups: SeminarChapterEventStatus[] = [];
  for (const eventId of eventIds) {
    const partnership = partner.eventPartnerships?.find((row) => row.eventId === eventId);
    const summary = seminarSelectionSummary({
      seminarSlotCount: partnership?.seminarSlotCount ?? 0,
      assignments: partner.seminarSlotAssignments,
      eventId,
    });
    const topics = (partner.seminarSlotAssignments ?? [])
      .filter((row) => row.eventId === eventId && row.slots > 0)
      .map((row) => {
        const { seminar } = seminarById(events, eventId, row.seminarId);
        return {
          eventId,
          seminarId: row.seminarId,
          title: seminar?.title?.trim() || row.seminarTitle?.trim() || row.seminarId,
          date: seminar?.date ?? null,
          startTime: seminar?.startTime?.trim() || null,
          endTime: seminar?.endTime?.trim() || null,
          hall: seminar?.hall ?? null,
          slots: row.slots,
          status: row.confirmedAt?.trim()
            ? ("Confirmed" as const)
            : ("Pending Partner Confirmation" as const),
        };
      });
    if (summary.allocated <= 0 && topics.length === 0) continue;
    const { event } = seminarById(events, eventId, "");
    groups.push({
      eventId,
      title: event?.title?.trim() || eventId,
      allocated: summary.allocated,
      selected: summary.selected,
      remaining: summary.remaining,
      topics,
    });
  }
  return groups;
}

export function assignmentConfirmationLabel(
  confirmedAt?: string | null
): AdminSeminarConfirmationLabel {
  return confirmedAt?.trim() ? "Confirmed" : "Pending Confirmation";
}

export type EligibleDestination = {
  seminarId: string;
  title: string;
  remainingCapacity: number;
};

export function eligibleReassignmentDestinations(input: {
  partner: StatusPartner & { id: string };
  events: readonly SeminarEvent[];
  partners: readonly {
    id: string;
    seminarSlotAssignments?: readonly { eventId?: string; seminarId: string; slots: number }[] | null;
  }[];
  eventId: string;
  seminarId: string;
}): EligibleDestination[] {
  const event = input.events.find((row) => row.id === input.eventId);
  const held = new Set(
    (input.partner.seminarSlotAssignments ?? [])
      .filter((row) => row.eventId === input.eventId && row.slots > 0)
      .map((row) => row.seminarId)
  );
  const others = occupancyBySeminar(
    input.partners.map((row) => ({
      id: row.id,
      seminarSlotAssignments: (row.seminarSlotAssignments ?? []).map((assignment) => ({
        eventId: assignment.eventId ?? "",
        seminarId: assignment.seminarId,
        slots: assignment.slots,
      })),
    })),
    input.partner.id
  );
  const destinations: EligibleDestination[] = [];
  for (const seminar of event?.seminars ?? []) {
    if (!seminar || seminar.id === input.seminarId) continue;
    if (held.has(seminar.id)) continue;
    if (!isSeminarAvailableForPartnerAllocation(seminar.panelistSlots)) continue;
    const remaining = seminar.panelistSlots - (others.get(seminar.id) ?? 0);
    if (remaining < 1) continue;
    destinations.push({
      seminarId: seminar.id,
      title: seminar.title?.trim() || seminar.id,
      remainingCapacity: remaining,
    });
  }
  return destinations;
}

export type SeminarAdminPlan =
  | {
      ok: true;
      assignments: SeminarMoveAssignment[];
      seminarSlotsConfirmedAt?: string | null;
    }
  | { ok: false; status: number; error: string };

function sourceAssignment(partner: StatusPartner, eventId: string, seminarId: string) {
  return (partner.seminarSlotAssignments ?? []).find(
    (row) => row.eventId === eventId && row.seminarId === seminarId && row.slots > 0
  );
}

export function planAdminSeminarMove(input: {
  partner: StatusPartner & { id: string };
  events: readonly SeminarEvent[];
  partners: readonly { id: string; seminarSlotAssignments?: readonly { seminarId: string; slots: number; eventId?: string }[] | null }[];
  eventId: string;
  seminarId: string;
  destinationSeminarId: string;
  now: string;
}): SeminarAdminPlan {
  const source = sourceAssignment(input.partner, input.eventId, input.seminarId);
  if (!source) {
    return { ok: false, status: 404, error: SEMINAR_ASSIGNMENT_NOT_FOUND };
  }
  if (!seminarAssignmentCanBeReassigned(source.slots)) {
    return { ok: false, status: 400, error: LEGACY_STACKED_ASSIGNMENT_MOVE };
  }
  if (input.destinationSeminarId === input.seminarId) {
    return { ok: false, status: 400, error: SEMINAR_MOVE_SAME_TOPIC };
  }
  if (
    sourceAssignment(input.partner, input.eventId, input.destinationSeminarId)
  ) {
    return { ok: false, status: 400, error: SEMINAR_DUPLICATE_TOPIC };
  }

  const { event, seminar } = seminarById(
    input.events,
    input.eventId,
    input.destinationSeminarId
  );
  if (!event || !seminar) {
    return { ok: false, status: 400, error: SEMINAR_WRONG_EVENT };
  }
  if (seminar.panelistSlots == null) {
    return { ok: false, status: 400, error: SEMINAR_CAPACITY_NOT_DECIDED };
  }
  if (seminar.panelistSlots === 0) {
    return { ok: false, status: 400, error: SEMINAR_CAPACITY_ZERO };
  }
  if (!isSeminarAvailableForPartnerAllocation(seminar.panelistSlots)) {
    return { ok: false, status: 400, error: SEMINAR_CAPACITY_NOT_DECIDED };
  }
  const others = occupancyBySeminar(
    input.partners.map((row) => ({
      id: row.id,
      seminarSlotAssignments: (row.seminarSlotAssignments ?? []).map((assignment) => ({
        eventId: assignment.eventId ?? "",
        seminarId: assignment.seminarId,
        slots: assignment.slots,
      })),
    })),
    input.partner.id
  );
  if ((others.get(seminar.id) ?? 0) + occupiedSeatCount(1) > seminar.panelistSlots) {
    return { ok: false, status: 409, error: SEMINAR_FULL };
  }

  const confirmed = Boolean(source.confirmedAt?.trim());
  const destination: SeminarMoveAssignment = {
    eventId: input.eventId,
    seminarId: seminar.id,
    slots: 1,
    seminarTitle: seminar.title?.trim() || source.seminarTitle,
    confirmedAt: confirmed ? input.now : null,
  };
  const assignments = (input.partner.seminarSlotAssignments ?? [])
    .filter(
      (row) =>
        !(row.eventId === input.eventId && row.seminarId === input.seminarId)
    )
    .map((row) => ({ ...row }));
  assignments.push(destination);
  return {
    ok: true,
    assignments,
    seminarSlotsConfirmedAt: confirmed
      ? input.now
      : partnerConfirmation(input.partner),
  };
}

export function planAdminSeminarRemoval(input: {
  partner: StatusPartner;
  eventId: string;
  seminarId: string;
}): SeminarAdminPlan {
  const source = sourceAssignment(input.partner, input.eventId, input.seminarId);
  if (!source) {
    return { ok: false, status: 404, error: SEMINAR_ASSIGNMENT_NOT_FOUND };
  }
  return {
    ok: true,
    assignments: (input.partner.seminarSlotAssignments ?? [])
      .filter(
        (row) =>
          !(row.eventId === input.eventId && row.seminarId === input.seminarId)
      )
      .map((row) => ({ ...row })),
    seminarSlotsConfirmedAt: partnerConfirmation(input.partner),
  };
}

export function partnerOwnsRosterSpeaker(
  speaker: SeminarSpeaker | null | undefined,
  partnerId: string
): boolean {
  if (!speaker || !partnerId) return false;
  if (speaker.partnerId === partnerId) return true;
  return speaker.id.startsWith(`partner-seat-${partnerId}-`);
}

export function rosterWithoutPartnerSeats(
  roster: SeminarSessionRoster,
  partnerId: string
): SeminarSessionRoster {
  return {
    ...roster,
    moderator: partnerOwnsRosterSpeaker(roster.moderator, partnerId)
      ? null
      : roster.moderator,
    panelists: roster.panelists.filter(
      (speaker) => !partnerOwnsRosterSpeaker(speaker, partnerId)
    ),
  };
}
