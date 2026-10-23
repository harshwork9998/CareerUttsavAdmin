import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  WHATSAPP_RESUME_INACTIVITY_MS,
  type WhatsAppConversationState,
} from "@/lib/server/whatsapp/registration-conversation";
import { REGISTRATION_INTERACTIVE_IDS } from "@/lib/server/whatsapp/registration-interactive-ids";
import {
  META_CTA_URL_DISPLAY_TEXT_LIMIT,
  validateWhatsAppUrlCtaAction,
} from "@/lib/server/whatsapp/meta-action-mapper";
import { setMetaClientFetchForTests } from "@/lib/server/whatsapp/meta-client";
import {
  WHATSAPP_REMINDER_12H_MS,
  WHATSAPP_REMINDER_2H_MS,
  WHATSAPP_REMINDER_6H_MS,
} from "@/lib/server/whatsapp/whatsapp-registration-reminder-config";
import {
  buildWhatsAppRegistrationReminder12hActions,
  buildWhatsAppRegistrationReminder2hActions,
  buildWhatsAppRegistrationReminder6hActions,
  WHATSAPP_REMINDER_2H_BUTTON_TITLE,
} from "@/lib/server/whatsapp/whatsapp-registration-reminder-messages";
import { WHATSAPP_SEMINAR_FINISH_BUTTON_TITLE, WHATSAPP_SEMINAR_IMAGE_CAPTION } from "@/lib/server/whatsapp/whatsapp-artwork-seminar-catalog";
import { buildWhatsAppRegistrationSuccessActions } from "@/lib/server/whatsapp/whatsapp-registration-bot-actions";
import {
  buildEditableWhatsAppShareUrl,
  editableWhatsAppShareHasFixedRecipient,
} from "@/lib/server/whatsapp/whatsapp-share-link";
import {
  buildFriendInviteGrowthAction,
  buildInstagramGrowthAction,
  buildParentInviteGrowthAction,
  CAREER_UTTSAV_PUBLIC_REGISTRATION_URL,
  postRegistrationGrowthDueAt,
  WHATSAPP_FRIEND_INVITE_BODY,
  WHATSAPP_FRIEND_INVITE_CTA_LABEL,
  WHATSAPP_FRIEND_INVITE_SHARE_TEXT,
  WHATSAPP_INSTAGRAM_CTA_LABEL,
  WHATSAPP_INSTAGRAM_PROFILE_URL,
  WHATSAPP_PARENT_INVITE_BODY,
  WHATSAPP_PARENT_INVITE_CTA_LABEL,
  WHATSAPP_PARENT_INVITE_SHARE_TEXT,
  WHATSAPP_POST_REGISTRATION_FRIEND_DELAY_MS,
  WHATSAPP_POST_REGISTRATION_INSTAGRAM_DELAY_MS,
  WHATSAPP_POST_REGISTRATION_PARENT_DELAY_MS,
} from "@/lib/server/whatsapp/whatsapp-post-registration-messages";
import { WHATSAPP_POST_REGISTRATION_CLAIM_LEASE_MS } from "@/lib/server/whatsapp/whatsapp-post-registration-store";
import { runSerializedForWaId } from "@/lib/server/whatsapp/whatsapp-wa-id-serializer";

type TriggerStatus = "PENDING" | "CLAIMED" | "SENT" | "CANCELLED";
type TriggerKind = "INSTAGRAM" | "PARENT_INVITE" | "FRIEND_INVITE";

type StoredTrigger = {
  id: string;
  waId: string;
  registrationId: string;
  kind: TriggerKind;
  dueAt: Date;
  status: TriggerStatus;
  claimedAt: Date | null;
  sentAt: Date | null;
  attemptCount: number;
  lastError: string | null;
};

const rows: StoredTrigger[] = [];
let conversationRecord: Record<string, unknown> | null = null;
const dispatchMock = vi.fn();

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    whatsAppPostRegistrationTrigger: {
      createMany: async ({
        data,
      }: {
        data: Array<{
          waId: string;
          registrationId: string;
          kind: TriggerKind;
          dueAt: Date;
          status: TriggerStatus;
        }>;
      }) => {
        for (const item of data) {
          if (
            rows.some(
              (row) =>
                row.registrationId === item.registrationId && row.kind === item.kind
            )
          ) {
            continue;
          }
          rows.push({
            id: `trig-${rows.length + 1}`,
            waId: item.waId,
            registrationId: item.registrationId,
            kind: item.kind,
            dueAt: item.dueAt,
            status: "PENDING",
            claimedAt: null,
            sentAt: null,
            attemptCount: 0,
            lastError: null,
          });
        }
        return { count: data.length };
      },
      findMany: async ({
        where,
      }: {
        where: { dueAt: { lte: Date } };
      }) => {
        const now = where.dueAt.lte;
        const leaseBefore = new Date(
          now.getTime() - WHATSAPP_POST_REGISTRATION_CLAIM_LEASE_MS
        );
        return rows.filter(
          (row) =>
            row.dueAt.getTime() <= now.getTime() &&
            (row.status === "PENDING" ||
              (row.status === "CLAIMED" &&
                row.claimedAt !== null &&
                row.claimedAt.getTime() < leaseBefore.getTime()))
        );
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: {
          status?: TriggerStatus;
          claimedAt?: Date | null;
          sentAt?: Date | null;
          lastError?: string | null;
          attemptCount?: { increment: number };
        };
      }) => {
        const row = rows.find((item) => item.id === where.id);
        if (!row || !data.status) return { count: 0 };
        const now = data.claimedAt instanceof Date ? data.claimedAt : new Date();
        const leaseBefore = new Date(
          now.getTime() - WHATSAPP_POST_REGISTRATION_CLAIM_LEASE_MS
        );
        if (data.status === "CLAIMED") {
          const claimable =
            row.dueAt.getTime() <= now.getTime() &&
            (row.status === "PENDING" ||
              (row.status === "CLAIMED" &&
                row.claimedAt !== null &&
                row.claimedAt.getTime() < leaseBefore.getTime()));
          if (!claimable) return { count: 0 };
          row.status = "CLAIMED";
          row.claimedAt = now;
          row.attemptCount += 1;
          row.lastError = null;
          return { count: 1 };
        }
        if (data.status === "SENT") {
          if (row.status !== "CLAIMED") return { count: 0 };
          row.status = "SENT";
          row.sentAt = data.sentAt ?? now;
          row.claimedAt = null;
          row.lastError = null;
          return { count: 1 };
        }
        if (data.status === "PENDING") {
          if (row.status !== "CLAIMED") return { count: 0 };
          row.status = "PENDING";
          row.claimedAt = null;
          row.lastError = data.lastError ?? null;
          return { count: 1 };
        }
        if (data.status === "CANCELLED") {
          if (row.status !== "PENDING" && row.status !== "CLAIMED") return { count: 0 };
          row.status = "CANCELLED";
          row.claimedAt = null;
          row.lastError = data.lastError ?? null;
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    whatsAppRegistrationConversation: {
      findUnique: async ({ where }: { where: { waId: string } }) => {
        if (!conversationRecord || conversationRecord.waId !== where.waId) return null;
        return conversationRecord;
      },
    },
  },
}));

vi.mock("@/lib/server/whatsapp/whatsapp-bot-dispatcher", () => ({
  dispatchWhatsAppBotActions: (...args: unknown[]) => dispatchMock(...args),
}));

import { schedulePostRegistrationGrowthTriggers } from "@/lib/server/whatsapp/whatsapp-post-registration-schedule";
import { processPostRegistrationGrowthTriggers } from "@/lib/server/whatsapp/whatsapp-post-registration-processor";
import { dispatchWhatsAppBotActionToMeta } from "@/lib/server/whatsapp/meta-action-mapper";

const completedAt = new Date("2026-10-22T12:00:00.000Z");

function completedConversation(
  overrides: Partial<WhatsAppConversationState> = {}
): WhatsAppConversationState {
  return {
    waId: "919876543210",
    status: "COMPLETED",
    currentStep: "COMPLETED",
    studentName: "Aarav Sharma",
    email: "aarav@example.com",
    classLabel: "Class 10",
    gender: "Male",
    board: "CBSE",
    interestedStream: "Science",
    college: "National Public School",
    city: "Bangalore",
    selectedSeminarIds: ["sem-2026-01"],
    completedRegistrationId: "reg-001",
    ...overrides,
  };
}

function rememberConversation(conversation: WhatsAppConversationState | null): void {
  if (!conversation) {
    conversationRecord = null;
    return;
  }
  conversationRecord = {
    ...conversation,
    selectedSeminarIds: conversation.selectedSeminarIds,
    expiresAt: new Date("2026-10-29T12:00:00.000Z"),
    lastInboundAt: completedAt,
  };
}

async function scheduleCompleted(): Promise<void> {
  rememberConversation(completedConversation());
  const result = await schedulePostRegistrationGrowthTriggers({
    waId: "919876543210",
    registrationId: "reg-001",
    completedAt,
    conversation: completedConversation(),
  });
  expect(result.scheduled).toBe(true);
}

describe("post-registration growth", () => {
  beforeEach(() => {
    rows.splice(0, rows.length);
    conversationRecord = null;
    dispatchMock.mockReset();
    dispatchMock.mockResolvedValue({
      dispatched: 1,
      failed: 0,
      results: [{ actionType: "URL_CTA", success: true, messageId: "wamid.1" }],
    });
  });

  afterEach(() => {
    setMetaClientFetchForTests(null);
  });

  it("keeps the save-QR line as the last immediate registration message", () => {
    const actions = buildWhatsAppRegistrationSuccessActions({
      registrationNumber: "CU-BLR-2026-00042",
      qrPngBase64: Buffer.from("qr").toString("base64"),
      studentName: "Aarav Sharma",
    });
    expect(actions.map((action) => action.type)).toEqual(["TEXT", "MEDIA", "TEXT"]);
    expect(actions.at(-1)).toMatchObject({
      type: "TEXT",
      body: "\u{1F4F1} Save this QR code. You\u2019ll need it when you arrive.",
    });
    expect(JSON.stringify(actions).toLowerCase()).not.toContain("come alone");
    expect(actions.some((action) => action.type === "URL_CTA")).toBe(false);
  });

  it("anchors Instagram, parents, and friends to one completion time", () => {
    const due = postRegistrationGrowthDueAt(completedAt);
    expect(due.INSTAGRAM.getTime() - completedAt.getTime()).toBe(
      WHATSAPP_POST_REGISTRATION_INSTAGRAM_DELAY_MS
    );
    expect(WHATSAPP_POST_REGISTRATION_INSTAGRAM_DELAY_MS).toBe(10_000);
    expect(due.PARENT_INVITE.getTime() - completedAt.getTime()).toBe(
      WHATSAPP_POST_REGISTRATION_PARENT_DELAY_MS
    );
    expect(due.FRIEND_INVITE.getTime() - completedAt.getTime()).toBe(
      WHATSAPP_POST_REGISTRATION_FRIEND_DELAY_MS
    );
    expect(due.PARENT_INVITE.getTime() - due.INSTAGRAM.getTime()).not.toBe(
      WHATSAPP_POST_REGISTRATION_PARENT_DELAY_MS
    );
  });

  it("does not send Instagram before it is due and sends it once when overdue", async () => {
    await scheduleCompleted();
    const early = await processPostRegistrationGrowthTriggers(
      new Date(completedAt.getTime() + 9_000)
    );
    expect(early.checked).toBe(0);
    expect(dispatchMock).not.toHaveBeenCalled();

    const due = await processPostRegistrationGrowthTriggers(
      new Date(completedAt.getTime() + 10_000)
    );
    expect(due.sentInstagram).toBe(1);
    expect(due.sentParentInvite).toBe(0);
    const action = dispatchMock.mock.calls[0]?.[1]?.[0];
    expect(WHATSAPP_INSTAGRAM_CTA_LABEL).toBe("Follow on Instagram");
    expect(action).toMatchObject({
      type: "URL_CTA",
      body: "Aarav, we\u2019re revealing universities, speakers and what\u2019s happening at Career Uttsav \u{1F440}\nFollow along so you don\u2019t miss the good stuff.",
      displayText: "Follow on Instagram",
      url: WHATSAPP_INSTAGRAM_PROFILE_URL,
    });
    expect(WHATSAPP_INSTAGRAM_PROFILE_URL).toBe(
      "https://www.instagram.com/careeruttsav/"
    );

    dispatchMock.mockClear();
    const again = await processPostRegistrationGrowthTriggers(
      new Date(completedAt.getTime() + 20_000)
    );
    expect(again.checked).toBe(0);
    expect(dispatchMock).not.toHaveBeenCalled();
    expect(rows.filter((row) => row.kind === "INSTAGRAM" && row.status === "SENT")).toHaveLength(1);
  });

  it("sends the parent invite once with an editable share link", async () => {
    await scheduleCompleted();
    const result = await processPostRegistrationGrowthTriggers(
      new Date(completedAt.getTime() + WHATSAPP_POST_REGISTRATION_PARENT_DELAY_MS)
    );
    expect(result.sentParentInvite).toBe(1);
    expect(result.sentFriendInvite).toBe(0);
    const parentCall = dispatchMock.mock.calls.find(
      (call) => call[1]?.[0]?.displayText === WHATSAPP_PARENT_INVITE_CTA_LABEL
    );
    const action = parentCall?.[1]?.[0];
    expect(action.body).toBe(WHATSAPP_PARENT_INVITE_BODY);
    expect(action.displayText).toBe("Invite My Parents \u2192");
    expect(action.type).toBe("URL_CTA");
    const shareUrl = action.url as string;
    expect(editableWhatsAppShareHasFixedRecipient(shareUrl)).toBe(false);
    expect(new URL(shareUrl).searchParams.get("text")).toBe(
      WHATSAPP_PARENT_INVITE_SHARE_TEXT
    );
    expect(WHATSAPP_PARENT_INVITE_SHARE_TEXT).toContain(
      "\n\nhttps://careeruttsav.in/"
    );
    expect(shareUrl).toContain("%26");
    expect(shareUrl).toContain("%0A");
    expect(shareUrl).toContain("%E2%80%99");
    expect(decodeURIComponent(shareUrl.split("text=")[1] ?? "")).toContain("\u{1F60A}");

    dispatchMock.mockClear();
    await processPostRegistrationGrowthTriggers(
      new Date(completedAt.getTime() + WHATSAPP_POST_REGISTRATION_PARENT_DELAY_MS + 1000)
    );
    expect(
      dispatchMock.mock.calls.some(
        (call) => call[1]?.[0]?.displayText === WHATSAPP_PARENT_INVITE_CTA_LABEL
      )
    ).toBe(false);
  });

  it("sends the friend invite once to the homepage registration destination", async () => {
    await scheduleCompleted();
    await processPostRegistrationGrowthTriggers(
      new Date(completedAt.getTime() + WHATSAPP_POST_REGISTRATION_FRIEND_DELAY_MS)
    );
    const friendCall = dispatchMock.mock.calls.find(
      (call) => call[1]?.[0]?.displayText === WHATSAPP_FRIEND_INVITE_CTA_LABEL
    );
    const action = friendCall?.[1]?.[0];
    expect(action.body).toBe(WHATSAPP_FRIEND_INVITE_BODY);
    expect(action.displayText).toBe("Share With Friends \u2192");
    expect(action.body).toContain("\u201CWhat next?\u201D");
    const shareText = new URL(action.url).searchParams.get("text");
    expect(shareText).toBe(WHATSAPP_FRIEND_INVITE_SHARE_TEXT);
    expect(shareText).toContain(CAREER_UTTSAV_PUBLIC_REGISTRATION_URL);
    expect(shareText).not.toContain("/student-registration");
    expect(CAREER_UTTSAV_PUBLIC_REGISTRATION_URL).toBe("https://careeruttsav.in/");
    expect(editableWhatsAppShareHasFixedRecipient(action.url)).toBe(false);
    expect(
      rows.filter((row) => row.kind === "FRIEND_INVITE" && row.status === "SENT")
    ).toHaveLength(1);
  });

  it("keeps a failed Instagram send retryable without cancelling later invites", async () => {
    await scheduleCompleted();
    dispatchMock.mockImplementation(async (_waId: string, actions: Array<{ url?: string }>) => {
      if (actions[0]?.url === WHATSAPP_INSTAGRAM_PROFILE_URL) {
        return {
          dispatched: 0,
          failed: 1,
          results: [{ actionType: "URL_CTA", success: false, errorCode: "META_NETWORK_ERROR", retryable: true }],
        };
      }
      return {
        dispatched: 1,
        failed: 0,
        results: [{ actionType: "URL_CTA", success: true, messageId: "wamid.parent" }],
      };
    });

    const first = await processPostRegistrationGrowthTriggers(
      new Date(completedAt.getTime() + WHATSAPP_POST_REGISTRATION_PARENT_DELAY_MS)
    );
    expect(first.failed).toBe(1);
    expect(first.sentParentInvite).toBe(1);
    expect(rows.find((row) => row.kind === "INSTAGRAM")?.status).toBe("PENDING");
    expect(rows.find((row) => row.kind === "PARENT_INVITE")?.status).toBe("SENT");
    expect(rows.find((row) => row.kind === "FRIEND_INVITE")?.status).toBe("PENDING");

    dispatchMock.mockResolvedValue({
      dispatched: 1,
      failed: 0,
      results: [{ actionType: "URL_CTA", success: true, messageId: "wamid.retry" }],
    });
    const retry = await processPostRegistrationGrowthTriggers(
      new Date(completedAt.getTime() + WHATSAPP_POST_REGISTRATION_PARENT_DELAY_MS + 1000)
    );
    expect(retry.sentInstagram).toBe(1);
    expect(rows.find((row) => row.kind === "INSTAGRAM")?.status).toBe("SENT");
  });

  it("does not double-send when two workers claim the same trigger", async () => {
    await scheduleCompleted();
    const now = new Date(completedAt.getTime() + 10_000);
    await Promise.all([
      processPostRegistrationGrowthTriggers(now),
      processPostRegistrationGrowthTriggers(now),
    ]);
    const instagramSends = dispatchMock.mock.calls.filter(
      (call) => call[1]?.[0]?.url === WHATSAPP_INSTAGRAM_PROFILE_URL
    );
    expect(instagramSends).toHaveLength(1);
    expect(rows.filter((row) => row.kind === "INSTAGRAM" && row.status === "SENT")).toHaveLength(1);
  });

  it("does not schedule incomplete, failed, or missing-waId conversations", async () => {
    const incomplete = await schedulePostRegistrationGrowthTriggers({
      waId: "919876543210",
      registrationId: "reg-001",
      completedAt,
      conversation: completedConversation({
        status: "ACTIVE",
        currentStep: "AWAITING_CITY",
        completedRegistrationId: null,
      }),
    });
    expect(incomplete).toEqual({ scheduled: false, reason: "not_completed" });

    const missing = await schedulePostRegistrationGrowthTriggers({
      waId: "+++",
      registrationId: "reg-001",
      completedAt,
      conversation: completedConversation(),
    });
    expect(missing).toEqual({ scheduled: false, reason: "missing_wa_id" });
    expect(rows).toHaveLength(0);
  });

  it("cancels a pending trigger when the conversation is cancelled", async () => {
    await scheduleCompleted();
    rememberConversation(
      completedConversation({ status: "CANCELLED", currentStep: "CANCELLED" })
    );
    const result = await processPostRegistrationGrowthTriggers(
      new Date(completedAt.getTime() + 10_000)
    );
    expect(result.cancelled).toBe(1);
    expect(result.sentInstagram).toBe(0);
    expect(dispatchMock).not.toHaveBeenCalled();
    expect(rows.find((row) => row.kind === "INSTAGRAM")?.status).toBe("CANCELLED");
  });

  it("schedules the same three rows again without duplicating them", async () => {
    await scheduleCompleted();
    await scheduleCompleted();
    expect(rows).toHaveLength(3);
  });

  it("maps a URL CTA through the Meta payload without a reply button", async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = "test-access-token-local-only";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789012345";
    process.env.WHATSAPP_GRAPH_API_VERSION = "v22.0";
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.type).toBe("interactive");
      expect(body.interactive.type).toBe("cta_url");
      expect(body.interactive.action.name).toBe("cta_url");
      expect(body.interactive.action.parameters.display_text).toBe(
        WHATSAPP_PARENT_INVITE_CTA_LABEL
      );
      expect(body.interactive.action.buttons).toBeUndefined();
      return {
        ok: true,
        status: 200,
        json: async () => ({ messages: [{ id: "wamid.cta" }] }),
      } as Response;
    });
    setMetaClientFetchForTests(fetchMock as typeof fetch);

    const parent = buildParentInviteGrowthAction();
    expect(validateWhatsAppUrlCtaAction(parent).ok).toBe(true);
    const friend = buildFriendInviteGrowthAction();
    expect(validateWhatsAppUrlCtaAction(friend).ok).toBe(true);
    const sent = await dispatchWhatsAppBotActionToMeta("919876543210", parent);
    expect(sent.success).toBe(true);

    const instagram = buildInstagramGrowthAction("Aarav");
    expect(instagram.displayText).toBe("Follow on Instagram");
    expect(instagram.displayText.length).toBeLessThanOrEqual(
      META_CTA_URL_DISPLAY_TEXT_LIMIT
    );
    expect(validateWhatsAppUrlCtaAction(instagram).ok).toBe(true);
  });

  it("leaves the incomplete-registration reminders and seminar step unchanged", () => {
    expect(WHATSAPP_RESUME_INACTIVITY_MS).toBe(30 * 60 * 1000);
    expect(WHATSAPP_REMINDER_2H_MS).toBe(2 * 60 * 60 * 1000);
    expect(WHATSAPP_REMINDER_6H_MS).toBe(6 * 60 * 60 * 1000);
    expect(WHATSAPP_REMINDER_12H_MS).toBe(12 * 60 * 60 * 1000);
    expect(WHATSAPP_REMINDER_2H_BUTTON_TITLE).toBe("Continue");
    const reminderConversation = completedConversation({
      status: "ACTIVE",
      currentStep: "AWAITING_EMAIL",
      completedRegistrationId: null,
    });
    const twoHour = buildWhatsAppRegistrationReminder2hActions(reminderConversation)[0];
    expect(twoHour).toMatchObject({
      type: "BUTTONS",
      buttons: [
        { id: REGISTRATION_INTERACTIVE_IDS.CONTINUE, title: "Continue" },
        { id: REGISTRATION_INTERACTIVE_IDS.RESTART, title: "Start Over" },
      ],
    });
    expect(REGISTRATION_INTERACTIVE_IDS.CONTINUE).toBe("registration:continue");
    const sixHour = buildWhatsAppRegistrationReminder6hActions(reminderConversation)[0];
    expect(sixHour?.type).toBe("BUTTONS");
    if (sixHour?.type === "BUTTONS") {
      expect(sixHour.buttons[0]?.title).toBe("Get My Free Pass \u2192");
    }
    expect(buildWhatsAppRegistrationReminder12hActions(reminderConversation)[0]).toMatchObject({
      type: "BUTTONS",
    });
    expect(WHATSAPP_SEMINAR_FINISH_BUTTON_TITLE).toBe("Finish Registration");
    expect(WHATSAPP_SEMINAR_IMAGE_CAPTION).toContain("Example: 2 or 2,8 or 2,8,14");
    expect(typeof runSerializedForWaId).toBe("function");
    const share = buildEditableWhatsAppShareUrl("Mom & Dad\nLine");
    expect(share.startsWith("https://api.whatsapp.com/send?text=")).toBe(true);
    expect(share).not.toContain("phone=");
  });
});
