import { seminarTopicWorkflowForEvent } from "@/lib/seminar-topic-completion";
import {
  isPartnerSpeakerComplete,
  isValidRepresentative,
  partnershipSubmissionEntitlements,
  representativesCompleteForEvent,
  seminarPanelApplicable,
  type PartnershipEntitlementInput,
} from "@/lib/portal-entitlements";
import type {
  Partner,
  PartnerEventPartnership,
  PartnerSeminarSlotAssignment,
} from "@/types";

export type PendingItem = {
  key: string;
  label: string;
  section?: string;
};

export type ReadinessStatus =
  | "Complete"
  | "Not Applicable"
  | "Confirmed"
  | "Pending"
  | "Pending Confirmation";

export type ReadinessLine = {
  label: string;
  status: ReadinessStatus;
};

export type PanelSessionView = {
  eventId: string;
  seminarId: string;
  topic: string;
  dateLabel: string | null;
  timeLabel: string | null;
  hallLabel: string | null;
};

export type PendingPartnershipInput = PartnershipEntitlementInput & {
  eventTitle?: string;
};

export { isPartnerSpeakerComplete, isValidRepresentative };

function sessionComplete(
  input: PendingPartnershipInput,
  session: PanelSessionView
): boolean {
  return (input.speakers ?? []).some(
    (row) =>
      row.eventId === session.eventId &&
      row.seminarId === session.seminarId &&
      row.speakers.some((speaker) => isPartnerSpeakerComplete(speaker))
  );
}

export function pendingItemsForPartnership(
  input: PendingPartnershipInput
): PendingItem[] {
  const items: PendingItem[] = [];
  const entitlements = partnershipSubmissionEntitlements(input);
  const eventSuffix = input.eventTitle ? ` (${input.eventTitle})` : "";

  if (entitlements.logo.applicable && !entitlements.logo.complete) {
    items.push({
      key: "logo",
      label: "University logo",
      section: "branding",
    });
  }

  if (entitlements.fascia_name.applicable && !entitlements.fascia_name.complete) {
    items.push({
      key: "fascia_name",
      label: "Fascia name",
      section: "profile",
    });
  }

  if (entitlements.website_link.applicable && !entitlements.website_link.complete) {
    items.push({
      key: "website_link",
      label: "University website link",
      section: "profile",
    });
  }

  if (
    entitlements.souvenir_writeup.applicable &&
    !entitlements.souvenir_writeup.complete
  ) {
    items.push({
      key: "souvenir_writeup",
      label: "Full page write-up in the event souvenir",
      section: "branding",
    });
  }

  if (entitlements.ad_creative.applicable && !entitlements.ad_creative.complete) {
    items.push({
      key: "ad_creative",
      label: "Advertisement creative",
      section: "branding",
    });
  }

  if (entitlements.sms_content.applicable && !entitlements.sms_content.complete) {
    items.push({
      key: "sms_content",
      label: "SMS content",
      section: "sms",
    });
  }

  const topics = seminarTopicWorkflowForEvent({
    eventId: input.eventId,
    seminarSlotCount: input.seminarSlotCount,
    assignments: input.assignments,
  });
  if (topics.status === "selecting") {
    items.push({
      key: `topics:${input.eventId}`,
      label: `Select Panel Discussion topics (${topics.selected} of ${topics.allocated} selected)`,
      section: "topics",
    });
  } else if (topics.status === "confirming") {
    items.push({
      key: `topics-confirm:${input.eventId}`,
      label: "Confirm Panel Discussion topics",
      section: "topics",
    });
  }

  if (entitlements.speaker_details.applicable) {
    for (const session of input.sessions) {
      if (sessionComplete(input, session)) continue;
      items.push({
        key: `speaker:${session.eventId}:${session.seminarId}`,
        label: `Speaker details — ${session.topic}`,
        section: "speakers",
      });
    }
  }

  if (
    entitlements.representatives.applicable &&
    !representativesCompleteForEvent(input)
  ) {
    items.push({
      key: `representatives:${input.eventId}`,
      label: `Event representatives${eventSuffix}`,
      section: "representatives",
    });
  }

  return items;
}

function groupStatus(
  applicable: boolean,
  complete: boolean,
  confirmedStatus?: ReadinessStatus
): ReadinessStatus {
  if (!applicable) return "Not Applicable";
  if (confirmedStatus) return confirmedStatus;
  return complete ? "Complete" : "Pending";
}

export function readinessLinesForPartnership(
  input: PendingPartnershipInput
): ReadinessLine[] {
  const entitlements = partnershipSubmissionEntitlements(input);

  const institutionComplete =
    entitlements.fascia_name.complete && entitlements.website_link.complete;

  const brandingApplicable =
    entitlements.logo.applicable ||
    entitlements.souvenir_writeup.applicable ||
    entitlements.ad_creative.applicable;
  const brandingComplete =
    (!entitlements.logo.applicable || entitlements.logo.complete) &&
    (!entitlements.souvenir_writeup.applicable ||
      entitlements.souvenir_writeup.complete) &&
    (!entitlements.ad_creative.applicable || entitlements.ad_creative.complete);

  const topics = seminarTopicWorkflowForEvent({
    eventId: input.eventId,
    seminarSlotCount: input.seminarSlotCount,
    assignments: input.assignments,
  });
  const panelApplicable = seminarPanelApplicable({
    eventId: input.eventId,
    seminarSlotCount: input.seminarSlotCount,
    assignments: input.assignments,
  });
  const panelStatus: ReadinessStatus =
    !panelApplicable
      ? "Not Applicable"
      : topics.status === "selecting"
        ? "Pending"
        : topics.status === "confirming"
          ? "Pending Confirmation"
          : "Confirmed";

  const speakersApplicable = entitlements.speaker_details.applicable;
  const speakersComplete = entitlements.speaker_details.complete;

  return [
    {
      label: "Institution information",
      status: groupStatus(true, institutionComplete),
    },
    {
      label: "Branding & collaterals",
      status: groupStatus(brandingApplicable, brandingComplete),
    },
    {
      label: "Panel Discussion",
      status: panelStatus,
    },
    {
      label: "Speaker details",
      status: groupStatus(speakersApplicable, speakersComplete),
    },
    {
      label: "Event representatives",
      status: groupStatus(
        entitlements.representatives.applicable,
        entitlements.representatives.complete
      ),
    },
    {
      label: "Other applicable deliverables",
      status: groupStatus(
        entitlements.sms_content.applicable,
        entitlements.sms_content.complete
      ),
    },
  ];
}

export function dedupePendingItems(items: PendingItem[]): PendingItem[] {
  const seen = new Set<string>();
  const next: PendingItem[] = [];
  for (const item of items) {
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    next.push(item);
  }
  return next;
}

export function completedSpeakerSeminarIds(
  partner: Pick<Partner, "portalSeminarSpeakers" | "seminarSlotAssignments">,
  sessions: PanelSessionView[]
): string[] {
  return sessions
    .filter((session) =>
      (partner.portalSeminarSpeakers ?? []).some(
        (row) =>
          row.eventId === session.eventId &&
          row.seminarId === session.seminarId &&
          row.speakers.some((speaker) => isPartnerSpeakerComplete(speaker))
      )
    )
    .map((session) => session.seminarId);
}

export function allocationsFromPartner(
  partner: Pick<Partner, "seminarSlotAssignments">,
  eventId?: string
): PartnerSeminarSlotAssignment[] {
  return (partner.seminarSlotAssignments ?? []).filter(
    (assignment) =>
      assignment.slots > 0 &&
      (eventId === undefined || assignment.eventId === eventId)
  );
}

export function partnershipInputsForPartner(
  partner: Partner,
  partnerships: PartnerEventPartnership[],
  sessions: PanelSessionView[]
): PendingPartnershipInput[] {
  return partnerships.map((partnership) => ({
    eventId: partnership.eventId,
    deliverables: partnership.deliverables ?? [],
    representativeSlotCount: partnership.representativeSlotCount ?? 0,
    seminarSlotCount: partnership.seminarSlotCount,
    assignments: partner.seminarSlotAssignments,
    sessions: sessions.filter(
      (session) => session.eventId === partnership.eventId
    ),
    portalFasciaName: partner.portalFasciaName,
    portalWebsiteUrl: partner.portalWebsiteUrl,
    portalSmsContent: partner.portalSmsContent,
    documents: partner.portalDocuments,
    speakers: partner.portalSeminarSpeakers,
    representatives: partner.portalRepresentatives,
  }));
}
