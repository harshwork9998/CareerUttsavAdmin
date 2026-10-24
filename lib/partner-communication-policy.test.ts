import { describe, expect, it } from "vitest";

import {
  PARTNER_REMINDER_INTERVAL_MS,
  isAutomaticReminderEligible,
  isBeforeAutomaticReminderDeadline,
  meaningfulPartnerActivity,
  reminderAnchor,
} from "@/lib/partner-communication-policy";
import type { Partner } from "@/types";

const HOUR = 60 * 60 * 1000;

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
    eventPartnerships: [
      {
        eventId: "evt-001",
        deliverables: [],
        seminarSlotCount: 0,
        representativeSlotCount: 0,
      },
    ],
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("automatic reminder policy", () => {
  const accessSentAt = "2026-11-01T00:00:00.000Z";

  it("requires access, an enabled portal, a pending item, and 72 hours", () => {
    const now = new Date(Date.parse(accessSentAt) + PARTNER_REMINDER_INTERVAL_MS);
    expect(
      isAutomaticReminderEligible({
        accessSent: false,
        accessEnabled: true,
        pendingCount: 1,
        now,
        anchor: { automationEnabledAt: "2026-10-01T00:00:00.000Z", accessSentAt },
      })
    ).toBe(false);
    expect(
      isAutomaticReminderEligible({
        accessSent: true,
        accessEnabled: false,
        pendingCount: 1,
        now,
        anchor: { automationEnabledAt: "2026-10-01T00:00:00.000Z", accessSentAt },
      })
    ).toBe(false);
    expect(
      isAutomaticReminderEligible({
        accessSent: true,
        accessEnabled: true,
        pendingCount: 0,
        now,
        anchor: { automationEnabledAt: "2026-10-01T00:00:00.000Z", accessSentAt },
      })
    ).toBe(false);
    expect(
      isAutomaticReminderEligible({
        accessSent: true,
        accessEnabled: true,
        pendingCount: 1,
        now: new Date(Date.parse(accessSentAt) + 71 * HOUR),
        anchor: { automationEnabledAt: "2026-10-01T00:00:00.000Z", accessSentAt },
      })
    ).toBe(false);
    expect(
      isAutomaticReminderEligible({
        accessSent: true,
        accessEnabled: true,
        pendingCount: 1,
        now,
        anchor: { automationEnabledAt: "2026-10-01T00:00:00.000Z", accessSentAt },
      })
    ).toBe(true);
  });

  it("resets the clock from meaningful activity and from either reminder send", () => {
    const activityAt = "2026-11-02T00:00:00.000Z";
    const tooSoon = new Date(Date.parse(activityAt) + 71 * HOUR);
    const ready = new Date(Date.parse(activityAt) + PARTNER_REMINDER_INTERVAL_MS);
    expect(
      isAutomaticReminderEligible({
        accessSent: true,
        accessEnabled: true,
        pendingCount: 2,
        now: tooSoon,
        anchor: { automationEnabledAt: "2026-10-01T00:00:00.000Z", accessSentAt, lastActivityAt: activityAt },
      })
    ).toBe(false);
    expect(
      isAutomaticReminderEligible({
        accessSent: true,
        accessEnabled: true,
        pendingCount: 2,
        now: ready,
        anchor: { automationEnabledAt: "2026-10-01T00:00:00.000Z", accessSentAt, lastActivityAt: activityAt },
      })
    ).toBe(true);
    expect(reminderAnchor({ accessSentAt, lastActivityAt: activityAt })?.toISOString()).toBe(
      new Date(activityAt).toISOString()
    );
    expect(
      reminderAnchor({
        accessSentAt,
        lastActivityAt: activityAt,
        automationEnabledAt: "2026-11-10T00:00:00.000Z",
      })?.toISOString()
    ).toBe("2026-11-10T00:00:00.000Z");

    const remindedAt = "2026-11-05T00:00:00.000Z";
    expect(
      isAutomaticReminderEligible({
        accessSent: true,
        accessEnabled: true,
        pendingCount: 1,
        now: new Date(Date.parse(remindedAt) + 24 * HOUR),
        anchor: {
          automationEnabledAt: "2026-10-01T00:00:00.000Z",
          accessSentAt,
          lastActivityAt: activityAt,
          lastAutomaticReminderAt: remindedAt,
        },
      })
    ).toBe(false);
    expect(
      isAutomaticReminderEligible({
        accessSent: true,
        accessEnabled: true,
        pendingCount: 1,
        now: new Date(Date.parse(remindedAt) + 24 * HOUR),
        anchor: {
          automationEnabledAt: "2026-10-01T00:00:00.000Z",
          accessSentAt,
          lastActivityAt: activityAt,
          lastManualReminderAt: remindedAt,
        },
      })
    ).toBe(false);
  });

  it("stops automatic reminders at the start of 2 December 2026 IST", () => {
    expect(isBeforeAutomaticReminderDeadline(new Date("2026-12-01T18:29:00.000Z"))).toBe(
      true
    );
    expect(isBeforeAutomaticReminderDeadline(new Date("2026-12-01T18:30:00.000Z"))).toBe(
      false
    );
    expect(
      isAutomaticReminderEligible({
        accessSent: true,
        accessEnabled: true,
        pendingCount: 3,
        now: new Date("2026-12-01T18:30:00.000Z"),
        anchor: { automationEnabledAt: "2026-10-01T00:00:00.000Z", accessSentAt: "2026-11-01T00:00:00.000Z" },
      })
    ).toBe(false);
  });

  it("does not treat historical inactivity as due until 72 hours after go-live", () => {
    const accessSentAt = "2026-08-01T00:00:00.000Z";
    const enabledAt = "2026-10-24T00:00:00.000Z";
    expect(
      isAutomaticReminderEligible({
        accessSent: true,
        accessEnabled: true,
        pendingCount: 4,
        now: new Date("2026-10-24T02:00:00.000Z"),
        anchor: { accessSentAt },
      })
    ).toBe(false);
    expect(
      isAutomaticReminderEligible({
        accessSent: true,
        accessEnabled: true,
        pendingCount: 4,
        now: new Date(Date.parse(enabledAt) + 71 * HOUR),
        anchor: { automationEnabledAt: enabledAt, accessSentAt },
      })
    ).toBe(false);
    expect(
      isAutomaticReminderEligible({
        accessSent: true,
        accessEnabled: true,
        pendingCount: 4,
        now: new Date(Date.parse(enabledAt) + PARTNER_REMINDER_INTERVAL_MS),
        anchor: { automationEnabledAt: enabledAt, accessSentAt },
      })
    ).toBe(true);
  });

  it("detects partner submission changes and ignores an unchanged save", () => {
    const before = partner({ portalFasciaName: "OLD", portalSmsContent: "Hello" });
    expect(meaningfulPartnerActivity(before, { ...before, updatedAt: "2026-11-03T00:00:00.000Z" })).toBe(
      null
    );
    expect(
      meaningfulPartnerActivity(before, { ...before, portalFasciaName: "NEW NAME" })?.eventIds
    ).toEqual(["evt-001"]);
    expect(
      meaningfulPartnerActivity(before, {
        ...before,
        portalSeminarSpeakers: [
          {
            eventId: "evt-002",
            seminarId: "sem-001",
            speakers: [],
            updatedAt: "2026-11-03T00:00:00.000Z",
          },
        ],
      })?.eventIds
    ).toEqual(["evt-002"]);
  });
});
