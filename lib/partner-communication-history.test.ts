import { describe, expect, it } from "vitest";

import {
  formatCommunicationSentAt,
  lastReminderIndicator,
  presentCommunicationHistory,
  type CommunicationHistorySource,
} from "@/lib/partner-communication-history";
import { createMemoryPartnerCommunicationLogStore } from "@/lib/server/partner-communication-log";

function entry(
  overrides: Partial<CommunicationHistorySource> &
    Pick<CommunicationHistorySource, "id" | "communicationType" | "sentAt">
): CommunicationHistorySource {
  return {
    triggerType: "AUTOMATIC",
    outcome: "accepted",
    recipientEmail: "office@example.edu",
    ...overrides,
  };
}

describe("partner communication history", () => {
  it("formats sent times in Asia/Kolkata", () => {
    expect(formatCommunicationSentAt("2026-10-24T06:00:00.000Z")).toBe(
      "24 Oct 2026, 11:30 AM"
    );
    expect(formatCommunicationSentAt("2026-10-25T09:45:00.000Z")).toBe(
      "25 Oct 2026, 3:15 PM"
    );
  });

  it("lists accepted communications newest first and keeps automatic and manual distinct", () => {
    const history = presentCommunicationHistory([
      entry({
        id: "pending-manual",
        communicationType: "PENDING_ACTIONS_REMINDER",
        triggerType: "MANUAL",
        sentAt: "2026-10-24T06:00:00.000Z",
        metadata: {
          pendingLabels: ["Institution Logo", "Speaker Details"],
        },
      }),
      entry({
        id: "speaker-manual",
        communicationType: "SPEAKER_DETAILS_REQUEST",
        triggerType: "MANUAL",
        sentAt: "2026-10-25T09:45:00.000Z",
      }),
      entry({
        id: "panel-auto",
        communicationType: "PANEL_DISCUSSION_DETAILS",
        triggerType: "AUTOMATIC",
        sentAt: "2026-10-23T04:00:00.000Z",
      }),
    ]);

    expect(history.map((item) => item.id)).toEqual([
      "speaker-manual",
      "pending-manual",
      "panel-auto",
    ]);
    expect(history.map((item) => item.triggerLabel)).toEqual([
      "Manual",
      "Manual",
      "Automatic",
    ]);
    expect(history[0]).toMatchObject({
      name: "Speaker Details Request",
      sentAtLabel: "25 Oct 2026, 3:15 PM",
      status: "Sent",
      recipientEmail: "office@example.edu",
    });
    expect(history[1]?.sentAtLabel).toBe("24 Oct 2026, 11:30 AM");
    expect(history[1]?.name).toBe("Pending Actions Reminder");
  });

  it("shows pending item labels only on a pending-actions reminder", () => {
    const history = presentCommunicationHistory([
      entry({
        id: "pending",
        communicationType: "PENDING_ACTIONS_REMINDER",
        sentAt: "2026-10-24T06:00:00.000Z",
        metadata: {
          pendingKeys: ["logo", "speaker:evt-001:sem-001"],
          pendingLabels: [
            "Institution Logo",
            "Full Page Advertisement Artwork",
            "Speaker Details",
          ],
        },
      }),
      entry({
        id: "readiness",
        communicationType: "PARTICIPATION_READINESS",
        sentAt: "2026-10-26T04:00:00.000Z",
        metadata: { pendingKeys: ["logo"], pendingLabels: ["Institution Logo"] },
      }),
      entry({
        id: "speaker",
        communicationType: "SPEAKER_DETAILS_REQUEST",
        sentAt: "2026-10-25T09:45:00.000Z",
        metadata: { pendingKeys: ["speaker:evt-001:sem-001"] },
      }),
    ]);

    expect(history.find((item) => item.id === "pending")?.pendingItems).toEqual([
      "Institution Logo",
      "Full Page Advertisement Artwork",
      "Speaker Details",
    ]);
    expect(history.find((item) => item.id === "readiness")?.pendingItems).toBeUndefined();
    expect(history.find((item) => item.id === "speaker")?.pendingItems).toBeUndefined();
  });

  it("falls back to stored pending keys when a reminder has no labels", () => {
    const history = presentCommunicationHistory([
      entry({
        id: "pending",
        communicationType: "PENDING_ACTIONS_REMINDER",
        sentAt: "2026-10-24T06:00:00.000Z",
        metadata: { pendingKeys: ["logo", "representatives:evt-001"] },
      }),
    ]);
    expect(history[0]?.pendingItems).toEqual(["University logo", "Event representatives"]);
  });

  it("does not present failed or unknown sends as sent", () => {
    const history = presentCommunicationHistory([
      entry({
        id: "failed",
        communicationType: "PENDING_ACTIONS_REMINDER",
        sentAt: "2026-10-26T06:00:00.000Z",
        outcome: "definitive_failure",
      }),
      entry({
        id: "unknown",
        communicationType: "PANEL_DISCUSSION_DETAILS",
        sentAt: "2026-10-26T07:00:00.000Z",
        outcome: "unknown",
      }),
      entry({
        id: "sent",
        communicationType: "SPEAKER_DETAILS_RECEIVED",
        sentAt: "2026-10-24T06:00:00.000Z",
      }),
    ]);
    expect(history.map((item) => item.id)).toEqual(["sent"]);
    expect(history[0]?.status).toBe("Sent");
    expect(history[0]?.name).toBe("Speaker Details Received");
  });

  it("does not expose passwords, tokens, hashes, message ids, or email bodies", () => {
    const history = presentCommunicationHistory([
      entry({
        id: "pending",
        communicationType: "PENDING_ACTIONS_REMINDER",
        sentAt: "2026-10-24T06:00:00.000Z",
        metadata: {
          pendingLabels: ["University logo"],
          password: "secret",
          token: "reset-token",
          hash: "abc",
          html: "<p>Hello</p>",
          text: "Hello",
          body: "Hello",
        } as CommunicationHistorySource["metadata"],
      }),
    ]);
    const serialized = JSON.stringify(history);
    expect(serialized).not.toMatch(/password|token|hash|html|text|body|secret|reset-token/i);
    expect(serialized).not.toMatch(/messageId/);
    expect(history[0]?.pendingItems).toEqual(["University logo"]);
  });

  it("uses the latest accepted reminder and stays quiet when none exists", () => {
    expect(lastReminderIndicator([])).toBeNull();
    expect(
      lastReminderIndicator([
        entry({
          id: "readiness",
          communicationType: "PARTICIPATION_READINESS",
          sentAt: "2026-10-26T04:00:00.000Z",
        }),
        entry({
          id: "failed",
          communicationType: "PENDING_ACTIONS_REMINDER",
          sentAt: "2026-10-27T04:00:00.000Z",
          outcome: "definitive_failure",
        }),
      ])
    ).toBeNull();

    expect(
      lastReminderIndicator([
        entry({
          id: "older",
          communicationType: "PENDING_ACTIONS_REMINDER",
          triggerType: "AUTOMATIC",
          sentAt: "2026-10-24T06:00:00.000Z",
        }),
        entry({
          id: "newer-readiness",
          communicationType: "PARTICIPATION_READINESS",
          sentAt: "2026-10-26T04:00:00.000Z",
        }),
        entry({
          id: "newer-manual",
          communicationType: "SPEAKER_DETAILS_REQUEST",
          triggerType: "MANUAL",
          sentAt: "2026-10-25T09:45:00.000Z",
        }),
      ])
    ).toEqual({
      sentAt: "2026-10-25T09:45:00.000Z",
      sentAtLabel: "25 Oct 2026, 3:15 PM",
      triggerLabel: "Manual",
    });
  });

  it("keeps the recipient stored at send time when a later send uses a new address", async () => {
    const store = createMemoryPartnerCommunicationLogStore();
    await store.append({
      partnerId: "partner-001",
      eventId: "evt-001",
      communicationType: "PENDING_ACTIONS_REMINDER",
      triggerType: "AUTOMATIC",
      sentAt: "2026-10-24T06:00:00.000Z",
      messageId: "auto-1",
      recipientEmail: "Office@Example.edu",
      metadata: { pendingLabels: ["University logo"] },
    });
    await store.append({
      partnerId: "partner-001",
      eventId: "evt-001",
      communicationType: "SPEAKER_DETAILS_REQUEST",
      triggerType: "MANUAL",
      sentAt: "2026-10-25T09:45:00.000Z",
      messageId: "manual-1",
      recipientEmail: "new-office@example.edu",
      metadata: {
        pendingKeys: ["speaker:evt-001:sem-001"],
        password: "nope",
        html: "<p>body</p>",
      } as never,
    });

    const logs = await store.listForPartner("partner-001");
    expect(logs[0]?.recipientEmail).toBe("office@example.edu");
    expect(logs[1]?.recipientEmail).toBe("new-office@example.edu");
    expect(logs[0]?.metadata).toEqual({ pendingLabels: ["University logo"] });
    expect(logs[1]?.metadata).toEqual({
      pendingKeys: ["speaker:evt-001:sem-001"],
    });

    const history = presentCommunicationHistory(logs);
    expect(history.map((item) => item.recipientEmail)).toEqual([
      "new-office@example.edu",
      "office@example.edu",
    ]);
    expect(history[1]?.pendingItems).toEqual(["University logo"]);
    expect(history[0]?.pendingItems).toBeUndefined();
    expect(JSON.stringify(logs[1]?.metadata)).not.toMatch(/password|html|body/i);
  });
});
