import { sendEmail, type SendEmailResult } from "@/lib/email";
import { resolveEventPartnerships } from "@/lib/partner-event-config";
import {
  allocationSignature,
  isAutomaticReminderEligible,
  meaningfulPartnerActivity,
  readPartnerCommunicationAutomationEnabledAt,
  withPartnerPortalActivity,
  type PartnerCommunicationType,
  type PartnerManualReminderType,
} from "@/lib/partner-communication-policy";
import { panelSessionsForPartner } from "@/lib/partner-panel-sessions";
import {
  completedSpeakerSeminarIds,
  dedupePendingItems,
  isPartnerSpeakerComplete,
  pendingItemsForPartnership,
  readinessLinesForPartnership,
  type PanelSessionView,
  type PendingItem,
  type ReadinessLine,
} from "@/lib/partner-pending-state";
import { partnerPortalBaseUrl } from "@/lib/server/partner-access-email";
import {
  buildPanelDiscussionDetailsEmail,
  buildParticipationReadinessEmail,
  buildPendingActionsEmail,
  buildSpeakerDetailsReceivedEmail,
  buildSpeakerDetailsRequestEmail,
  type ReceivedSpeaker,
} from "@/lib/server/partner-communication-email-template";
import {
  createPartnerCommunicationLogStore,
  type PartnerCommunicationLogEntry,
  type PartnerCommunicationLogStore,
} from "@/lib/server/partner-communication-log";
import {
  PARTNER_EMAIL_LOGO_CID,
  loadPartnerEmailLogo,
} from "@/lib/server/partner-email-layout";
import { listEventsForApi } from "@/lib/server/event-service";
import {
  listPartnersForApi,
  updatePartnerForApi,
} from "@/lib/server/partner-service";
import type { Event, Partner, PartnerEventPartnership } from "@/types";

const MANUAL_RESET_TYPES = new Set<PartnerCommunicationType>([
  "PENDING_ACTIONS_REMINDER",
  "PANEL_DISCUSSION_DETAILS",
  "SPEAKER_DETAILS_REQUEST",
]);

type SendMail = typeof sendEmail;

export type PartnerReminderOption = {
  type: PartnerManualReminderType;
  label: string;
  pendingItems?: PendingItem[];
};

export type PartnerCommunicationSummary = {
  examined: number;
  sent: number;
  skipped: number;
  failed: number;
};

function recipientFor(partner: Partner): string | null {
  const candidates = [
    partner.portalInviteEmail,
    partner.primaryContact?.email,
  ];
  for (const candidate of candidates) {
    const email = candidate?.trim().toLowerCase();
    if (email?.includes("@")) return email;
  }
  return null;
}

function partnershipsOf(partner: Partner): PartnerEventPartnership[] {
  return resolveEventPartnerships(partner);
}

function pendingFor(
  partner: Partner,
  partnership: PartnerEventPartnership,
  sessions: PanelSessionView[]
): PendingItem[] {
  return pendingItemsForPartnership({
    eventId: partnership.eventId,
    deliverables: partnership.deliverables ?? [],
    representativeSlotCount: partnership.representativeSlotCount ?? 0,
    sessions: sessions.filter((session) => session.eventId === partnership.eventId),
    portalFasciaName: partner.portalFasciaName,
    portalWebsiteUrl: partner.portalWebsiteUrl,
    portalSmsContent: partner.portalSmsContent,
    documents: partner.portalDocuments,
    speakers: partner.portalSeminarSpeakers,
    representatives: partner.portalRepresentatives,
  });
}

function mergeReadiness(groups: ReadinessLine[][]): ReadinessLine[] {
  const labels = groups[0]?.map((line) => line.label) ?? [];
  return labels.map((label) => {
    const statuses = groups.map(
      (group) => group.find((line) => line.label === label)?.status
    );
    if (statuses.includes("Confirmed")) return { label, status: "Confirmed" as const };
    if (statuses.includes("Complete")) return { label, status: "Complete" as const };
    return { label, status: "Not Applicable" as const };
  });
}

function acceptedLogs(
  logs: PartnerCommunicationLogEntry[],
  eventId: string,
  type: PartnerCommunicationType,
  trigger?: "AUTOMATIC" | "MANUAL"
): PartnerCommunicationLogEntry[] {
  return logs.filter(
    (entry) =>
      entry.outcome === "accepted" &&
      entry.eventId === eventId &&
      entry.communicationType === type &&
      (trigger === undefined || entry.triggerType === trigger)
  );
}

function latestIso(entries: PartnerCommunicationLogEntry[]): string | null {
  let latest = Number.NEGATIVE_INFINITY;
  let value: string | null = null;
  for (const entry of entries) {
    const time = new Date(entry.sentAt).getTime();
    if (!Number.isNaN(time) && time > latest) {
      latest = time;
      value = entry.sentAt;
    }
  }
  return value;
}

async function deliver(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  send: SendMail;
  includeLogo: boolean;
  logo: string | null;
}): Promise<SendEmailResult> {
  return input.send({
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    ...(input.includeLogo && input.logo
      ? {
          attachments: [
            {
              filename: "career-uttsav-logo.png",
              content: input.logo,
              contentId: PARTNER_EMAIL_LOGO_CID,
            },
          ],
        }
      : {}),
  });
}

async function logAccepted(input: {
  store: PartnerCommunicationLogStore;
  partnerId: string;
  eventIds: string[];
  communicationType: PartnerCommunicationType;
  triggerType: "AUTOMATIC" | "MANUAL";
  sentAt: string;
  messageId: string;
  recipientEmail: string;
  pendingKeys?: string[];
  pendingLabels?: string[];
  seminarIds?: string[];
}): Promise<void> {
  const eventIds = input.eventIds.length > 0 ? input.eventIds : [null];
  for (const eventId of eventIds) {
    await input.store.append({
      partnerId: input.partnerId,
      eventId,
      communicationType: input.communicationType,
      triggerType: input.triggerType,
      sentAt: input.sentAt,
      messageId: input.messageId,
      recipientEmail: input.recipientEmail,
      metadata: {
        ...(input.pendingKeys?.length ? { pendingKeys: input.pendingKeys } : {}),
        ...(input.pendingLabels?.length ? { pendingLabels: input.pendingLabels } : {}),
        ...(input.seminarIds?.length ? { seminarIds: input.seminarIds } : {}),
      },
    });
  }
}

function receivedSpeakers(
  partner: Partner,
  sessions: PanelSessionView[]
): ReceivedSpeaker[] {
  const speakers: ReceivedSpeaker[] = [];
  for (const session of sessions) {
    const row = (partner.portalSeminarSpeakers ?? []).find(
      (item) =>
        item.eventId === session.eventId && item.seminarId === session.seminarId
    );
    const speaker = row?.speakers.find((item) => isPartnerSpeakerComplete(item));
    if (!speaker) continue;
    const schedule = [session.dateLabel, session.timeLabel].filter(Boolean).join(", ");
    speakers.push({
      name: speaker.name.trim(),
      designation: speaker.designation?.trim() || "—",
      topic: session.topic,
      scheduleLabel: schedule || null,
    });
  }
  return speakers;
}

async function sendBuilt(input: {
  partner: Partner;
  subject: string;
  html: string;
  text: string;
  send: SendMail;
  logo: string | null;
}): Promise<SendEmailResult | null> {
  const to = recipientFor(input.partner);
  if (!to) return null;
  const message = { subject: input.subject, html: input.html, text: input.text };
  return deliver({
    to,
    ...message,
    send: input.send,
    includeLogo: Boolean(input.logo),
    logo: input.logo,
  });
}

export async function applyMeaningfulPartnerActivity(
  before: Partner,
  after: Partner,
  now = new Date()
): Promise<Partner> {
  const activity = meaningfulPartnerActivity(before, after);
  if (!activity || activity.eventIds.length === 0) return after;
  if (!after.eventPartnerships?.length) return after;
  const stamped = withPartnerPortalActivity(after, activity.eventIds, now);
  const saved = await updatePartnerForApi(after.id, {
    eventPartnerships: stamped.eventPartnerships,
  });
  return saved.ok ? saved.partner : after;
}

export async function reminderOptionsForPartner(
  partner: Partner,
  events: Event[]
): Promise<PartnerReminderOption[]> {
  const sessions = panelSessionsForPartner(partner, events);
  const partnerships = partnershipsOf(partner);
  const pending = dedupePendingItems(
    partnerships.flatMap((partnership) => pendingFor(partner, partnership, sessions))
  );
  const speakerPending = pending.some((item) => item.section === "speakers");
  const options: PartnerReminderOption[] = [];
  if (pending.length > 0) {
    options.push({
      type: "PENDING_ACTIONS_REMINDER",
      label: "Pending Actions Reminder",
      pendingItems: pending,
    });
  }
  if (sessions.length > 0) {
    options.push({
      type: "PANEL_DISCUSSION_DETAILS",
      label: "Panel Discussion Details",
    });
  }
  if (sessions.length > 0 && speakerPending) {
    options.push({
      type: "SPEAKER_DETAILS_REQUEST",
      label: "Speaker Details Request",
    });
  }
  return options;
}

export async function sendManualPartnerReminder(input: {
  partner: Partner;
  type: PartnerManualReminderType;
  events: Event[];
  store?: PartnerCommunicationLogStore;
  send?: SendMail;
  now?: Date;
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const store = input.store ?? createPartnerCommunicationLogStore();
  const send = input.send ?? sendEmail;
  const now = input.now ?? new Date();
  const to = recipientFor(input.partner);
  if (!to) {
    return { ok: false, error: "This partner has no email address for reminders." };
  }
  const sessions = panelSessionsForPartner(input.partner, input.events);
  const partnerships = partnershipsOf(input.partner);
  const pending = dedupePendingItems(
    partnerships.flatMap((partnership) =>
      pendingFor(input.partner, partnership, sessions)
    )
  );
  const logo = await loadPartnerEmailLogo();
  const portalUrl = partnerPortalBaseUrl();
  let message: { subject: string; html: string; text: string } | null = null;
  let eventIds: string[] = [];
  let pendingKeys: string[] = [];
  let pendingLabels: string[] = [];

  if (input.type === "PENDING_ACTIONS_REMINDER") {
    if (pending.length === 0) {
      return { ok: false, error: "There are no pending actions to remind this partner about." };
    }
    message = buildPendingActionsEmail({
      institutionName: input.partner.name,
      portalUrl,
      includeLogo: Boolean(logo),
      pendingItems: pending,
    });
    eventIds = partnerships
      .filter((partnership) => pendingFor(input.partner, partnership, sessions).length > 0)
      .map((partnership) => partnership.eventId);
    pendingKeys = pending.map((item) => item.key);
    pendingLabels = pending.map((item) => item.label);
  } else if (input.type === "PANEL_DISCUSSION_DETAILS") {
    if (sessions.length === 0) {
      return { ok: false, error: "This partner has no Panel Discussion allocation." };
    }
    message = buildPanelDiscussionDetailsEmail({
      institutionName: input.partner.name,
      portalUrl,
      includeLogo: Boolean(logo),
      sessions,
    });
    eventIds = [...new Set(sessions.map((session) => session.eventId))];
  } else {
    const speakerPending = pending.some((item) => item.section === "speakers");
    if (sessions.length === 0 || !speakerPending) {
      return { ok: false, error: "Speaker details are not waiting on this partner." };
    }
    message = buildSpeakerDetailsRequestEmail({
      institutionName: input.partner.name,
      portalUrl,
      includeLogo: Boolean(logo),
    });
    eventIds = [
      ...new Set(
        pending
          .filter((item) => item.section === "speakers")
          .map((item) => item.key.split(":")[1])
          .filter((eventId): eventId is string => Boolean(eventId))
      ),
    ];
    pendingKeys = pending.filter((item) => item.section === "speakers").map((item) => item.key);
  }

  let result: SendEmailResult;
  try {
    result = await deliver({
      to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      send,
      includeLogo: Boolean(logo),
      logo,
    });
  } catch (error) {
    console.info("[partner-communication]", {
      partnerId: input.partner.id,
      type: input.type,
      outcome: "unknown",
      error: error instanceof Error ? error.message : "Email send failed",
    });
    return { ok: false, error: "The reminder could not be sent. Nothing was marked as sent." };
  }

  if (!result.ok || result.outcome !== "accepted") {
    console.info("[partner-communication]", {
      partnerId: input.partner.id,
      type: input.type,
      outcome: result.outcome,
    });
    return { ok: false, error: "The reminder could not be sent. Nothing was marked as sent." };
  }

  await logAccepted({
    store,
    partnerId: input.partner.id,
    eventIds,
    communicationType: input.type,
    triggerType: "MANUAL",
    sentAt: now.toISOString(),
    messageId: result.id,
    recipientEmail: to,
    pendingKeys,
    pendingLabels,
  });
  return { ok: true, messageId: result.id };
}

async function sendAutomaticPanelAndSpeaker(input: {
  partner: Partner;
  events: Event[];
  store: PartnerCommunicationLogStore;
  send: SendMail;
  now: Date;
  eventIds?: string[];
}): Promise<void> {
  if (!input.partner.portalInviteSentAt || input.partner.portalAccessEnabled !== true) return;
  const sessions = panelSessionsForPartner(input.partner, input.events).filter(
    (session) => !input.eventIds || input.eventIds.includes(session.eventId)
  );
  if (sessions.length === 0) return;
  const logs = await input.store.listForPartner(input.partner.id);
  const logo = await loadPartnerEmailLogo();
  const portalUrl = partnerPortalBaseUrl();
  const panelEventIds = [
    ...new Set(
      sessions
        .map((session) => session.eventId)
        .filter(
          (eventId) =>
            acceptedLogs(logs, eventId, "PANEL_DISCUSSION_DETAILS", "AUTOMATIC").length === 0
        )
    ),
  ];
  const panelSessions = sessions.filter((session) =>
    panelEventIds.includes(session.eventId)
  );
  if (panelSessions.length > 0) {
    const message = buildPanelDiscussionDetailsEmail({
      institutionName: input.partner.name,
      portalUrl,
      includeLogo: Boolean(logo),
      sessions: panelSessions,
    });
    const result = await sendBuilt({
      partner: input.partner,
      ...message,
      send: input.send,
      logo,
    });
    if (result?.ok && result.outcome === "accepted") {
      await logAccepted({
        store: input.store,
        partnerId: input.partner.id,
        eventIds: panelEventIds,
        communicationType: "PANEL_DISCUSSION_DETAILS",
        triggerType: "AUTOMATIC",
        sentAt: input.now.toISOString(),
        messageId: result.id,
        recipientEmail: recipientFor(input.partner) ?? "",
      });
    }
  }

  const freshLogs = await input.store.listForPartner(input.partner.id);
  const partnerships = partnershipsOf(input.partner);
  const speakerEventIds = [
    ...new Set(
      sessions
        .filter((session) => {
          const partnership = partnerships.find((row) => row.eventId === session.eventId);
          if (!partnership) return false;
          const pending = pendingFor(input.partner, partnership, [session]);
          return (
            pending.some((item) => item.section === "speakers") &&
            acceptedLogs(freshLogs, session.eventId, "SPEAKER_DETAILS_REQUEST", "AUTOMATIC")
              .length === 0
          );
        })
        .map((session) => session.eventId)
    ),
  ];
  if (speakerEventIds.length === 0) return;
  const message = buildSpeakerDetailsRequestEmail({
    institutionName: input.partner.name,
    portalUrl,
    includeLogo: Boolean(logo),
  });
  const result = await sendBuilt({
    partner: input.partner,
    ...message,
    send: input.send,
    logo,
  });
  if (result?.ok && result.outcome === "accepted") {
    await logAccepted({
      store: input.store,
      partnerId: input.partner.id,
      eventIds: speakerEventIds,
      communicationType: "SPEAKER_DETAILS_REQUEST",
      triggerType: "AUTOMATIC",
      sentAt: input.now.toISOString(),
      messageId: result.id,
      recipientEmail: recipientFor(input.partner) ?? "",
    });
  }
}

export async function notifyAfterAccessAccepted(
  partner: Partner,
  deps?: {
    events?: Event[];
    store?: PartnerCommunicationLogStore;
    send?: SendMail;
    now?: Date;
  }
): Promise<void> {
  if (!partner.portalInviteSentAt || partner.portalAccessEnabled !== true) return;
  if ((partner.seminarSlotAssignments ?? []).every((row) => row.slots <= 0)) return;
  const events = deps?.events ?? (await listEventsForApi());
  await sendAutomaticPanelAndSpeaker({
    partner,
    events,
    store: deps?.store ?? createPartnerCommunicationLogStore(),
    send: deps?.send ?? sendEmail,
    now: deps?.now ?? new Date(),
  });
}

export async function notifyAfterAllocationChange(
  before: Partner,
  after: Partner,
  deps?: {
    events?: Event[];
    store?: PartnerCommunicationLogStore;
    send?: SendMail;
    now?: Date;
  }
): Promise<void> {
  const eventIds = [
    ...new Set([
      ...(before.seminarSlotAssignments ?? []).map((row) => row.eventId),
      ...(after.seminarSlotAssignments ?? []).map((row) => row.eventId),
    ]),
  ].filter(
    (eventId) =>
      allocationSignature(before, eventId) === 0 &&
      allocationSignature(after, eventId) > 0
  );
  if (eventIds.length === 0) return;
  const events = deps?.events ?? (await listEventsForApi());
  await sendAutomaticPanelAndSpeaker({
    partner: after,
    events,
    eventIds,
    store: deps?.store ?? createPartnerCommunicationLogStore(),
    send: deps?.send ?? sendEmail,
    now: deps?.now ?? new Date(),
  });
}

export async function notifySpeakerReceived(
  before: Partner,
  after: Partner,
  deps?: {
    events?: Event[];
    store?: PartnerCommunicationLogStore;
    send?: SendMail;
    now?: Date;
  }
): Promise<void> {
  const events = deps?.events ?? (await listEventsForApi());
  const sessions = panelSessionsForPartner(after, events);
  const beforeIds = new Set(completedSpeakerSeminarIds(before, sessions));
  const afterIds = completedSpeakerSeminarIds(after, sessions).filter(
    (seminarId) => !beforeIds.has(seminarId)
  );
  if (afterIds.length === 0) return;
  const store = deps?.store ?? createPartnerCommunicationLogStore();
  const logs = await store.listForPartner(after.id);
  const already = new Set(
    logs
      .filter(
        (entry) =>
          entry.outcome === "accepted" &&
          entry.communicationType === "SPEAKER_DETAILS_RECEIVED"
      )
      .flatMap((entry) => entry.metadata?.seminarIds ?? [])
  );
  const freshIds = afterIds.filter((seminarId) => !already.has(seminarId));
  if (freshIds.length === 0) return;
  const freshSessions = sessions.filter((session) => freshIds.includes(session.seminarId));
  const speakers = receivedSpeakers(after, freshSessions);
  if (speakers.length === 0) return;
  const logo = await loadPartnerEmailLogo();
  const message = buildSpeakerDetailsReceivedEmail({
    institutionName: after.name,
    portalUrl: partnerPortalBaseUrl(),
    includeLogo: Boolean(logo),
    speakers,
  });
  const result = await sendBuilt({
    partner: after,
    ...message,
    send: deps?.send ?? sendEmail,
    logo,
  });
  if (!result?.ok || result.outcome !== "accepted") return;
  const eventIds = [...new Set(freshSessions.map((session) => session.eventId))];
  await logAccepted({
    store,
    partnerId: after.id,
    eventIds,
    communicationType: "SPEAKER_DETAILS_RECEIVED",
    triggerType: "AUTOMATIC",
    sentAt: (deps?.now ?? new Date()).toISOString(),
    messageId: result.id,
    recipientEmail: recipientFor(after) ?? "",
    seminarIds: freshIds,
  });
}

export async function notifyReadinessTransition(
  before: Partner,
  after: Partner,
  deps?: {
    events?: Event[];
    store?: PartnerCommunicationLogStore;
    send?: SendMail;
    now?: Date;
  }
): Promise<void> {
  const events = deps?.events ?? (await listEventsForApi());
  const beforeSessions = panelSessionsForPartner(before, events);
  const afterSessions = panelSessionsForPartner(after, events);
  const beforePartnerships = partnershipsOf(before);
  const afterPartnerships = partnershipsOf(after);
  const ready = afterPartnerships.filter((partnership) => {
    const previous = beforePartnerships.find((row) => row.eventId === partnership.eventId);
    const beforeCount = previous
      ? pendingFor(before, previous, beforeSessions).length
      : pendingFor(before, partnership, beforeSessions).length;
    const afterCount = pendingFor(after, partnership, afterSessions).length;
    return beforeCount > 0 && afterCount === 0;
  });
  if (ready.length === 0) return;
  const store = deps?.store ?? createPartnerCommunicationLogStore();
  const logs = await store.listForPartner(after.id);
  const unsent = ready.filter(
    (partnership) =>
      acceptedLogs(logs, partnership.eventId, "PARTICIPATION_READINESS", "AUTOMATIC")
        .length === 0
  );
  if (unsent.length === 0) return;
  const lines = mergeReadiness(
    unsent.map((partnership) =>
      readinessLinesForPartnership({
        eventId: partnership.eventId,
        deliverables: partnership.deliverables ?? [],
        representativeSlotCount: partnership.representativeSlotCount ?? 0,
        sessions: afterSessions.filter((session) => session.eventId === partnership.eventId),
        portalFasciaName: after.portalFasciaName,
        portalWebsiteUrl: after.portalWebsiteUrl,
        portalSmsContent: after.portalSmsContent,
        documents: after.portalDocuments,
        speakers: after.portalSeminarSpeakers,
        representatives: after.portalRepresentatives,
      })
    )
  );
  const logo = await loadPartnerEmailLogo();
  const message = buildParticipationReadinessEmail({
    institutionName: after.name,
    portalUrl: partnerPortalBaseUrl(),
    includeLogo: Boolean(logo),
    lines,
  });
  const result = await sendBuilt({
    partner: after,
    ...message,
    send: deps?.send ?? sendEmail,
    logo,
  });
  if (!result?.ok || result.outcome !== "accepted") return;
  await logAccepted({
    store,
    partnerId: after.id,
    eventIds: unsent.map((partnership) => partnership.eventId),
    communicationType: "PARTICIPATION_READINESS",
    triggerType: "AUTOMATIC",
    sentAt: (deps?.now ?? new Date()).toISOString(),
    messageId: result.id,
    recipientEmail: recipientFor(after) ?? "",
  });
}

function automationEnabledAtFor(deps?: {
  automationEnabledAt?: string | null;
}): string | null {
  if (deps && "automationEnabledAt" in deps) {
    if (!deps.automationEnabledAt) return null;
    return readPartnerCommunicationAutomationEnabledAt(deps.automationEnabledAt);
  }
  return readPartnerCommunicationAutomationEnabledAt();
}

export async function processPartnerCommunicationReminders(deps?: {
  now?: Date;
  partners?: Partner[];
  events?: Event[];
  store?: PartnerCommunicationLogStore;
  send?: SendMail;
  /** ISO time when automatic reminders start. Omit to read the server setting. */
  automationEnabledAt?: string | null;
}): Promise<PartnerCommunicationSummary> {
  const now = deps?.now ?? new Date();
  const partners = deps?.partners ?? (await listPartnersForApi());
  const events = deps?.events ?? (await listEventsForApi());
  const store = deps?.store ?? createPartnerCommunicationLogStore();
  const send = deps?.send ?? sendEmail;
  const automationEnabledAt = automationEnabledAtFor(deps);
  const summary: PartnerCommunicationSummary = {
    examined: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  for (const partner of partners) {
    summary.examined += 1;
    try {
      if (!partner.portalInviteSentAt || partner.portalAccessEnabled !== true) {
        summary.skipped += 1;
        continue;
      }
      const sessions = panelSessionsForPartner(partner, events);
      const partnerships = partnershipsOf(partner);
      const logs = await store.listForPartner(partner.id);
      const eligible = partnerships.filter((partnership) => {
        const pending = pendingFor(partner, partnership, sessions);
        const eventLogs = logs.filter((entry) => entry.eventId === partnership.eventId);
        return isAutomaticReminderEligible({
          accessSent: true,
          accessEnabled: true,
          pendingCount: pending.length,
          now,
          anchor: {
            automationEnabledAt,
            accessSentAt: partner.portalInviteSentAt,
            lastActivityAt: partnership.partnerPortalLastActivityAt,
            lastAutomaticReminderAt: latestIso(
              eventLogs.filter(
                (entry) =>
                  entry.communicationType === "PENDING_ACTIONS_REMINDER" &&
                  entry.triggerType === "AUTOMATIC"
              )
            ),
            lastManualReminderAt: latestIso(
              eventLogs.filter(
                (entry) =>
                  entry.triggerType === "MANUAL" &&
                  MANUAL_RESET_TYPES.has(entry.communicationType)
              )
            ),
          },
        });
      });
      if (eligible.length === 0) {
        summary.skipped += 1;
        continue;
      }
      const pending = dedupePendingItems(
        eligible.flatMap((partnership) => pendingFor(partner, partnership, sessions))
      );
      if (pending.length === 0) {
        summary.skipped += 1;
        continue;
      }
      const logo = await loadPartnerEmailLogo();
      const message = buildPendingActionsEmail({
        institutionName: partner.name,
        portalUrl: partnerPortalBaseUrl(),
        includeLogo: Boolean(logo),
        pendingItems: pending,
      });
      const result = await sendBuilt({ partner, ...message, send, logo });
      if (!result?.ok || result.outcome !== "accepted") {
        summary.failed += 1;
        continue;
      }
      await logAccepted({
        store,
        partnerId: partner.id,
        eventIds: eligible.map((partnership) => partnership.eventId),
        communicationType: "PENDING_ACTIONS_REMINDER",
        triggerType: "AUTOMATIC",
        sentAt: now.toISOString(),
        messageId: result.id,
        recipientEmail: recipientFor(partner) ?? "",
        pendingKeys: pending.map((item) => item.key),
        pendingLabels: pending.map((item) => item.label),
      });
      summary.sent += 1;
    } catch (error) {
      summary.failed += 1;
      console.info("[partner-communication]", {
        partnerId: partner.id,
        outcome: "unknown",
        error: error instanceof Error ? error.message : "Reminder failed",
      });
    }
  }

  return summary;
}
