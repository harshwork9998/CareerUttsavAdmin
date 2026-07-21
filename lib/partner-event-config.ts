import { buildDeliverablesForTier } from "@/constants";
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
      deliverables: ep.deliverables.map((d) => ({ ...d })),
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

export function partnerMatchesTierFilter(
  partner: Partner,
  tier: string
): boolean {
  const eps = resolveEventPartnerships(partner);
  if (eps.some((ep) => getPartnershipTierLabel(ep) === tier)) return true;
  return partner.sponsorshipTier === tier;
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

export function assignedSlotsForEvent(
  assignments: Partner["seminarSlotAssignments"],
  eventId: string
): number {
  return (assignments ?? [])
    .filter((a) => a.eventId === eventId)
    .reduce((sum, a) => sum + a.slots, 0);
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
