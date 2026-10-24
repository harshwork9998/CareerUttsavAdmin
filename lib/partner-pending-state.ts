import { isValidIndianMobile } from "@/lib/indian-mobile";
import type {
  Partner,
  PartnerDeliverable,
  PartnerEventPartnership,
  PartnerPortalDocument,
  PartnerRepresentativesSubmission,
  PartnerSeminarSpeakerDetail,
  PartnerSeminarSpeakerSubmission,
  PartnerSeminarSlotAssignment,
} from "@/types";

export type PendingItem = {
  key: string;
  label: string;
  section?: string;
};

export type ReadinessStatus = "Complete" | "Not Applicable" | "Confirmed";

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

export type PendingPartnershipInput = {
  eventId: string;
  eventTitle?: string;
  deliverables: PartnerDeliverable[];
  representativeSlotCount: number;
  sessions: PanelSessionView[];
  portalFasciaName?: string | null;
  portalWebsiteUrl?: string | null;
  portalSmsContent?: string | null;
  documents?: Array<Pick<PartnerPortalDocument, "kind">> | null;
  speakers?: PartnerSeminarSpeakerSubmission[] | null;
  representatives?: PartnerRepresentativesSubmission[] | null;
};

const PLUS2_AD_KEY = "bookAdCareersAfterPlus2";

function included(
  deliverables: PartnerDeliverable[],
  key: string
): PartnerDeliverable | undefined {
  return deliverables.find(
    (item) => item.included && !item.isCustom && item.key === key
  );
}

function hasDoc(
  documents: PendingPartnershipInput["documents"],
  kind: PartnerPortalDocument["kind"]
): boolean {
  return (documents ?? []).some(
    (doc) =>
      doc.kind === kind || (kind === "souvenir_writeup" && doc.kind === "writeup")
  );
}

export function isPartnerSpeakerComplete(
  speaker: Partial<PartnerSeminarSpeakerDetail> | null | undefined
): boolean {
  if (!speaker) return false;
  const contact = speaker.contact ?? speaker.phone ?? "";
  return Boolean(
    speaker.name?.trim() &&
      speaker.designation?.trim() &&
      speaker.introduction?.trim() &&
      speaker.photoUrl?.trim() &&
      isValidIndianMobile(contact)
  );
}

export function isValidRepresentative(person: {
  name?: string;
  designation?: string;
  phone?: string;
}): boolean {
  return Boolean(
    person.name?.trim() &&
      person.designation?.trim() &&
      isValidIndianMobile(person.phone ?? "")
  );
}

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

function plus2AdApplicable(deliverables: PartnerDeliverable[]): boolean {
  const ad = included(deliverables, PLUS2_AD_KEY);
  if (!ad) return false;
  const option = ad.option?.trim().toLowerCase() ?? "";
  if (!option) return true;
  return option === "full page" || option === "half page";
}

function representativePending(input: PendingPartnershipInput): boolean {
  if (input.representativeSlotCount <= 0) return false;
  const row = (input.representatives ?? []).find(
    (item) => item.eventId === input.eventId
  );
  const valid = (row?.representatives ?? []).filter((person) =>
    isValidRepresentative(person)
  );
  return valid.length === 0;
}

export function pendingItemsForPartnership(
  input: PendingPartnershipInput
): PendingItem[] {
  const items: PendingItem[] = [];
  const deliverables = input.deliverables ?? [];
  const eventSuffix = input.eventTitle ? ` (${input.eventTitle})` : "";

  if (
    (included(deliverables, "stallSize") ||
      included(deliverables, "commonBranding")) &&
    !input.portalFasciaName?.trim()
  ) {
    items.push({
      key: "fascia_name",
      label: "Fascia name",
      section: "profile",
    });
  }

  if (included(deliverables, "weblink") && !input.portalWebsiteUrl?.trim()) {
    items.push({
      key: "website_link",
      label: "University website link",
      section: "profile",
    });
  }

  if (
    (included(deliverables, "logoB2C") ||
      included(deliverables, "commonBranding") ||
      included(deliverables, "stallLogoPositioning")) &&
    !hasDoc(input.documents, "logo")
  ) {
    items.push({
      key: "logo",
      label: "University logo",
      section: "branding",
    });
  }

  if (
    included(deliverables, "fullPageWriteup") &&
    !hasDoc(input.documents, "souvenir_writeup")
  ) {
    items.push({
      key: "souvenir_writeup",
      label: "Full page write-up in the event souvenir",
      section: "branding",
    });
  }

  if (plus2AdApplicable(deliverables) && !hasDoc(input.documents, "ad_creative")) {
    items.push({
      key: "ad_creative",
      label: "Careers After +2 advertisement",
      section: "branding",
    });
  }

  if (
    included(deliverables, "smsMailerCampaign") &&
    !input.portalSmsContent?.trim()
  ) {
    items.push({
      key: "sms_content",
      label: "SMS content",
      section: "sms",
    });
  }

  for (const session of input.sessions) {
    if (sessionComplete(input, session)) continue;
    items.push({
      key: `speaker:${session.eventId}:${session.seminarId}`,
      label: `Speaker details — ${session.topic}`,
      section: "speakers",
    });
  }

  if (representativePending(input)) {
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
  completeStatus: ReadinessStatus
): ReadinessStatus {
  return applicable ? completeStatus : "Not Applicable";
}

export function readinessLinesForPartnership(
  input: PendingPartnershipInput
): ReadinessLine[] {
  const deliverables = input.deliverables ?? [];
  const institutionApplicable = Boolean(
    included(deliverables, "stallSize") ||
      included(deliverables, "commonBranding") ||
      included(deliverables, "weblink")
  );
  const brandingApplicable = Boolean(
    included(deliverables, "logoB2C") ||
      included(deliverables, "commonBranding") ||
      included(deliverables, "stallLogoPositioning") ||
      included(deliverables, "fullPageWriteup") ||
      plus2AdApplicable(deliverables)
  );
  const otherApplicable = Boolean(included(deliverables, "smsMailerCampaign"));
  const panelApplicable = input.sessions.length > 0;
  const speakersApplicable = input.sessions.length > 0;
  const representativesApplicable = input.representativeSlotCount > 0;

  return [
    {
      label: "Institution information",
      status: groupStatus(institutionApplicable, "Complete"),
    },
    {
      label: "Branding & collaterals",
      status: groupStatus(brandingApplicable, "Complete"),
    },
    {
      label: "Panel Discussion",
      status: panelApplicable ? "Confirmed" : "Not Applicable",
    },
    {
      label: "Speaker details",
      status: groupStatus(speakersApplicable, "Complete"),
    },
    {
      label: "Event representatives",
      status: groupStatus(representativesApplicable, "Complete"),
    },
    {
      label: "Other applicable deliverables",
      status: groupStatus(otherApplicable, "Complete"),
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
