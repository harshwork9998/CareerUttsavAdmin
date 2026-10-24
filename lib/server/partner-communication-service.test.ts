import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SendEmailInput, SendEmailResult } from "@/lib/email";
import { panelSessionsForPartner } from "@/lib/partner-panel-sessions";
import {
  notifyAfterAccessAccepted,
  notifyAfterAllocationChange,
  notifyReadinessTransition,
  notifySpeakerReceived,
  processPartnerCommunicationReminders,
  reminderOptionsForPartner,
  sendManualPartnerReminder,
} from "@/lib/server/partner-communication-service";
import { createMemoryPartnerCommunicationLogStore } from "@/lib/server/partner-communication-log";
import type { Event, Partner, PartnerDeliverable } from "@/types";

const PORTAL = "https://partners.careeruttsav.in";

vi.mock("@/lib/server/partner-access-email", () => ({
  partnerPortalBaseUrl: () => PORTAL,
}));

vi.mock("@/lib/server/partner-email-layout", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/partner-email-layout")>(
    "@/lib/server/partner-email-layout"
  );
  return {
    ...actual,
    loadPartnerEmailLogo: vi.fn(async () => null),
  };
});

function deliverable(key: string, included: boolean, option?: string): PartnerDeliverable {
  return { id: key, key, label: key, included, option };
}

function partner(overrides: Partial<Partner> = {}): Partner {
  return {
    id: "partner-001",
    name: "Example Institute",
    city: "Bengaluru",
    state: "Karnataka",
    primaryContact: {
      name: "Dean",
      designation: "Dean",
      phone: "9845011001",
      email: "dean@example.edu",
    },
    secondaryContact: {
      name: "Office",
      designation: "Office",
      phone: "9845011002",
      email: "office@example.edu",
    },
    eventIds: ["evt-001"],
    relationshipOwner: {
      organization: "K2",
      managerName: "Owner",
      managerPhone: "9886020001",
      managerEmail: "owner@example.edu",
    },
    stage: "Confirmed",
    stageRemarks: [],
    portalInviteEmail: "office@example.edu",
    portalInviteSentAt: "2026-11-01T00:00:00.000Z",
    portalAccessEnabled: true,
    eventPartnerships: [
      {
        eventId: "evt-001",
        deliverables: [deliverable("logoB2C", true), deliverable("smsMailerCampaign", true)],
        seminarSlotCount: 0,
        representativeSlotCount: 0,
      },
    ],
    portalSmsContent: "Join us at Career Uttsav.",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

function fair(overrides: Partial<Event> = {}): Event {
  return {
    id: "evt-001",
    title: "Career Uttsav Bengaluru",
    slug: "bengaluru",
    description: "",
    status: "Published",
    venue: "Palace Grounds",
    address: "",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
    startDate: "2026-12-19",
    endDate: "2026-12-20",
    startTime: "09:00",
    endTime: "18:00",
    hallCount: 2,
    seminars: [
      {
        id: "sem-001",
        title: "Design careers",
        date: null,
        startTime: null,
        endTime: null,
        panelistSlots: 2,
        hall: null,
      },
      {
        id: "sem-002",
        title: "Scholarships",
        date: "2026-12-19",
        startTime: "10:00",
        endTime: "11:00",
        panelistSlots: 2,
        hall: 2,
      },
    ],
    registrationDeadline: "2026-12-01T00:00:00.000Z",
    maxCapacity: 1000,
    registrationCount: 0,
    checkInCount: 0,
    isFeatured: false,
    tags: [],
    createdBy: "admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function mailer(result: SendEmailResult = accepted()) {
  return vi.fn(async (_input: SendEmailInput): Promise<SendEmailResult> => result);
}

function accepted(id = "msg-1"): SendEmailResult {
  return { ok: true, id, durationMs: 5, outcome: "accepted" };
}

function failed(): SendEmailResult {
  return {
    ok: false,
    error: "mailbox unavailable",
    durationMs: 5,
    outcome: "definitive_failure",
  };
}

const completeSpeaker = {
  name: "Asha Rao",
  designation: "Dean",
  contact: "9876543210",
  introduction: "Leads student outreach.",
  photoUrl: "https://example.com/asha.png",
};

describe("partner communication delivery", () => {
  const previousAutomation = process.env.PARTNER_COMMUNICATION_AUTOMATION_ENABLED_AT;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.PARTNER_COMMUNICATION_AUTOMATION_ENABLED_AT = "2026-10-01T00:00:00.000Z";
  });

  afterEach(() => {
    if (previousAutomation === undefined) {
      delete process.env.PARTNER_COMMUNICATION_AUTOMATION_ENABLED_AT;
    } else {
      process.env.PARTNER_COMMUNICATION_AUTOMATION_ENABLED_AT = previousAutomation;
    }
  });

  it("does not blast automatic reminders for historical inactivity at go-live", async () => {
    const send = mailer();
    const summary = await processPartnerCommunicationReminders({
      now: new Date("2026-11-04T00:00:00.000Z"),
      automationEnabledAt: "2026-11-04T00:00:00.000Z",
      partners: [partner()],
      events: [fair()],
      store: createMemoryPartnerCommunicationLogStore(),
      send,
    });
    expect(summary.sent).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("keeps the original recipient after the partner email changes", async () => {
    const store = createMemoryPartnerCommunicationLogStore();
    await processPartnerCommunicationReminders({
      now: new Date("2026-11-04T00:00:00.000Z"),
      partners: [partner()],
      events: [fair()],
      store,
      send: mailer(accepted("auto-1")),
    });
    const changed = partner({ portalInviteEmail: "new-office@example.edu" });
    const manual = await sendManualPartnerReminder({
      partner: changed,
      type: "PENDING_ACTIONS_REMINDER",
      events: [fair()],
      store,
      send: mailer(accepted("manual-2")),
      now: new Date("2026-11-05T00:00:00.000Z"),
    });
    expect(manual.ok).toBe(true);
    const logs = await store.listForPartner("partner-001");
    expect(logs.find((entry) => entry.triggerType === "AUTOMATIC")?.recipientEmail).toBe(
      "office@example.edu"
    );
    expect(logs.find((entry) => entry.triggerType === "MANUAL")?.recipientEmail).toBe(
      "new-office@example.edu"
    );
  });

  it("sends one consolidated reminder for current pending items after 72 hours", async () => {
    const store = createMemoryPartnerCommunicationLogStore();
    const send = mailer(accepted("reminder-1"));
    const current = partner();
    const first = await processPartnerCommunicationReminders({
      now: new Date("2026-11-04T00:00:00.000Z"),
      partners: [current],
      events: [fair()],
      store,
      send,
    });
    expect(first.sent).toBe(1);
    const body = send.mock.calls[0]?.[0];
    expect(body?.text).toContain("University logo");
    expect(body?.text).not.toContain("SMS content");
    expect(body?.subject).toBe(
      "Almost There — A Few Career Uttsav Actions Are Still Pending"
    );

    const second = await processPartnerCommunicationReminders({
      now: new Date("2026-11-05T00:00:00.000Z"),
      partners: [current],
      events: [fair()],
      store,
      send,
    });
    expect(second.sent).toBe(0);
    expect(send).toHaveBeenCalledTimes(1);

    const third = await processPartnerCommunicationReminders({
      now: new Date("2026-11-07T00:00:00.000Z"),
      partners: [current],
      events: [fair()],
      store,
      send,
    });
    expect(third.sent).toBe(1);
    const logs = await store.listForPartner(current.id);
    expect(logs.every((entry) => entry.triggerType === "AUTOMATIC")).toBe(true);
    expect(logs.every((entry) => entry.outcome === "accepted")).toBe(true);
    expect(logs.every((entry) => entry.recipientEmail === "office@example.edu")).toBe(true);
    expect(logs[0]?.metadata?.pendingLabels).toContain("University logo");
    expect(JSON.stringify(logs)).not.toMatch(/password|token|hash/i);
  });

  it("skips reminders that are not eligible and continues after a failure", async () => {
    const store = createMemoryPartnerCommunicationLogStore();
    const send = mailer(accepted("reminder-2"));
    send.mockRejectedValueOnce(new Error("smtp down"));
    const quiet = partner({
      id: "quiet",
      portalInviteSentAt: undefined,
      portalAccessEnabled: false,
    });
    const active = partner({ id: "active" });
    const next = partner({ id: "next" });
    const summary = await processPartnerCommunicationReminders({
      now: new Date("2026-11-04T00:00:00.000Z"),
      partners: [quiet, active, next],
      events: [fair()],
      store,
      send,
    });
    expect(summary.sent).toBe(1);
    expect(summary.failed).toBe(1);
    expect(await store.listForPartner("active")).toEqual([]);
    expect(await store.listForPartner("next")).toHaveLength(1);
  });

  it("does not send an automatic reminder after the deadline or inside a manual window", async () => {
    const store = createMemoryPartnerCommunicationLogStore();
    await store.append({
      partnerId: "partner-001",
      eventId: "evt-001",
      communicationType: "PENDING_ACTIONS_REMINDER",
      triggerType: "MANUAL",
      sentAt: "2026-11-20T00:00:00.000Z",
      messageId: "manual-1",
      recipientEmail: "office@example.edu",
      metadata: { pendingKeys: ["logo"] },
    });
    const send = mailer();
    const held = await processPartnerCommunicationReminders({
      now: new Date("2026-11-21T00:00:00.000Z"),
      partners: [partner()],
      events: [fair()],
      store,
      send,
    });
    expect(held.sent).toBe(0);
    const late = await processPartnerCommunicationReminders({
      now: new Date("2026-12-02T00:00:00.000Z"),
      partners: [partner()],
      events: [fair()],
      store,
      send,
    });
    expect(late.sent).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("shows manual options from the current pending state and logs only accepted sends", async () => {
    const events = [fair()];
    const allocated = partner({
      seminarSlotAssignments: [
        { eventId: "evt-001", seminarId: "sem-001", slots: 1, seminarTitle: "Design careers" },
      ],
    });
    const options = await reminderOptionsForPartner(allocated, events);
    expect(options.map((option) => option.type)).toEqual([
      "PENDING_ACTIONS_REMINDER",
      "PANEL_DISCUSSION_DETAILS",
      "SPEAKER_DETAILS_REQUEST",
    ]);
    expect(options[0]?.pendingItems?.map((item) => item.label)).toEqual([
      "University logo",
      "Speaker details — Design careers",
    ]);

    const complete = partner({
      portalDocuments: [
        {
          id: "logo-1",
          kind: "logo",
          label: "Logo",
          fileName: "logo.png",
          mimeType: "image/png",
          url: "https://example.com/logo.png",
          fileSizeBytes: 10,
          uploadedAt: "2026-11-02T00:00:00.000Z",
        },
      ],
      seminarSlotAssignments: [
        { eventId: "evt-001", seminarId: "sem-001", slots: 1, seminarTitle: "Design careers" },
      ],
      portalSeminarSpeakers: [
        {
          eventId: "evt-001",
          seminarId: "sem-001",
          updatedAt: "2026-11-02T00:00:00.000Z",
          speakers: [completeSpeaker],
        },
      ],
    });
    const hidden = await reminderOptionsForPartner(complete, events);
    expect(hidden.map((option) => option.type)).toEqual(["PANEL_DISCUSSION_DETAILS"]);

    const store = createMemoryPartnerCommunicationLogStore();
    const send = mailer(failed());
    const rejected = await sendManualPartnerReminder({
      partner: allocated,
      type: "PENDING_ACTIONS_REMINDER",
      events,
      store,
      send,
    });
    expect(rejected.ok).toBe(false);
    expect(await store.listForPartner(allocated.id)).toEqual([]);

    send.mockResolvedValue(accepted("manual-ok"));
    const sent = await sendManualPartnerReminder({
      partner: allocated,
      type: "SPEAKER_DETAILS_REQUEST",
      events,
      store,
      send,
    });
    expect(sent.ok).toBe(true);
    const logs = await store.listForPartner(allocated.id);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      communicationType: "SPEAKER_DETAILS_REQUEST",
      triggerType: "MANUAL",
      outcome: "accepted",
      messageId: "manual-ok",
      recipientEmail: "office@example.edu",
    });
    expect(JSON.stringify(logs)).not.toMatch(/password|token|portalPasswordHash/);
  });

  it("sends Panel Discussion details once, including a later first allocation", async () => {
    const events = [fair()];
    const store = createMemoryPartnerCommunicationLogStore();
    const send = mailer(accepted("panel-1"));
    const allocated = partner({
      seminarSlotAssignments: [
        { eventId: "evt-001", seminarId: "sem-001", slots: 1, seminarTitle: "Design careers" },
        { eventId: "evt-001", seminarId: "sem-002", slots: 1, seminarTitle: "Scholarships" },
      ],
    });
    await notifyAfterAccessAccepted(allocated, { events, store, send });
    await notifyAfterAccessAccepted(allocated, { events, store, send });
    expect(send).toHaveBeenCalledTimes(2);
    const subjects = send.mock.calls.map((call) => call[0].subject);
    expect(subjects).toEqual([
      "Your Career Uttsav Panel Discussion Slot is Ready for Confirmation",
      "Who Will Represent Example Institute on the Career Uttsav Stage?",
    ]);
    expect(send.mock.calls[0]?.[0].text).toContain("Design careers");
    expect(send.mock.calls[0]?.[0].text).toContain("Scholarships");
    expect(send.mock.calls[0]?.[0].text).toContain("To be confirmed");
    expect(send.mock.calls[0]?.[0].text).toContain("19 December 2026");
    expect(send.mock.calls[0]?.[0].text).toContain("Hall 2");
    expect(send).toHaveBeenCalledTimes(2);

    send.mockClear();
    await notifyAfterAllocationChange(
      partner({ seminarSlotAssignments: [] }),
      partner({
        id: "partner-002",
        seminarSlotAssignments: [
          { eventId: "evt-001", seminarId: "sem-002", slots: 1, seminarTitle: "Scholarships" },
        ],
        portalSeminarSpeakers: [
          {
            eventId: "evt-001",
            seminarId: "sem-002",
            updatedAt: "2026-11-02T00:00:00.000Z",
            speakers: [completeSpeaker],
          },
        ],
      }),
      { events, store: createMemoryPartnerCommunicationLogStore(), send }
    );
    expect(send.mock.calls.map((call) => call[0].subject)).toEqual([
      "Your Career Uttsav Panel Discussion Slot is Ready for Confirmation",
    ]);

    const none = mailer();
    await notifyAfterAccessAccepted(partner({ seminarSlotAssignments: [] }), {
      events,
      store,
      send: none,
    });
    expect(none).not.toHaveBeenCalled();
  });

  it("confirms a speaker only when details become complete", async () => {
    const events = [fair()];
    const store = createMemoryPartnerCommunicationLogStore();
    const send = mailer(accepted("speaker-received"));
    const before = partner({
      seminarSlotAssignments: [
        { eventId: "evt-001", seminarId: "sem-001", slots: 1, seminarTitle: "Design careers" },
      ],
      portalSeminarSpeakers: [
        {
          eventId: "evt-001",
          seminarId: "sem-001",
          updatedAt: "2026-11-01T00:00:00.000Z",
          speakers: [{ ...completeSpeaker, photoUrl: "" }],
        },
      ],
    });
    const after = partner({
      ...before,
      portalSeminarSpeakers: [
        {
          eventId: "evt-001",
          seminarId: "sem-001",
          updatedAt: "2026-11-03T00:00:00.000Z",
          speakers: [completeSpeaker],
        },
      ],
    });
    await notifySpeakerReceived(before, after, { events, store, send });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0].text).toContain("Asha Rao");
    expect(send.mock.calls[0]?.[0].text).not.toMatch(/seminar/i);

    await notifySpeakerReceived(after, {
      ...after,
      portalSeminarSpeakers: [
        {
          eventId: "evt-001",
          seminarId: "sem-001",
          updatedAt: "2026-11-04T00:00:00.000Z",
          speakers: [{ ...completeSpeaker, introduction: "Updated bio for the programme." }],
        },
      ],
    }, { events, store, send });
    expect(send).toHaveBeenCalledTimes(1);
    expect(await store.listForPartner(after.id)).toHaveLength(1);
  });

  it("sends participation readiness once when pending items become empty", async () => {
    const events = [fair()];
    const store = createMemoryPartnerCommunicationLogStore();
    const send = mailer(accepted("ready-1"));
    const before = partner();
    const after = partner({
      portalDocuments: [
        {
          id: "logo-1",
          kind: "logo",
          label: "Logo",
          fileName: "logo.png",
          mimeType: "image/png",
          url: "https://example.com/logo.png",
          fileSizeBytes: 10,
          uploadedAt: "2026-11-04T00:00:00.000Z",
        },
      ],
    });
    await notifyReadinessTransition(before, after, { events, store, send });
    await notifyReadinessTransition(after, after, { events, store, send });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0].subject).toBe(
      "Your Career Uttsav Participation Details Are Complete"
    );
    expect(send.mock.calls[0]?.[0].text).toContain("Branding & collaterals — Complete");
    expect(send.mock.calls[0]?.[0].text).toContain("Panel Discussion — Not Applicable");
    const logs = await store.listForPartner(after.id);
    expect(logs[0]?.triggerType).toBe("AUTOMATIC");
    expect(logs[0]?.communicationType).toBe("PARTICIPATION_READINESS");
  });

  it("renders multiple Panel Discussions from the live catalogue", () => {
    const sessions = panelSessionsForPartner(
      partner({
        seminarSlotAssignments: [
          { eventId: "evt-001", seminarId: "sem-001", slots: 1, seminarTitle: "Design careers" },
          { eventId: "evt-001", seminarId: "sem-002", slots: 1 },
        ],
      }),
      [fair()]
    );
    expect(sessions.map((session) => session.topic)).toEqual([
      "Design careers",
      "Scholarships",
    ]);
    expect(sessions[0]?.dateLabel).toBeNull();
    expect(sessions[1]?.hallLabel).toBe("Hall 2");
  });
});
