import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WhatsAppBotAction } from "@/lib/server/whatsapp/registration-conversation";
import type { WhatsAppConversationState } from "@/lib/server/whatsapp/registration-conversation";
import {
  buildWhatsAppRegistrationSuccessActions,
  WHATSAPP_REGISTRATION_ENTRY_PASS_FILENAME,
} from "@/lib/server/whatsapp/whatsapp-registration-bot-actions";
import type { WhatsAppBotDispatchSummary } from "@/lib/server/whatsapp/whatsapp-bot-dispatcher";
import {
  postRegistrationGrowthDueAt,
  WHATSAPP_POST_REGISTRATION_FRIEND_DELAY_MS,
} from "@/lib/server/whatsapp/whatsapp-post-registration-messages";
import { WHATSAPP_CUSTOMER_SERVICE_WINDOW_MS } from "@/lib/server/whatsapp/whatsapp-growth-channel-policy";
import { channelInvitePromotionalBlockReason } from "@/lib/server/whatsapp/whatsapp-growth-channel-policy";
import { POST_REGISTRATION_GROWTH_RECOVERY_LOOKBACK_MS } from "@/lib/server/whatsapp/whatsapp-post-registration-recovery";

const WA_ID = "919876543210";
const REGISTRATION_ID = "reg-001";
const QR_BASE64 = Buffer.from("qr-png-bytes").toString("base64");

const hoisted = vi.hoisted(() => ({
  eligibilityAt: null as Date | null,
  triggerCount: 0,
  markCalls: 0,
  scheduleCalls: [] as Array<{
    waId: string;
    registrationId: string;
    completedAt: Date;
  }>,
  dispatchCalls: [] as WhatsAppBotAction[][],
}));

const claimMock = vi.fn();
const markProcessedMock = vi.fn();
const loadConversationMock = vi.fn();
const saveConversationMock = vi.fn();
const deleteExpiredMock = vi.fn();
const getSeminarsMock = vi.fn();
const getCatalogMock = vi.fn();
const dispatchMock = vi.fn();
const processTurnMock = vi.fn();
const scheduleMock = vi.fn();

vi.mock("@/lib/server/whatsapp/whatsapp-inbound-message-store", () => ({
  claimWhatsAppInboundMessage: (...args: unknown[]) => claimMock(...args),
  markWhatsAppInboundMessageProcessed: (...args: unknown[]) =>
    markProcessedMock(...args),
}));

vi.mock("@/lib/server/whatsapp/whatsapp-conversation-store", () => ({
  loadWhatsAppConversationTurnContext: (...args: unknown[]) =>
    loadConversationMock(...args),
  saveWhatsAppConversationState: (...args: unknown[]) =>
    saveConversationMock(...args),
  deleteExpiredWhatsAppConversation: (...args: unknown[]) =>
    deleteExpiredMock(...args),
  loadWhatsAppConversationRecordByWaId: async () => completedConversation(),
}));

vi.mock("@/lib/server/whatsapp/whatsapp-seminar-context", () => ({
  getWhatsAppSeminarOptions: (...args: unknown[]) => getSeminarsMock(...args),
  getWhatsAppEventArtworkSeminarOptions: async () => [],
  getWhatsAppSeminarDayCatalog: (...args: unknown[]) => getCatalogMock(...args),
}));

vi.mock("@/lib/server/whatsapp/whatsapp-bot-dispatcher", async (importActual) => {
  const actual = await importActual<
    typeof import("@/lib/server/whatsapp/whatsapp-bot-dispatcher")
  >();
  return {
    ...actual,
    dispatchWhatsAppBotActions: (...args: unknown[]) => dispatchMock(...args),
  };
});

vi.mock("@/lib/server/whatsapp/whatsapp-registration-duplicate-flow", () => ({
  processWhatsAppRegistrationConversationTurnAsync: (...args: unknown[]) =>
    processTurnMock(...args),
}));

vi.mock("@/lib/server/registration-service", () => ({
  getRegistrationForApi: vi.fn(),
}));

vi.mock("@/lib/server/whatsapp/whatsapp-registration-completion", () => ({
  completeWhatsAppRegistrationForConversation: vi.fn(),
}));

vi.mock("@/lib/server/whatsapp/whatsapp-growth-schedule-eligibility", async (importActual) => {
  const actual = await importActual<
    typeof import("@/lib/server/whatsapp/whatsapp-growth-schedule-eligibility")
  >();
  return {
    ...actual,
    markPostRegistrationEntryPassDelivered: async (_waId: string, at: Date) => {
      hoisted.markCalls += 1;
      hoisted.eligibilityAt = at;
      return actual.markPostRegistrationEntryPassDelivered(_waId, at);
    },
  };
});

vi.mock("@/lib/server/whatsapp/campaign-suppression", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/server/whatsapp/campaign-suppression")
  >();
  return {
    ...actual,
    isPhoneSuppressed: vi.fn(async () => false),
  };
});

vi.mock("@/lib/server/whatsapp/whatsapp-post-registration-schedule", () => ({
  schedulePostRegistrationGrowthTriggers: (...args: unknown[]) => scheduleMock(...args),
  postRegistrationGrowthScheduleBlockReason: vi.fn(),
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    whatsAppRegistrationConversation: {
      findMany: async (args?: {
        where?: {
          postRegistrationEntryPassDeliveredAt?: { gte?: Date; not: null };
        };
        take?: number;
      }) => {
        const at = hoisted.eligibilityAt;
        if (!at) return [];
        const since = args?.where?.postRegistrationEntryPassDeliveredAt?.gte;
        if (since && at.getTime() < since.getTime()) return [];
        return [
          {
            waId: WA_ID,
            completedRegistrationId: REGISTRATION_ID,
            postRegistrationEntryPassDeliveredAt: at,
          },
        ];
      },
      updateMany: async (args?: {
        where?: { postRegistrationEntryPassDeliveredAt: null };
        data?: { postRegistrationEntryPassDeliveredAt: Date };
      }) => {
        if (args?.where?.postRegistrationEntryPassDeliveredAt === null && args.data) {
          if (!hoisted.eligibilityAt) {
            hoisted.eligibilityAt = args.data.postRegistrationEntryPassDeliveredAt;
            return { count: 1 };
          }
          return { count: 0 };
        }
        return { count: 0 };
      },
    },
    whatsAppPostRegistrationTrigger: {
      count: async () => hoisted.triggerCount,
    },
  },
}));

import { processVerifiedWhatsAppWebhook } from "@/lib/server/whatsapp/whatsapp-webhook-processor";
import { completeWhatsAppRegistrationForConversation } from "@/lib/server/whatsapp/whatsapp-registration-completion";
import { recoverMissingPostRegistrationGrowthSchedules } from "@/lib/server/whatsapp/whatsapp-post-registration-recovery";

function completedConversation(): WhatsAppConversationState {
  return {
    waId: WA_ID,
    status: "COMPLETED",
    currentStep: "COMPLETED",
    studentName: "Aarav Sharma",
    email: "aarav@example.com",
    classLabel: "Class 10",
    gender: "Male",
    board: "CBSE",
    interestedStream: "Science",
    college: "NPS",
    city: "Bangalore",
    selectedSeminarIds: ["sem-001"],
    completedRegistrationId: REGISTRATION_ID,
  };
}

function registrationSuccessActions(): WhatsAppBotAction[] {
  return buildWhatsAppRegistrationSuccessActions({
    registrationNumber: "CU-BLR-2026-00042",
    qrPngBase64: QR_BASE64,
    studentName: "Aarav Sharma",
  });
}

function dispatchSummaryForQrOutcome(
  actions: WhatsAppBotAction[],
  qrAccepted: boolean
): WhatsAppBotDispatchSummary {
  const results = actions.map((action) => {
    const isEntryPassQr =
      action.type === "MEDIA" &&
      action.filename === WHATSAPP_REGISTRATION_ENTRY_PASS_FILENAME;
    if (isEntryPassQr) {
      return {
        actionType: "MEDIA" as const,
        success: qrAccepted,
        errorCode: qrAccepted ? undefined : "meta_send_failed",
      };
    }
    return {
      actionType: action.type,
      success: true,
    };
  });
  const failed = results.filter((r) => !r.success).length;
  return {
    dispatched: results.length - failed,
    failed,
    results,
  };
}

function buildTextWebhook(messageId: string, body: string) {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              messages: [
                {
                  from: WA_ID,
                  id: messageId,
                  timestamp: "1504902988",
                  type: "text",
                  text: { body },
                },
              ],
            },
            field: "messages",
          },
        ],
      },
    ],
  });
}

describe("webhook post-registration growth & recovery regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.eligibilityAt = null;
    hoisted.triggerCount = 0;
    hoisted.markCalls = 0;
    hoisted.scheduleCalls.length = 0;
    hoisted.dispatchCalls.length = 0;

    claimMock.mockResolvedValue("new");
    markProcessedMock.mockResolvedValue(undefined);
    loadConversationMock.mockResolvedValue({
      conversation: null,
      previousActivityAt: null,
      lastInboundAt: null,
    });
    deleteExpiredMock.mockResolvedValue(false);
    getSeminarsMock.mockResolvedValue([{ id: "sem-001", title: "AI Careers" }]);
    getCatalogMock.mockResolvedValue({
      day1: [],
      day2: [],
      day1Date: null,
      day2Date: null,
    });

    processTurnMock.mockResolvedValue({
      conversation: {
        waId: WA_ID,
        status: "READY_TO_REGISTER",
        currentStep: "READY_TO_REGISTER",
        studentName: "Aarav Sharma",
        email: "aarav@example.com",
        classLabel: "Class 10",
        gender: "Male",
        board: "CBSE",
        interestedStream: "Science",
        college: "NPS",
        city: "Bangalore",
        selectedSeminarIds: ["sem-001"],
        completedRegistrationId: null,
      },
      actions: [],
      refreshExpiry: true,
    });

    saveConversationMock.mockImplementation(
      async (state: WhatsAppConversationState) => state
    );

    const actions = registrationSuccessActions();
    vi.mocked(completeWhatsAppRegistrationForConversation).mockResolvedValue({
      status: "SUCCESS",
      registrationId: REGISTRATION_ID,
      actions,
      conversation: completedConversation(),
    });

    dispatchMock.mockImplementation(async (_waId: string, dispatched: WhatsAppBotAction[]) => {
      hoisted.dispatchCalls.push(dispatched);
      return dispatchSummaryForQrOutcome(dispatched, true);
    });

    scheduleMock.mockImplementation(async (input: {
      waId: string;
      registrationId: string;
      completedAt: Date;
    }) => {
      hoisted.scheduleCalls.push(input);
      hoisted.triggerCount += 4;
      return { scheduled: true };
    });
  });

  it("keeps registration but skips growth when QR dispatch fails", async () => {
    dispatchMock.mockImplementation(async (_waId: string, dispatched: WhatsAppBotAction[]) => {
      hoisted.dispatchCalls.push(dispatched);
      return dispatchSummaryForQrOutcome(dispatched, false);
    });

    await processVerifiedWhatsAppWebhook(buildTextWebhook("wamid.qr-fail", "finish"));

    expect(saveConversationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "COMPLETED",
        completedRegistrationId: REGISTRATION_ID,
      }),
      expect.any(Object)
    );
    expect(hoisted.markCalls).toBe(0);
    expect(hoisted.eligibilityAt).toBeNull();
    expect(scheduleMock).not.toHaveBeenCalled();

    const recovery = await recoverMissingPostRegistrationGrowthSchedules(new Date());
    expect(recovery.recovered).toBe(0);
    expect(scheduleMock).not.toHaveBeenCalled();
    expect(hoisted.triggerCount).toBe(0);
  });

  it("persists QR evidence and recovers growth once after scheduling failure without resending QR", async () => {
    let scheduleAttempts = 0;
    scheduleMock.mockImplementation(async (input: {
      waId: string;
      registrationId: string;
      completedAt: Date;
    }) => {
      scheduleAttempts += 1;
      hoisted.scheduleCalls.push(input);
      if (scheduleAttempts === 1) {
        throw new Error("db unavailable");
      }
      hoisted.triggerCount += 4;
      return { scheduled: true };
    });

    const beforeDispatch = hoisted.dispatchCalls.length;
    await processVerifiedWhatsAppWebhook(buildTextWebhook("wamid.schedule-fail", "finish"));

    expect(hoisted.markCalls).toBe(1);
    expect(hoisted.eligibilityAt).not.toBeNull();
    expect(scheduleMock).toHaveBeenCalledOnce();
    expect(hoisted.triggerCount).toBe(0);
    expect(hoisted.dispatchCalls.length).toBe(beforeDispatch + 1);
    const dispatchedKinds = hoisted.dispatchCalls[0]?.map((a) => a.type) ?? [];
    expect(dispatchedKinds).toContain("MEDIA");

    const recoveryNow = new Date(
      (hoisted.eligibilityAt ?? new Date()).getTime() + 60_000
    );
    const firstRecovery = await recoverMissingPostRegistrationGrowthSchedules(recoveryNow);
    expect(firstRecovery.recovered).toBe(1);
    expect(scheduleMock).toHaveBeenCalledTimes(2);
    expect(hoisted.triggerCount).toBe(4);
    expect(hoisted.dispatchCalls.length).toBe(1);

    const secondRecovery = await recoverMissingPostRegistrationGrowthSchedules(recoveryNow);
    expect(secondRecovery.skipped).toBe(1);
    expect(secondRecovery.recovered).toBe(0);
    expect(scheduleMock).toHaveBeenCalledTimes(2);
    expect(hoisted.triggerCount).toBe(4);
  });

  it("documents overdue promotional timing risk after prolonged worker outage", async () => {
    const entryPassAt = new Date("2026-10-15T12:00:00.000Z");
    const workerNow = new Date(
      entryPassAt.getTime() + POST_REGISTRATION_GROWTH_RECOVERY_LOOKBACK_MS - 60_000
    );

    const due = postRegistrationGrowthDueAt(entryPassAt);
    expect(due.FRIEND_INVITE.getTime()).toBeLessThan(workerNow.getTime());
    expect(workerNow.getTime() - due.INSTAGRAM.getTime()).toBeGreaterThan(
      WHATSAPP_POST_REGISTRATION_FRIEND_DELAY_MS
    );

    const staleInbound = new Date(
      workerNow.getTime() - WHATSAPP_CUSTOMER_SERVICE_WINDOW_MS - 60_000
    );
    await expect(
      channelInvitePromotionalBlockReason({
        waId: WA_ID,
        now: workerNow,
        lastInboundAt: staleInbound,
      })
    ).resolves.toBe("customer_service_window_closed");
  });
});