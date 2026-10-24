import {
  PARTNER_COMMUNICATION_TYPES,
  type PartnerCommunicationTrigger,
  type PartnerCommunicationType,
} from "@/lib/partner-communication-policy";

export const COMMUNICATION_NAMES: Record<PartnerCommunicationType, string> = {
  PENDING_ACTIONS_REMINDER: "Pending Actions Reminder",
  PANEL_DISCUSSION_DETAILS: "Panel Discussion Details",
  SPEAKER_DETAILS_REQUEST: "Speaker Details Request",
  SPEAKER_DETAILS_RECEIVED: "Speaker Details Received",
  PARTICIPATION_READINESS: "Participation Readiness Confirmation",
};

const REMINDER_TYPES = new Set<PartnerCommunicationType>([
  "PENDING_ACTIONS_REMINDER",
  "PANEL_DISCUSSION_DETAILS",
  "SPEAKER_DETAILS_REQUEST",
]);

const PENDING_LABEL_BY_KEY: Record<string, string> = {
  logo: "University logo",
  website_link: "University website link",
  fascia_name: "Fascia name",
  souvenir_writeup: "Full page write-up in the event souvenir",
  ad_creative: "Careers After +2 advertisement",
  sms_content: "SMS content",
};

const KNOWN_TYPES = new Set<string>(PARTNER_COMMUNICATION_TYPES);

export type CommunicationHistorySource = {
  id: string;
  communicationType: string;
  triggerType: string;
  sentAt: string;
  outcome: string;
  recipientEmail?: string | null;
  metadata?: {
    pendingKeys?: string[];
    pendingLabels?: string[];
    seminarIds?: string[];
  } | null;
};

export type CommunicationHistoryItem = {
  id: string;
  communicationType: PartnerCommunicationType;
  name: string;
  sentAt: string;
  sentAtLabel: string;
  triggerType: PartnerCommunicationTrigger;
  triggerLabel: "Automatic" | "Manual";
  recipientEmail: string;
  status: "Sent";
  pendingItems?: string[];
};

export type CommunicationLastReminder = {
  sentAt: string;
  sentAtLabel: string;
  triggerLabel: "Automatic" | "Manual";
};

function part(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
): string {
  return parts.find((item) => item.type === type)?.value ?? "";
}

/** Asia/Kolkata wall time, for example "24 Oct 2026, 11:30 AM". */
export function formatCommunicationSentAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
  }).formatToParts(date);
  const dayPeriod = part(parts, "dayPeriod").replace(/\s/g, "").toUpperCase();
  return `${part(parts, "day")} ${part(parts, "month")} ${part(parts, "year")}, ${part(parts, "hour")}:${part(parts, "minute")} ${dayPeriod}`;
}

function cleanList(values: string[] | undefined): string[] {
  return (values ?? []).filter((value) => typeof value === "string" && value.trim());
}

function pendingItemsFor(entry: CommunicationHistorySource): string[] | undefined {
  if (entry.communicationType !== "PENDING_ACTIONS_REMINDER") return undefined;
  const labels = cleanList(entry.metadata?.pendingLabels);
  if (labels.length > 0) return labels;
  const keys = cleanList(entry.metadata?.pendingKeys);
  if (keys.length === 0) return undefined;
  return keys.map((key) => {
    if (PENDING_LABEL_BY_KEY[key]) return PENDING_LABEL_BY_KEY[key];
    if (key.startsWith("speaker:")) return "Speaker details";
    if (key.startsWith("representatives:")) return "Event representatives";
    return key;
  });
}

function isTrigger(value: string): value is PartnerCommunicationTrigger {
  return value === "AUTOMATIC" || value === "MANUAL";
}

export function presentCommunicationHistory(
  entries: CommunicationHistorySource[]
): CommunicationHistoryItem[] {
  return entries
    .filter((entry) => entry.outcome === "accepted")
    .filter((entry) => KNOWN_TYPES.has(entry.communicationType))
    .filter((entry) => isTrigger(entry.triggerType))
    .map((entry) => {
      const communicationType = entry.communicationType as PartnerCommunicationType;
      const triggerType = entry.triggerType as PartnerCommunicationTrigger;
      const pendingItems = pendingItemsFor(entry);
      return {
        id: entry.id,
        communicationType,
        name: COMMUNICATION_NAMES[communicationType],
        sentAt: entry.sentAt,
        sentAtLabel: formatCommunicationSentAt(entry.sentAt),
        triggerType,
        triggerLabel: (triggerType === "AUTOMATIC" ? "Automatic" : "Manual") as
          | "Automatic"
          | "Manual",
        recipientEmail: entry.recipientEmail?.trim() ?? "",
        status: "Sent" as const,
        ...(pendingItems ? { pendingItems } : {}),
      };
    })
    .sort(
      (left, right) =>
        Date.parse(right.sentAt) - Date.parse(left.sentAt) ||
        right.id.localeCompare(left.id)
    );
}

export function lastReminderIndicator(
  entries: CommunicationHistorySource[]
): CommunicationLastReminder | null {
  const latest = presentCommunicationHistory(entries).find((item) =>
    REMINDER_TYPES.has(item.communicationType)
  );
  if (!latest) return null;
  return {
    sentAt: latest.sentAt,
    sentAtLabel: latest.sentAtLabel,
    triggerLabel: latest.triggerLabel,
  };
}
