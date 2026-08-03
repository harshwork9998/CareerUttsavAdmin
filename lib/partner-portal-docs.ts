import type {
  Partner,
  PartnerPortalDocument,
  PartnerSeminarSlotAssignment,
} from "@/types";

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
    label: "Speaker details for each seminar",
    type: "speakers" as const,
  },
  {
    key: "representatives" as const,
    label: "Event representatives",
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

function allottedSeminars(
  assignments: PartnerSeminarSlotAssignment[] | undefined
) {
  return (assignments ?? []).filter((a) => a.slots > 0);
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
  >
): PartnerPortalUploadStatus {
  const docs = partner.portalDocuments ?? [];
  const logoDoc = findDoc(docs, "logo");
  const writeupDoc = findDoc(docs, "souvenir_writeup");
  const adDoc = findDoc(docs, "ad_creative");

  const seminars = allottedSeminars(partner.seminarSlotAssignments);
  const speakersComplete =
    seminars.length === 0 ||
    seminars.every((slot) =>
      (partner.portalSeminarSpeakers ?? []).some(
        (row) =>
          row.eventId === slot.eventId &&
          row.seminarId === slot.seminarId &&
          row.speakers.some((s) => s.name.trim())
      )
    );

  const reps = partner.portalRepresentatives;
  const representativesComplete = Boolean(
    reps &&
      reps.count >= 1 &&
      reps.representatives.length === reps.count &&
      reps.representatives.every(
        (r) =>
          r.name.trim().length > 0 && /^[6-9]\d{9}$/.test(r.phone.replace(/\D/g, "").slice(-10))
      )
  );

  const checklist: PortalSubmissionChecklistItem[] = [
    {
      key: "logo",
      label: "University Logo",
      complete: Boolean(logoDoc),
      uploaded: Boolean(logoDoc),
      kind: "logo",
      file: logoDoc,
    },
    {
      key: "fascia_name",
      label: "Fascia Name (Name on the Stall Board)",
      complete: Boolean(partner.portalFasciaName?.trim()),
      uploaded: Boolean(partner.portalFasciaName?.trim()),
      kind: "text",
    },
    {
      key: "website_link",
      label: "University Website link",
      complete: Boolean(partner.portalWebsiteUrl?.trim()),
      uploaded: Boolean(partner.portalWebsiteUrl?.trim()),
      kind: "url",
    },
    {
      key: "souvenir_writeup",
      label: "Full page write up in event souvenir",
      complete: Boolean(writeupDoc),
      uploaded: Boolean(writeupDoc),
      kind: "file",
      file: writeupDoc,
    },
    {
      key: "ad_creative",
      label: "Advertisement creative",
      complete: Boolean(adDoc),
      uploaded: Boolean(adDoc),
      kind: "file",
      file: adDoc,
    },
    {
      key: "sms_content",
      label: "SMS content (for mailer campaigns to all participants)",
      complete: Boolean(partner.portalSmsContent?.trim()),
      uploaded: Boolean(partner.portalSmsContent?.trim()),
      kind: "textarea",
    },
    {
      key: "speaker_details",
      label: "Speaker details for each seminar",
      complete: speakersComplete,
      uploaded: speakersComplete,
      kind: "speakers",
    },
    {
      key: "representatives",
      label: "Event representatives",
      complete: representativesComplete,
      uploaded: representativesComplete,
      kind: "representatives",
    },
  ];

  const missing = checklist.filter((c) => !c.complete);

  const timestamps: string[] = [];
  for (const doc of docs) timestamps.push(doc.uploadedAt);
  if (partner.portalFasciaName) timestamps.push(partner.portalInviteSentAt ?? "");
  for (const row of partner.portalSeminarSpeakers ?? []) {
    if (row.updatedAt) timestamps.push(row.updatedAt);
  }
  if (reps?.updatedAt) timestamps.push(reps.updatedAt);

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
