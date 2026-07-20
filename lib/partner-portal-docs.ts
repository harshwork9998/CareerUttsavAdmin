import type {
  Partner,
  PartnerPortalDocument,
  PartnerPortalDocumentKind,
} from "@/types";

/** Required uploads from the Career Uttsav partner portal */
export const REQUIRED_PORTAL_DOCUMENTS: Array<{
  kind: PartnerPortalDocumentKind;
  label: string;
}> = [
  { kind: "logo", label: "Primary logo" },
  { kind: "banner", label: "Stall / venue banner" },
  { kind: "writeup", label: "Souvenir write-up" },
  { kind: "company_profile", label: "Company / institute profile" },
  { kind: "brochure", label: "Event brochure" },
  { kind: "faculty_photo", label: "Speaker / faculty photo" },
  { kind: "brand_guidelines", label: "Brand guidelines" },
  { kind: "agreement", label: "Signed agreement" },
  { kind: "tax_details", label: "GST / tax details" },
  { kind: "collateral", label: "Marketing collateral" },
];

export type PortalDocChecklistItem = {
  kind: PartnerPortalDocumentKind;
  label: string;
  uploaded: boolean;
  file?: PartnerPortalDocument;
};

export type PartnerPortalUploadStatus = {
  checklist: PortalDocChecklistItem[];
  allUploaded: boolean;
  missing: PortalDocChecklistItem[];
  /** Most recent upload timestamp, if any */
  lastUploadedAt: string | null;
  /**
   * Days since last upload (or since invite if nothing uploaded yet).
   * Null when we have no reference date.
   */
  daysSinceLastUpload: number | null;
  /**
   * Overview chip: incomplete uploads AND at least 3 days since last
   * upload (or invite if none yet).
   */
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

export function getPartnerPortalUploadStatus(
  partner: Pick<
    Partner,
    "portalDocuments" | "portalInviteSentAt" | "portalInviteEmail"
  >
): PartnerPortalUploadStatus {
  const docs = partner.portalDocuments ?? [];

  const checklist: PortalDocChecklistItem[] = REQUIRED_PORTAL_DOCUMENTS.map(
    (req) => {
      const file = docs.find((d) => d.kind === req.kind);
      return {
        kind: req.kind,
        label: req.label,
        uploaded: Boolean(file),
        file,
      };
    }
  );

  const missing = checklist.filter((c) => !c.uploaded);
  const allUploaded = missing.length === 0;

  let lastUploadedAt: string | null = null;
  for (const doc of docs) {
    if (
      !lastUploadedAt ||
      new Date(doc.uploadedAt).getTime() > new Date(lastUploadedAt).getTime()
    ) {
      lastUploadedAt = doc.uploadedAt;
    }
  }

  const referenceDate = lastUploadedAt ?? partner.portalInviteSentAt ?? null;
  const daysSinceLastUpload = referenceDate
    ? daysBetween(referenceDate)
    : null;

  const showReminderChip =
    !allUploaded &&
    daysSinceLastUpload != null &&
    daysSinceLastUpload >= REMINDER_CHIP_AFTER_DAYS;

  return {
    checklist,
    allUploaded,
    missing,
    lastUploadedAt,
    daysSinceLastUpload,
    showReminderChip,
  };
}

/** Partner overview chip label — only when showReminderChip is true. */
export function formatDaysSinceUploadChip(
  status: PartnerPortalUploadStatus
): string | null {
  if (!status.showReminderChip || status.daysSinceLastUpload == null) {
    return null;
  }
  const n = status.daysSinceLastUpload;
  return n === 1 ? "1 day since last upload" : `${n} days since last upload`;
}

export function getPartnerPortalUploadProgress(
  status: PartnerPortalUploadStatus
): { uploaded: number; total: number; ratio: number } {
  const total = status.checklist.length;
  const uploaded = total - status.missing.length;
  return {
    uploaded,
    total,
    ratio: total === 0 ? 0 : uploaded / total,
  };
}
