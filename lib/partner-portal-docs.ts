import type {
  Partner,
  PartnerPortalDocument,
  PartnerRepresentativesSubmission,
  PartnerSeminarSlotAssignment,
} from "@/types";

import { resolveEventPartnerships } from "@/lib/partner-event-config";
import {
  isPartnerSpeakerComplete,
  partnerPortalSubmissionEntitlements,
  type PortalSubmissionKey as EntitlementSubmissionKey,
} from "@/lib/portal-entitlements";
import type { PanelSessionView } from "@/lib/partner-pending-state";

/** View Docs lists people who were actually submitted, never blank slots. */
export function representativesShownInViewDocs<
  T extends { name: string; designation?: string; phone: string },
>(people: T[]): T[] {
  return people.filter((person) =>
    Boolean(
      person.name.trim() || person.designation?.trim() || person.phone.trim()
    )
  );
}

function sessionsFromAssignments(
  partner: Pick<Partner, "seminarSlotAssignments">
): PanelSessionView[] {
  return (partner.seminarSlotAssignments ?? [])
    .filter((assignment) => assignment.slots > 0)
    .map((assignment) => ({
      eventId: assignment.eventId,
      seminarId: assignment.seminarId,
      topic:
        assignment.seminarTitle?.trim() ||
        assignment.seminarId,
      dateLabel: null,
      timeLabel: null,
      hallLabel: null,
    }));
}

/**
 * Normalize portal reps from Partner Portal (per-event array) or legacy
 * single-object shape still present on older Admin records.
 */
export function normalizePortalRepresentatives(
  raw: Partner["portalRepresentatives"] | PartnerRepresentativesSubmission | unknown,
  eventIds: string[] = []
): PartnerRepresentativesSubmission[] {
  if (raw == null) return [];

  if (Array.isArray(raw)) {
    return raw
      .map((item): PartnerRepresentativesSubmission | null => {
        const row = item as Partial<PartnerRepresentativesSubmission>;
        const eventId = typeof row.eventId === "string" ? row.eventId : "";
        if (!eventId) return null;
        return {
          eventId,
          count: Math.max(0, Math.floor(Number(row.count) || 0)),
          representatives: Array.isArray(row.representatives)
            ? row.representatives.map((r) => ({
                name: typeof r?.name === "string" ? r.name : "",
                designation:
                  typeof r?.designation === "string" ? r.designation : "",
                phone: typeof r?.phone === "string" ? r.phone : "",
              }))
            : [],
          updatedAt:
            typeof row.updatedAt === "string"
              ? row.updatedAt
              : new Date().toISOString(),
        };
      })
      .filter((r): r is PartnerRepresentativesSubmission => r !== null);
  }

  if (typeof raw === "object") {
    const legacy = raw as Partial<PartnerRepresentativesSubmission>;
    const eventId =
      typeof legacy.eventId === "string" && legacy.eventId
        ? legacy.eventId
        : eventIds[0] ?? "";
    if (!eventId) return [];
    return [
      {
        eventId,
        count: Math.max(0, Math.floor(Number(legacy.count) || 0)),
        representatives: Array.isArray(legacy.representatives)
          ? legacy.representatives.map((r) => ({
              name: typeof r?.name === "string" ? r.name : "",
              designation:
                typeof r?.designation === "string" ? r.designation : "",
              phone: typeof r?.phone === "string" ? r.phone : "",
            }))
          : [],
        updatedAt:
          typeof legacy.updatedAt === "string"
            ? legacy.updatedAt
            : new Date().toISOString(),
      },
    ];
  }

  return [];
}

/** Seven items partners must complete — logo lives in dashboard hero, not this list */
export const PORTAL_SUBMISSION_ITEMS = [
  {
    key: "fascia_name" as const,
    label: "Fascia Name (Name on the Stall Board)",
    type: "text" as const,
  },
  {
    key: "website_link" as const,
    label: "University Website link",
    type: "url" as const,
  },
  {
    key: "souvenir_writeup" as const,
    label: "Full page write up in event souvenir",
    type: "file" as const,
    docKind: "souvenir_writeup" as const,
    accept: ".pdf,.doc,.docx",
  },
  {
    key: "ad_creative" as const,
    label: "Advertisement creative",
    type: "file" as const,
    docKind: "ad_creative" as const,
    accept: "image/*,.pdf",
  },
  {
    key: "sms_content" as const,
    label: "SMS content (for mailer campaigns to all participants)",
    type: "textarea" as const,
  },
  {
    key: "speaker_details" as const,
    label: "Speaker details for each panel discussion",
    type: "speakers" as const,
  },
  {
    key: "representatives" as const,
    label: "Event Representatives",
    type: "representatives" as const,
  },
] as const;

export type PortalSubmissionKey = (typeof PORTAL_SUBMISSION_ITEMS)[number]["key"];

export type PortalSubmissionChecklistItem = {
  key: PortalSubmissionKey | "logo";
  label: string;
  complete: boolean;
  /** @deprecated use complete */
  uploaded: boolean;
  kind: "text" | "url" | "file" | "textarea" | "speakers" | "logo" | "representatives";
  file?: PartnerPortalDocument;
};

export type PartnerPortalUploadStatus = {
  checklist: PortalSubmissionChecklistItem[];
  allComplete: boolean;
  /** @deprecated use allComplete */
  allUploaded: boolean;
  missing: PortalSubmissionChecklistItem[];
  lastUpdatedAt: string | null;
  /** @deprecated use lastUpdatedAt */
  lastUploadedAt: string | null;
  daysSinceLastUpdate: number | null;
  /** @deprecated use daysSinceLastUpdate */
  daysSinceLastUpload: number | null;
  showReminderChip: boolean;
};

function startOfDayMs(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function daysBetween(fromIso: string, to: Date = new Date()): number {
  const from = new Date(fromIso);
  if (Number.isNaN(from.getTime())) return 0;
  const diff = startOfDayMs(to) - startOfDayMs(from);
  return Math.max(0, Math.floor(diff / 86_400_000));
}

const REMINDER_CHIP_AFTER_DAYS = 3;

function findDoc(
  docs: PartnerPortalDocument[],
  kind: PartnerPortalDocument["kind"]
) {
  return docs.find((d) => d.kind === kind || (kind === "souvenir_writeup" && d.kind === "writeup"));
}

export function arePortalSpeakerDetailsComplete(
  partner: Pick<
    Partner,
    | "portalSeminarSpeakers"
    | "seminarSlotAssignments"
    | "eventPartnerships"
    | "eventIds"
    | "deliverables"
    | "sponsorshipTier"
  >
): boolean {
  const entitlements = partnerPortalSubmissionEntitlements({
    partnerships: resolveEventPartnerships(partner as Partner).map((row) => ({
      eventId: row.eventId,
      deliverables: row.deliverables ?? [],
      representativeSlotCount: row.representativeSlotCount,
      seminarSlotCount: row.seminarSlotCount,
    })),
    seminarSlotAssignments: partner.seminarSlotAssignments,
    sessions: sessionsFromAssignments(partner),
    speakers: partner.portalSeminarSpeakers,
    representatives: [],
  });
  if (!entitlements.speaker_details.applicable) return false;
  return entitlements.speaker_details.complete;
}

function checklistItemForKey(
  key: EntitlementSubmissionKey,
  partner: Pick<
    Partner,
    | "portalDocuments"
    | "portalFasciaName"
    | "portalWebsiteUrl"
    | "portalSmsContent"
  >,
  entitlements: ReturnType<typeof partnerPortalSubmissionEntitlements>
): PortalSubmissionChecklistItem | null {
  const entitlement = entitlements[key];
  if (!entitlement.applicable) return null;

  const docs = partner.portalDocuments ?? [];

  if (key === "logo") {
    const logoDoc = findDoc(docs, "logo");
    return {
      key: "logo",
      label: "University Logo",
      complete: entitlement.complete,
      uploaded: entitlement.complete,
      kind: "logo",
      file: logoDoc,
    };
  }
  if (key === "fascia_name") {
    return {
      key: "fascia_name",
      label: "Fascia Name (Name on the Stall Board)",
      complete: entitlement.complete,
      uploaded: entitlement.complete,
      kind: "text",
    };
  }
  if (key === "website_link") {
    return {
      key: "website_link",
      label: "University Website link",
      complete: entitlement.complete,
      uploaded: entitlement.complete,
      kind: "url",
    };
  }
  if (key === "souvenir_writeup") {
    const writeupDoc = findDoc(docs, "souvenir_writeup");
    return {
      key: "souvenir_writeup",
      label: "Full page write up in event souvenir",
      complete: entitlement.complete,
      uploaded: entitlement.complete,
      kind: "file",
      file: writeupDoc,
    };
  }
  if (key === "ad_creative") {
    const adDoc = findDoc(docs, "ad_creative");
    return {
      key: "ad_creative",
      label: "Advertisement creative",
      complete: entitlement.complete,
      uploaded: entitlement.complete,
      kind: "file",
      file: adDoc,
    };
  }
  if (key === "sms_content") {
    return {
      key: "sms_content",
      label: "SMS content (for mailer campaigns to all participants)",
      complete: entitlement.complete,
      uploaded: entitlement.complete,
      kind: "textarea",
    };
  }
  if (key === "speaker_details") {
    return {
      key: "speaker_details",
      label: "Speaker details for each panel discussion",
      complete: entitlement.complete,
      uploaded: entitlement.complete,
      kind: "speakers",
    };
  }
  return {
    key: "representatives",
    label: "Event Representatives",
    complete: entitlement.complete,
    uploaded: entitlement.complete,
    kind: "representatives",
  };
}

export function getPartnerPortalUploadStatus(
  partner: Pick<
    Partner,
    | "portalDocuments"
    | "portalInviteSentAt"
    | "portalFasciaName"
    | "portalWebsiteUrl"
    | "portalSmsContent"
    | "portalSeminarSpeakers"
    | "portalRepresentatives"
    | "seminarSlotAssignments"
    | "eventIds"
    | "eventPartnerships"
    | "deliverables"
    | "sponsorshipTier"
  >
): PartnerPortalUploadStatus {
  const docs = partner.portalDocuments ?? [];
  const partnerships = resolveEventPartnerships(partner as Partner);
  const sessions = sessionsFromAssignments(partner);
  const entitlements = partnerPortalSubmissionEntitlements({
    partnerships: partnerships.map((row) => ({
      eventId: row.eventId,
      deliverables: row.deliverables ?? [],
      representativeSlotCount: row.representativeSlotCount,
      seminarSlotCount: row.seminarSlotCount,
    })),
    seminarSlotAssignments: partner.seminarSlotAssignments,
    sessions,
    portalFasciaName: partner.portalFasciaName,
    portalWebsiteUrl: partner.portalWebsiteUrl,
    portalSmsContent: partner.portalSmsContent,
    documents: docs,
    speakers: partner.portalSeminarSpeakers,
    representatives: partner.portalRepresentatives,
  });

  const checklist = (
    [
      "logo",
      "fascia_name",
      "website_link",
      "souvenir_writeup",
      "ad_creative",
      "sms_content",
      "speaker_details",
      "representatives",
    ] as EntitlementSubmissionKey[]
  )
    .map((key) => checklistItemForKey(key, partner, entitlements))
    .filter((item): item is PortalSubmissionChecklistItem => item !== null);

  const eventIds =
    partner.eventIds?.length > 0
      ? partner.eventIds
      : [
          ...new Set(
            (partner.seminarSlotAssignments ?? []).map((a) => a.eventId)
          ),
        ];
  const repRows = normalizePortalRepresentatives(
    partner.portalRepresentatives,
    eventIds
  );

  const missing = checklist.filter((c) => !c.complete);

  const timestamps: string[] = [];
  for (const doc of docs) timestamps.push(doc.uploadedAt);
  if (partner.portalFasciaName) timestamps.push(partner.portalInviteSentAt ?? "");
  for (const row of partner.portalSeminarSpeakers ?? []) {
    if (row.updatedAt) timestamps.push(row.updatedAt);
  }
  for (const row of repRows) {
    if (row.updatedAt) timestamps.push(row.updatedAt);
  }

  let lastUpdatedAt: string | null = null;
  for (const iso of timestamps) {
    if (!iso) continue;
    if (
      !lastUpdatedAt ||
      new Date(iso).getTime() > new Date(lastUpdatedAt).getTime()
    ) {
      lastUpdatedAt = iso;
    }
  }

  const referenceDate = lastUpdatedAt ?? partner.portalInviteSentAt ?? null;
  const daysSinceLastUpdate = referenceDate
    ? daysBetween(referenceDate)
    : null;

  const showReminderChip =
    missing.length > 0 &&
    daysSinceLastUpdate != null &&
    daysSinceLastUpdate >= REMINDER_CHIP_AFTER_DAYS;

  return {
    checklist,
    allComplete: missing.length === 0,
    allUploaded: missing.length === 0,
    missing,
    lastUpdatedAt,
    lastUploadedAt: lastUpdatedAt,
    daysSinceLastUpdate,
    daysSinceLastUpload: daysSinceLastUpdate,
    showReminderChip,
  };
}

/** @deprecated use allComplete */
export const getPartnerPortalUploadProgress = (
  status: PartnerPortalUploadStatus
) => {
  const total = status.checklist.length;
  const uploaded = total - status.missing.length;
  return {
    uploaded,
    total,
    ratio: total === 0 ? 0 : uploaded / total,
  };
};

export function formatDaysSinceUploadChip(
  status: PartnerPortalUploadStatus
): string | null {
  if (!status.showReminderChip || status.daysSinceLastUpdate == null) {
    return null;
  }
  const n = status.daysSinceLastUpdate;
  return n === 1 ? "1 day since last update" : `${n} days since last update`;
}

/** Legacy alias for admin components still importing REQUIRED_PORTAL_DOCUMENTS */
export const REQUIRED_PORTAL_DOCUMENTS = PORTAL_SUBMISSION_ITEMS.filter(
  (item) => item.type === "file"
).map((item) => ({
  kind: item.docKind!,
  label: item.label,
}));

export type PortalDocChecklistItem = {
  kind: PartnerPortalDocument["kind"];
  label: string;
  uploaded: boolean;
  file?: PartnerPortalDocument;
};
