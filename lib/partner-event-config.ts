import { buildDeliverablesForTier, normalizeDeliverableOptions } from "@/constants";
import { getPartnershipTierLabel } from "@/lib/partner-tier";
import type {
  Event,
  Partner,
  PartnerDeliverable,
  PartnerEventPartnership,
  PartnerSeminarSlotAssignment,
  SponsorshipTier,
} from "@/types";

export type EventPackageSummary = {
  eventId: string;
  title: string;
  city: string;
  tier: string | undefined;
  deliverables: Array<{ id: string; label: string; option?: string }>;
  seminars: Array<{ id: string; title: string; slots: number }>;
  slotBudget: number;
  seatsAssigned: number;
};

export function hasPartnershipTier(
  ep: Pick<PartnerEventPartnership, "sponsorshipTier" | "customTierLabel">
): boolean {
  return Boolean(ep.sponsorshipTier) || Boolean(ep.customTierLabel?.trim());
}

export function partnershipsForEventIds(
  partnerships: PartnerEventPartnership[],
  eventIds: string[]
): PartnerEventPartnership[] {
  if (eventIds.length === 0) return [];
  const idSet = new Set(eventIds);
  return partnerships.filter((ep) => idSet.has(ep.eventId));
}

export function buildEventPackageSummaries(
  eventPartnerships: PartnerEventPartnership[],
  slotAssignments: PartnerSeminarSlotAssignment[],
  events: Event[]
): EventPackageSummary[] {
  const summaries: EventPackageSummary[] = [];

  for (const ep of eventPartnerships) {
    const event = events.find((e) => e.id === ep.eventId);
    if (!event) continue;

    const seminars = slotAssignments
      .filter((a) => a.eventId === ep.eventId && a.slots > 0)
      .map((a) => {
        const seminar = event.seminars.find((s) => s.id === a.seminarId);
        return {
          id: a.seminarId,
          title: a.seminarTitle ?? seminar?.title ?? a.seminarId,
          slots: a.slots,
        };
      });

    summaries.push({
      eventId: ep.eventId,
      title: event.title,
      city: event.city,
      tier: getPartnershipTierLabel(ep),
      deliverables: ep.deliverables
        .filter((d) => d.included)
        .map((d) => ({
          id: d.id,
          label: d.label,
          option: d.option,
        })),
      seminars,
      slotBudget: ep.seminarSlotCount ?? 0,
      seatsAssigned: seminars.reduce((s, row) => s + row.slots, 0),
    });
  }

  return summaries;
}

export function resolveEventPartnerships(
  partner: Partner,
  idFactory: () => string = () => `deliv-${Math.random().toString(36).slice(2, 9)}`
): PartnerEventPartnership[] {
  if (partner.eventPartnerships?.length) {
    return partner.eventPartnerships.map((ep) => ({
      ...ep,
      deliverables: normalizeDeliverableOptions(
        ep.deliverables.map((d) => ({ ...d })),
        ep.sponsorshipTier
      ),
    }));
  }

  if (!partner.eventIds.length) return [];

  const slotCountByEvent = new Map<string, number>();
  for (const a of partner.seminarSlotAssignments ?? []) {
    slotCountByEvent.set(
      a.eventId,
      (slotCountByEvent.get(a.eventId) ?? 0) + a.slots
    );
  }

  const tier = partner.sponsorshipTier;
  const baseDeliverables =
    partner.deliverables?.length && tier
      ? partner.deliverables.map((d) => ({ ...d }))
      : tier
        ? buildDeliverablesForTier(tier, idFactory)
        : [];

  return partner.eventIds.map((eventId) => ({
    eventId,
    sponsorshipTier: tier,
    deliverables: baseDeliverables.map((d) => ({ ...d, id: idFactory() })),
    seminarSlotCount: slotCountByEvent.get(eventId) ?? 0,
  }));
}

export function syncLegacyPartnerFields(
  eventPartnerships: PartnerEventPartnership[]
): Pick<Partner, "sponsorshipTier" | "deliverables" | "eventIds"> {
  const eventIds = eventPartnerships.map((ep) => ep.eventId);
  const primary = eventPartnerships[0];
  const deliverables = primary?.deliverables ?? [];

  return {
    eventIds,
    sponsorshipTier: primary?.sponsorshipTier,
    deliverables: deliverables.map((d) => ({ ...d })),
  };
}

export function allEventsHaveTier(
  eventPartnerships: PartnerEventPartnership[],
  selectedEventIds: string[]
): boolean {
  if (selectedEventIds.length === 0) return false;
  return selectedEventIds.every((eventId) => {
    const ep = eventPartnerships.find((p) => p.eventId === eventId);
    return hasPartnershipTier(ep ?? { sponsorshipTier: undefined });
  });
}

export function partnerHasEventPackages(partner: Partner): boolean {
  if (partner.eventIds.length === 0) return false;
  const eps = partnershipsForEventIds(
    resolveEventPartnerships(partner),
    partner.eventIds
  );
  return eps.length > 0 && eps.every((ep) => hasPartnershipTier(ep));
}

export function flattenDeliverables(
  eventPartnerships: PartnerEventPartnership[]
): PartnerDeliverable[] {
  return eventPartnerships.flatMap((ep) => ep.deliverables);
}

export function seminarSlotBudgetByEvent(
  eventPartnerships: PartnerEventPartnership[]
): Record<string, number> {
  return Object.fromEntries(
    eventPartnerships.map((ep) => [ep.eventId, ep.seminarSlotCount ?? 0])
  );
}

export function getPartnerDisplayTier(partner: Partner): string | undefined {
  const eps = partnershipsForEventIds(
    resolveEventPartnerships(partner),
    partner.eventIds
  );
  if (eps.length === 0) return partner.sponsorshipTier;
  const unique = [
    ...new Set(
      eps.map((ep) => getPartnershipTierLabel(ep)).filter(Boolean)
    ),
  ] as string[];
  if (unique.length === 0) return partner.sponsorshipTier;
  if (unique.length === 1) return unique[0];
  return `${unique[0]} +${unique.length - 1}`;
}

/** Tier for one event — prefers that event's package over the legacy overall tier. */
export function getPartnerTierForEvent(
  partner: Partner,
  eventId: string
): string | undefined {
  const ep = resolveEventPartnerships(partner).find(
    (row) => row.eventId === eventId
  );
  if (ep && hasPartnershipTier(ep)) {
    return getPartnershipTierLabel(ep);
  }
  return partner.sponsorshipTier;
}

export function partnerMatchesTierFilter(
  partner: Partner,
  tier: string
): boolean {
  const eps = resolveEventPartnerships(partner);
  if (eps.some((ep) => getPartnershipTierLabel(ep) === tier)) return true;
  return partner.sponsorshipTier === tier;
}

export function partnerMatchesEventFilter(
  partner: Partner,
  eventIds: string[]
): boolean {
  if (eventIds.length === 0) return true;
  return partner.eventIds.some((id) => eventIds.includes(id));
}

export function upsertEventPartnership(
  list: PartnerEventPartnership[],
  eventId: string,
  patch: Partial<PartnerEventPartnership>,
  idFactory: () => string
): PartnerEventPartnership[] {
  const idx = list.findIndex((ep) => ep.eventId === eventId);
  if (idx === -1) {
    return [
      ...list,
      {
        eventId,
        deliverables: [],
        seminarSlotCount: 0,
        ...patch,
      },
    ];
  }
  return list.map((ep, i) => (i === idx ? { ...ep, ...patch } : ep));
}

export function removeEventPartnership(
  list: PartnerEventPartnership[],
  eventId: string
): PartnerEventPartnership[] {
  return list.filter((ep) => ep.eventId !== eventId);
}

/** Drop partner links to events that no longer exist in the catalog. */
export function prunePartnerEventLinks(
  partner: Partner,
  validEventIds: Set<string>
): Partner {
  const eventIds = partner.eventIds.filter((id) => validEventIds.has(id));
  const eventPartnerships = (partner.eventPartnerships ?? []).filter((ep) =>
    validEventIds.has(ep.eventId)
  );
  const seminarSlotAssignments = (partner.seminarSlotAssignments ?? []).filter(
    (assignment) => validEventIds.has(assignment.eventId)
  );

  const hadStaleLinks =
    eventIds.length !== partner.eventIds.length ||
    eventPartnerships.length !== (partner.eventPartnerships?.length ?? 0) ||
    seminarSlotAssignments.length !==
      (partner.seminarSlotAssignments?.length ?? 0);

  if (!hadStaleLinks) {
    return partner;
  }

  const legacy = syncLegacyPartnerFields(eventPartnerships);

  return {
    ...partner,
    eventIds,
    eventPartnerships,
    seminarSlotAssignments,
    sponsorshipTier: legacy.sponsorshipTier,
    deliverables: legacy.deliverables,
    updatedAt: new Date().toISOString(),
  };
}

export function partnerNeedsEventLinkPrune(
  partner: Partner,
  validEventIds: Set<string>
): boolean {
  if (partner.eventIds.some((id) => !validEventIds.has(id))) return true;
  if (
    (partner.eventPartnerships ?? []).some((ep) => !validEventIds.has(ep.eventId))
  ) {
    return true;
  }
  if (
    (partner.seminarSlotAssignments ?? []).some(
      (assignment) => !validEventIds.has(assignment.eventId)
    )
  ) {
    return true;
  }
  return false;
}

export function assignedSlotsForEvent(
  assignments: Partner["seminarSlotAssignments"],
  eventId: string
): number {
  return (assignments ?? [])
    .filter((a) => a.eventId === eventId)
    .reduce((sum, a) => sum + a.slots, 0);
}

/**
 * Keep seminar seat picks within each event's deliverables budget.
 * Drops assignments for events with zero/missing budget; trims excess seats.
 */
export function clampSeminarSlotAssignmentsToBudget(
  assignments: PartnerSeminarSlotAssignment[],
  budgetByEvent: Record<string, number>
): PartnerSeminarSlotAssignment[] {
  const result: PartnerSeminarSlotAssignment[] = [];

  for (const [eventId, rawBudget] of Object.entries(budgetByEvent)) {
    const budget = Math.max(0, Math.floor(rawBudget ?? 0));
    if (budget <= 0) continue;

    let remaining = budget;
    for (const assignment of assignments.filter((a) => a.eventId === eventId)) {
      if (remaining <= 0) break;
      const slots = Math.min(Math.max(0, Math.floor(assignment.slots)), remaining);
      if (slots <= 0) continue;
      result.push(slots === assignment.slots ? assignment : { ...assignment, slots });
      remaining -= slots;
    }
  }

  return result;
}

export function seminarSlotAssignmentsMatchBudget(
  assignments: PartnerSeminarSlotAssignment[],
  eventPartnerships: PartnerEventPartnership[]
): boolean {
  return eventPartnerships.every(
    (ep) =>
      assignedSlotsForEvent(assignments, ep.eventId) === (ep.seminarSlotCount ?? 0)
  );
}

export function enrichSeminarSlotAssignments(
  assignments: PartnerSeminarSlotAssignment[],
  events: Event[]
): PartnerSeminarSlotAssignment[] {
  return assignments.map((a) => {
    if (a.seminarTitle?.trim()) return a;
    const event = events.find((e) => e.id === a.eventId);
    const seminar = event?.seminars.find((s) => s.id === a.seminarId);
    return seminar?.title
      ? { ...a, seminarTitle: seminar.title }
      : a;
  });
}

export function resolveSeminarTitle(
  assignment: PartnerSeminarSlotAssignment,
  events: Event[]
): string {
  if (assignment.seminarTitle?.trim()) return assignment.seminarTitle.trim();
  const event = events.find((e) => e.id === assignment.eventId);
  const seminar = event?.seminars.find((s) => s.id === assignment.seminarId);
  return seminar?.title ?? assignment.seminarId;
}

/** Attach human-readable seminar titles from the event catalog. */
export function enrichPartnerWithEventCatalog(
  partner: Partner,
  events: Event[]
): Partner {
  const assignments = partner.seminarSlotAssignments ?? [];
  if (assignments.length === 0) return partner;
  return {
    ...partner,
    seminarSlotAssignments: enrichSeminarSlotAssignments(assignments, events),
  };
}

export function enrichPartnersWithEventCatalog(
  partners: Partner[],
  events: Event[]
): Partner[] {
  return partners.map((partner) => enrichPartnerWithEventCatalog(partner, events));
}
