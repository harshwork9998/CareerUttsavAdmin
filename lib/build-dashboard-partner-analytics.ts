import { SPONSORSHIP_TIERS } from "@/constants";
import { citiesMatch } from "@/lib/event-cities";
import {
  partnerMatchesEventFilter,
  resolveEventPartnerships,
} from "@/lib/partner-event-config";
import {
  getPartnershipTierLabel,
  isStandardSponsorshipTier,
} from "@/lib/partner-tier";
import type {
  Event,
  Partner,
  PartnerJourneyStage,
  PartnerLifecycleStage,
  PartnerSalesActivity,
  PartnerSalesAnalytics,
  PartnerSalesDeal,
  PartnerSalesStatus,
  SponsorshipTier,
} from "@/types";

const LIFECYCLE_STAGES: PartnerLifecycleStage[] = [
  "New",
  "Contacted",
  "Meeting Scheduled",
  "Negotiation",
  "Confirmed",
  "Not Proceeding",
];

function eventIdsForCity(events: Event[], city: string): string[] {
  return events
    .filter((event) => citiesMatch(event.city, city))
    .map((event) => event.id);
}

function filterPartnersForScope(
  partners: Partner[],
  events: Event[],
  city: string | "all"
): Partner[] {
  const catalogEventIds = events.map((event) => event.id);
  if (catalogEventIds.length === 0) {
    return [];
  }

  if (city === "all") {
    return partners.filter((partner) =>
      partnerMatchesEventFilter(partner, catalogEventIds)
    );
  }

  const scopedEventIds = eventIdsForCity(events, city);
  if (scopedEventIds.length === 0) {
    return [];
  }

  return partners.filter((partner) =>
    partnerMatchesEventFilter(partner, scopedEventIds)
  );
}

function partnerAmount(partner: Partner): number {
  return partner.netAmount ?? partner.totalAmount ?? 0;
}

function getPartnerTier(partner: Partner): SponsorshipTier | undefined {
  const partnerships = resolveEventPartnerships(partner);
  for (const partnership of partnerships) {
    const label = getPartnershipTierLabel(partnership);
    if (label && isStandardSponsorshipTier(label)) {
      return label;
    }
  }
  if (
    partner.sponsorshipTier &&
    isStandardSponsorshipTier(partner.sponsorshipTier)
  ) {
    return partner.sponsorshipTier;
  }
  return undefined;
}

function stageToStatus(stage: PartnerLifecycleStage): PartnerSalesStatus {
  if (stage === "Confirmed") return "Confirmed";
  if (stage === "Not Proceeding") return "Not Proceeding";
  return "In Discussion";
}

function partnerLastActivity(partner: Partner): string {
  const timestamps = [
    partner.updatedAt,
    partner.stageRemarks?.[0]?.createdAt,
    partner.meetings?.[0]?.updatedAt,
    partner.meetings?.[0]?.createdAt,
    partner.contactedAt,
    partner.createdAt,
  ].filter(Boolean) as string[];

  return timestamps.sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  )[0];
}

function buildDeal(partner: Partner): PartnerSalesDeal {
  const tier = getPartnerTier(partner) ?? "Stall Partner";
  const stage = partner.stage;

  return {
    id: partner.id,
    universityName: partner.name,
    tier,
    stage,
    status: stageToStatus(stage),
    value: partnerAmount(partner),
    city: partner.city,
    owner: partner.relationshipOwner.managerName || "Unassigned",
    lastActivity: partnerLastActivity(partner),
    notes:
      partner.stageRemarks?.[0]?.remark ??
      partner.sponsorshipNotes ??
      partner.meetingNotes,
  };
}

function buildRecentActivity(partners: Partner[]): PartnerSalesActivity[] {
  const items: PartnerSalesActivity[] = [];

  for (const partner of partners) {
    const tier = getPartnerTier(partner) ?? "Stall Partner";
    const value = partnerAmount(partner);

    for (const remark of partner.stageRemarks ?? []) {
      items.push({
        id: remark.id,
        title: remark.toStage,
        description: remark.remark,
        timestamp: remark.createdAt,
        universityName: partner.name,
        tier,
        stage: remark.toStage as PartnerJourneyStage,
        value,
      });
    }

    for (const meeting of partner.meetings ?? []) {
      items.push({
        id: meeting.id,
        title: "Meeting logged",
        description: meeting.notes ?? "Meeting logged",
        timestamp: meeting.updatedAt ?? meeting.createdAt,
        universityName: partner.name,
        tier,
        stage: partner.stage,
        value,
      });
    }
  }

  return items
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, 10);
}

function buildLeaderboard(partners: Partner[]) {
  const rows = new Map<
    string,
    { name: string; deals: number; won: number; value: number }
  >();

  for (const partner of partners) {
    const owner = partner.relationshipOwner.managerName?.trim() || "Unassigned";
    const prev = rows.get(owner) ?? {
      name: owner,
      deals: 0,
      won: 0,
      value: 0,
    };
    prev.deals += 1;
    if (partner.stage === "Confirmed") {
      prev.won += 1;
      prev.value += partnerAmount(partner);
    }
    rows.set(owner, prev);
  }

  return [...rows.values()]
    .filter((row) => row.name !== "Unassigned" || row.deals > 0)
    .sort((a, b) => b.value - a.value || b.deals - a.deals)
    .slice(0, 5);
}

export function buildPartnerSalesAnalytics(
  partners: Partner[],
  events: Event[],
  city: string | "all",
  eventCities: string[] = []
): PartnerSalesAnalytics {
  const filtered = filterPartnersForScope(partners, events, city);
  const deals = filtered.map(buildDeal);
  const confirmed = filtered.filter(
    (partner) => partner.stage === "Confirmed"
  ).length;
  const inDiscussion = filtered.filter(
    (partner) =>
      partner.stage !== "Confirmed" && partner.stage !== "Not Proceeding"
  ).length;
  const notProceeding = filtered.filter(
    (partner) => partner.stage === "Not Proceeding"
  ).length;

  const byStage = LIFECYCLE_STAGES.map((stage) => {
    const stagePartners = filtered.filter((partner) => partner.stage === stage);
    return {
      name: stage,
      count: stagePartners.length,
      amount: stagePartners.reduce(
        (sum, partner) => sum + partnerAmount(partner),
        0
      ),
    };
  }).filter((row) => row.count > 0);

  const tierCounts = new Map<string, number>();
  const tierAmounts = new Map<string, number>();
  for (const partner of filtered) {
    const tier = getPartnerTier(partner);
    if (!tier) continue;
    tierCounts.set(tier, (tierCounts.get(tier) ?? 0) + 1);
    tierAmounts.set(tier, (tierAmounts.get(tier) ?? 0) + partnerAmount(partner));
  }

  const byTier = SPONSORSHIP_TIERS.map((tier) => ({
    name: tier,
    value: tierCounts.get(tier) ?? 0,
    amount: tierAmounts.get(tier) ?? 0,
  })).filter((row) => row.value > 0);

  const tierProgress = SPONSORSHIP_TIERS.map((tier) => {
    const current = tierCounts.get(tier) ?? 0;
    const value = tierAmounts.get(tier) ?? 0;
    return {
      name: tier,
      current,
      target: Math.max(current + 1, Math.ceil(current * 1.25) || 1),
      value,
    };
  }).filter((row) => row.current > 0);

  const pipelineValue = filtered
    .filter((partner) => partner.stage !== "Not Proceeding")
    .reduce((sum, partner) => sum + partnerAmount(partner), 0);

  const wonValue = filtered
    .filter((partner) => partner.stage === "Confirmed")
    .reduce((sum, partner) => sum + partnerAmount(partner), 0);

  const byCity =
    city === "all"
      ? eventCities.map((eventCity) => ({
          name: eventCity,
          value: filterPartnersForScope(partners, events, eventCity).filter(
            (partner) => partner.stage === "Confirmed"
          ).length,
        })).filter((row) => row.value > 0)
      : [{ name: city, value: confirmed }];

  return {
    totalPartners: filtered.length,
    confirmed,
    inDiscussion,
    notProceeding,
    inProcess: inDiscussion,
    lost: notProceeding,
    pipelineValue,
    wonValue,
    conversionRate:
      filtered.length > 0
        ? Math.round((confirmed / filtered.length) * 1000) / 10
        : 0,
    byTier,
    byStage,
    byStatus: [
      { name: "Confirmed", value: confirmed },
      { name: "In Discussion", value: inDiscussion },
      { name: "Not Proceeding", value: notProceeding },
    ],
    byCity,
    tierProgress,
    recentActivity: buildRecentActivity(filtered),
    deals,
    leaderboard: buildLeaderboard(filtered),
  };
}
