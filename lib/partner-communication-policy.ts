import type { Partner, PartnerEventPartnership } from "@/types";

export const PARTNER_REMINDER_INTERVAL_MS = 72 * 60 * 60 * 1000;

/** First instant of 2 December 2026 in Asia/Kolkata. Automatic reminders stop here. */
export const PARTNER_AUTOMATIC_REMINDER_DEADLINE_MS = Date.parse(
  "2026-12-02T00:00:00+05:30"
);

export const PARTNER_COMMUNICATION_TYPES = [
  "PANEL_DISCUSSION_DETAILS",
  "SPEAKER_DETAILS_REQUEST",
  "SPEAKER_DETAILS_RECEIVED",
  "PENDING_ACTIONS_REMINDER",
  "PARTICIPATION_READINESS",
] as const;

export type PartnerCommunicationType =
  (typeof PARTNER_COMMUNICATION_TYPES)[number];

export const PARTNER_MANUAL_REMINDER_TYPES = [
  "PENDING_ACTIONS_REMINDER",
  "PANEL_DISCUSSION_DETAILS",
  "SPEAKER_DETAILS_REQUEST",
] as const;

export type PartnerManualReminderType =
  (typeof PARTNER_MANUAL_REMINDER_TYPES)[number];

export type PartnerCommunicationTrigger = "AUTOMATIC" | "MANUAL";

export type ReminderAnchorInput = {
  /** When automatic partner reminders were switched on. Unset means they stay off. */
  automationEnabledAt?: string | null;
  accessSentAt?: string | null;
  lastActivityAt?: string | null;
  lastAutomaticReminderAt?: string | null;
  lastManualReminderAt?: string | null;
};

export function readPartnerCommunicationAutomationEnabledAt(
  raw = process.env.PARTNER_COMMUNICATION_AUTOMATION_ENABLED_AT
): string | null {
  const value = raw?.trim();
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return new Date(time).toISOString();
}

export function isBeforeAutomaticReminderDeadline(now: Date): boolean {
  return now.getTime() < PARTNER_AUTOMATIC_REMINDER_DEADLINE_MS;
}

export function latestTimestamp(values: Array<string | null | undefined>): Date | null {
  let latest = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (!value) continue;
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) continue;
    if (time > latest) latest = time;
  }
  return Number.isFinite(latest) ? new Date(latest) : null;
}

export function reminderAnchor(input: ReminderAnchorInput): Date | null {
  return latestTimestamp([
    input.automationEnabledAt,
    input.accessSentAt,
    input.lastActivityAt,
    input.lastAutomaticReminderAt,
    input.lastManualReminderAt,
  ]);
}

export function isAutomaticReminderEligible(input: {
  accessSent: boolean;
  accessEnabled: boolean;
  pendingCount: number;
  now: Date;
  anchor: ReminderAnchorInput;
}): boolean {
  if (!input.anchor.automationEnabledAt) return false;
  if (!input.accessSent || !input.accessEnabled) return false;
  if (input.pendingCount < 1) return false;
  if (!isBeforeAutomaticReminderDeadline(input.now)) return false;
  const anchor = reminderAnchor(input.anchor);
  if (!anchor) return false;
  return input.now.getTime() - anchor.getTime() >= PARTNER_REMINDER_INTERVAL_MS;
}

type SubmissionShape = {
  fascia: string;
  website: string;
  sms: string;
  documents: string;
  speakers: string;
  representatives: string;
};

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function submissionShape(partner: Partner): SubmissionShape {
  const documents = [...(partner.portalDocuments ?? [])]
    .map((doc) =>
      [doc.kind, doc.fileName, doc.url, String(doc.fileSizeBytes ?? "")].join("|")
    )
    .sort();
  const speakers = [...(partner.portalSeminarSpeakers ?? [])]
    .map((row) => ({
      eventId: row.eventId,
      seminarId: row.seminarId,
      speakers: [...(row.speakers ?? [])].map((speaker) => ({
        name: clean(speaker.name),
        designation: clean(speaker.designation),
        contact: clean(speaker.contact ?? speaker.phone),
        introduction: clean(speaker.introduction),
        linkedinProfile: clean(speaker.linkedinProfile),
        photoUrl: clean(speaker.photoUrl),
      })),
    }))
    .sort((a, b) =>
      `${a.eventId}:${a.seminarId}`.localeCompare(`${b.eventId}:${b.seminarId}`)
    );
  const representatives = [...(partner.portalRepresentatives ?? [])]
    .map((row) => ({
      eventId: row.eventId,
      representatives: [...(row.representatives ?? [])].map((person) => ({
        name: clean(person.name),
        designation: clean(person.designation),
        phone: clean(person.phone),
      })),
    }))
    .sort((a, b) => a.eventId.localeCompare(b.eventId));

  return {
    fascia: clean(partner.portalFasciaName),
    website: clean(partner.portalWebsiteUrl),
    sms: clean(partner.portalSmsContent),
    documents: JSON.stringify(documents),
    speakers: JSON.stringify(speakers),
    representatives: JSON.stringify(representatives),
  };
}

export function partnerActivityEventIds(partner: Partner): string[] {
  return [
    ...new Set([
      ...(partner.eventIds ?? []),
      ...(partner.eventPartnerships ?? []).map((row) => row.eventId),
      ...(partner.seminarSlotAssignments ?? []).map((row) => row.eventId),
      ...(partner.portalSeminarSpeakers ?? []).map((row) => row.eventId),
      ...(partner.portalRepresentatives ?? []).map((row) => row.eventId),
    ]),
  ].filter(Boolean);
}

export function meaningfulPartnerActivity(
  before: Partner,
  after: Partner
): { eventIds: string[] } | null {
  const previous = submissionShape(before);
  const next = submissionShape(after);
  const eventIds = new Set<string>();
  const partnerWide =
    previous.fascia !== next.fascia ||
    previous.website !== next.website ||
    previous.sms !== next.sms ||
    previous.documents !== next.documents;
  if (partnerWide) {
    for (const eventId of partnerActivityEventIds(after)) eventIds.add(eventId);
  }
  if (previous.speakers !== next.speakers) {
    for (const row of after.portalSeminarSpeakers ?? []) {
      if (row.eventId) eventIds.add(row.eventId);
    }
    for (const row of before.portalSeminarSpeakers ?? []) {
      if (row.eventId) eventIds.add(row.eventId);
    }
  }
  if (previous.representatives !== next.representatives) {
    for (const row of after.portalRepresentatives ?? []) {
      if (row.eventId) eventIds.add(row.eventId);
    }
    for (const row of before.portalRepresentatives ?? []) {
      if (row.eventId) eventIds.add(row.eventId);
    }
  }
  if (
    !partnerWide &&
    previous.speakers === next.speakers &&
    previous.representatives === next.representatives
  ) {
    return null;
  }
  return { eventIds: [...eventIds] };
}

export function withPartnerPortalActivity(
  partner: Partner,
  eventIds: string[],
  at: Date
): Partner {
  const selected = new Set(eventIds);
  const iso = at.toISOString();
  const eventPartnerships = (partner.eventPartnerships ?? []).map((row) =>
    selected.has(row.eventId)
      ? { ...row, partnerPortalLastActivityAt: iso }
      : row
  );
  return { ...partner, eventPartnerships };
}

export function preservePartnershipActivity(
  existing: Partner,
  next: Partner
): Partner {
  if (!next.eventPartnerships) return next;
  const previous = new Map(
    (existing.eventPartnerships ?? []).map((row) => [
      row.eventId,
      row.partnerPortalLastActivityAt,
    ])
  );
  const eventPartnerships: PartnerEventPartnership[] = next.eventPartnerships.map(
    (row) => {
      const preserved =
        row.partnerPortalLastActivityAt ?? previous.get(row.eventId);
      if (!preserved || row.partnerPortalLastActivityAt) return row;
      return { ...row, partnerPortalLastActivityAt: preserved };
    }
  );
  return { ...next, eventPartnerships };
}

export function allocationSignature(
  partner: Pick<Partner, "seminarSlotAssignments">,
  eventId: string
): number {
  return (partner.seminarSlotAssignments ?? [])
    .filter((row) => row.eventId === eventId && row.slots > 0)
    .reduce((sum, row) => sum + row.slots, 0);
}
