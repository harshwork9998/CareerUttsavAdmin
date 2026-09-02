import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  WHATSAPP_CONVERSATION_TTL_MS,
  processRegistrationConversationTurn,
  type WhatsAppConversationState,
} from "@/lib/server/whatsapp/registration-conversation";
import {
  WHATSAPP_REMINDER_24H_MS,
  WHATSAPP_REMINDER_2H_MS,
  WHATSAPP_REMINDER_6H_MS,
} from "@/lib/server/whatsapp/whatsapp-registration-reminder-config";
import { REGISTRATION_INTERACTIVE_IDS } from "@/lib/server/whatsapp/registration-interactive-ids";
import {
  determineReminderStageToSend,
  isEligibleForRegistrationReminder,
} from "@/lib/server/whatsapp/whatsapp-registration-reminder-eligibility";
import {
  extractNormalizedWhatsAppMessages,
  parseMetaWebhookPayload,
} from "@/lib/server/whatsapp/meta-webhook";
import { resetWaIdSerializerForTests } from "@/lib/server/whatsapp/whatsapp-wa-id-serializer";

const findManyMock = vi.fn();
const findUniqueMock = vi.fn();
const updateMock = vi.fn();
const dispatchMock = vi.fn();
const templateSendMock = vi.fn();

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    whatsAppRegistrationConversation: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}));

vi.mock("@/lib/server/whatsapp/whatsapp-bot-dispatcher", () => ({
  dispatchWhatsAppBotActions: (...args: unknown[]) => dispatchMock(...args),
}));

vi.mock(
  "@/lib/server/whatsapp/whatsapp-registration-reminder-template-sender",
  () => ({
    sendWhatsAppRegistrationReminder24hTemplate: (...args: unknown[]) =>
      templateSendMock(...args),
  })
);

import { processWhatsAppRegistrationReminders } from "@/lib/server/whatsapp/whatsapp-registration-reminder-processor";

function buildEligibleConversation(
  overrides: Partial<WhatsAppConversationState> = {}
): WhatsAppConversationState {
  return {
    waId: "919876543210",
    status: "ACTIVE",
    currentStep: "AWAITING_COLLEGE",
    studentName: "Aarav Sharma",
    email: "aarav@example.com",
    classLabel: "Class 10",
    gender: "Male",
    board: null,
    interestedStream: null,
    college: null,
    city: null,
    selectedSeminarIds: [],
    completedRegistrationId: null,
    ...overrides,
  };
}

function buildPrismaRecord(input: {
  conversation?: Partial<WhatsAppConversationState>;
  lastInboundAt?: Date | null;
  highestReminderStageSent?: number;
  lastReminderAttemptAt?: Date | null;
  expiresAt?: Date;
}) {
  const conversation = buildEligibleConversation(input.conversation);
  const expiresAt =
    input.expiresAt ?? new Date(Date.now() + WHATSAPP_CONVERSATION_TTL_MS);
  return {
    id: "conv-1",
    waId: conversation.waId,
    status: conversation.status,
    currentStep: conversation.currentStep,
    studentName: conversation.studentName,
    email: conversation.email,
    classLabel: conversation.classLabel,
    gender: conversation.gender,
    board: conversation.board,
    interestedStream: conversation.interestedStream,
    college: conversation.college,
    city: conversation.city,
    selectedSeminarIds: conversation.selectedSeminarIds,
    completedRegistrationId: conversation.completedRegistrationId,
    lastInboundAt: input.lastInboundAt ?? null,
    highestReminderStageSent: input.highestReminderStageSent ?? 0,
    lastReminderAttemptAt: input.lastReminderAttemptAt ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt,
  };
}

describe("WhatsApp registration reminder Stage 2B", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWaIdSerializerForTests();
    process.env.WHATSAPP_REGISTRATION_REMINDERS_ENABLED = "true";
    process.env.WHATSAPP_REMINDER_CRON_SECRET = "reminder-secret";
    process.env.WHATSAPP_REGISTRATION_REMINDER_TEMPLATE_NAME =
      "career_uttsav_registration_reminder";
    process.env.WHATSAPP_REGISTRATION_REMINDER_TEMPLATE_LANGUAGE = "en_US";
    dispatchMock.mockResolvedValue({ dispatched: 1, failed: 0, results: [] });
    templateSendMock.mockResolvedValue({ success: true });
    updateMock.mockResolvedValue({});
  });

  afterEach(() => {
    delete process.env.WHATSAPP_REGISTRATION_REMINDERS_ENABLED;
    delete process.env.WHATSAPP_REMINDER_CRON_SECRET;
    delete process.env.WHATSAPP_REGISTRATION_REMINDER_TEMPLATE_NAME;
    delete process.env.WHATSAPP_REGISTRATION_REMINDER_TEMPLATE_LANGUAGE;
  });

  it("does not send 24h reminder before 24 hours of inactivity", () => {
    expect(
      determineReminderStageToSend(WHATSAPP_REMINDER_24H_MS - 60_000, 0)
    ).toBe(6);
    expect(
      determineReminderStageToSend(WHATSAPP_REMINDER_24H_MS - 60_000, 6)
    ).toBeNull();
  });

  it("marks 24h reminder due after 24 hours of inactivity", () => {
    expect(
      determineReminderStageToSend(WHATSAPP_REMINDER_24H_MS, 6)
    ).toBe(24);
  });

  it("does not repeat the 24h reminder", () => {
    expect(
      determineReminderStageToSend(WHATSAPP_REMINDER_24H_MS + 60_000, 24)
    ).toBeNull();
  });

  it("sends only 24h when highest=0 at 26 hours", () => {
    expect(determineReminderStageToSend(26 * 60 * 60 * 1000, 0)).toBe(24);
  });

  it("sends only 24h when highest=2 at 26 hours", () => {
    expect(determineReminderStageToSend(26 * 60 * 60 * 1000, 2)).toBe(24);
  });

  it("sends 24h when highest=6 and inactivity is at least 24 hours", () => {
    expect(
      determineReminderStageToSend(WHATSAPP_REMINDER_24H_MS, 6)
    ).toBe(24);
  });

  it("uses the template sender for 24h reminders only", async () => {
    const lastInboundAt = new Date(Date.now() - WHATSAPP_REMINDER_24H_MS);
    const record = buildPrismaRecord({ lastInboundAt, highestReminderStageSent: 6 });
    findManyMock.mockResolvedValue([record]);
    findUniqueMock.mockResolvedValue(record);

    const result = await processWhatsAppRegistrationReminders();

    expect(result.sent24h).toBe(1);
    expect(templateSendMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("never falls back to free-form messages for 24h reminders", async () => {
    const lastInboundAt = new Date(Date.now() - 26 * 60 * 60 * 1000);
    const record = buildPrismaRecord({ lastInboundAt, highestReminderStageSent: 0 });
    findManyMock.mockResolvedValue([record]);
    findUniqueMock.mockResolvedValue(record);

    await processWhatsAppRegistrationReminders();

    expect(templateSendMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("fails safely when template config is missing", async () => {
    templateSendMock.mockResolvedValueOnce({
      success: false,
      errorCode: "WHATSAPP_REMINDER_TEMPLATE_NOT_CONFIGURED",
    });
    const lastInboundAt = new Date(Date.now() - WHATSAPP_REMINDER_24H_MS);
    const record = buildPrismaRecord({ lastInboundAt, highestReminderStageSent: 6 });
    findManyMock.mockResolvedValue([record]);
    findUniqueMock.mockResolvedValue(record);

    const result = await processWhatsAppRegistrationReminders();

    expect(result.failed).toBe(1);
    expect(result.sent24h).toBe(0);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastReminderAttemptAt: expect.any(Date) }),
      })
    );
    expect(updateMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ highestReminderStageSent: 24 }),
      })
    );
  });

  it("does not advance to stage 24 when template send fails", async () => {
    templateSendMock.mockResolvedValueOnce({
      success: false,
      errorCode: "META_HTTP_ERROR",
    });
    const lastInboundAt = new Date(Date.now() - WHATSAPP_REMINDER_24H_MS);
    const record = buildPrismaRecord({ lastInboundAt, highestReminderStageSent: 6 });
    findManyMock.mockResolvedValue([record]);
    findUniqueMock.mockResolvedValue(record);

    const result = await processWhatsAppRegistrationReminders();

    expect(result.failed).toBe(1);
    expect(result.sent24h).toBe(0);
    expect(updateMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ highestReminderStageSent: 24 }),
      })
    );
  });

  it("advances to stage 24 after successful template send", async () => {
    const lastInboundAt = new Date(Date.now() - WHATSAPP_REMINDER_24H_MS);
    const record = buildPrismaRecord({ lastInboundAt, highestReminderStageSent: 6 });
    findManyMock.mockResolvedValue([record]);
    findUniqueMock.mockResolvedValue(record);

    await processWhatsAppRegistrationReminders();

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          highestReminderStageSent: 24,
          lastReminderAttemptAt: null,
        }),
      })
    );
  });

  it("does not double-send 24h reminders for duplicate cron calls", async () => {
    const lastInboundAt = new Date(Date.now() - WHATSAPP_REMINDER_24H_MS);
    const record = buildPrismaRecord({ lastInboundAt, highestReminderStageSent: 6 });
    findManyMock.mockResolvedValue([record]);
    findUniqueMock.mockImplementation(async () => ({
      ...record,
      highestReminderStageSent:
        updateMock.mock.calls.length > 0
          ? updateMock.mock.calls.at(-1)?.[0]?.data?.highestReminderStageSent ?? 6
          : 6,
    }));

    await Promise.all([
      processWhatsAppRegistrationReminders(),
      processWhatsAppRegistrationReminders(),
    ]);

    expect(templateSendMock).toHaveBeenCalledTimes(1);
  });

  it("skips 24h send when user activity changes before send", async () => {
    const snapshotInbound = new Date(Date.now() - WHATSAPP_REMINDER_24H_MS);
    const record = buildPrismaRecord({
      lastInboundAt: snapshotInbound,
      highestReminderStageSent: 6,
    });
    findManyMock.mockResolvedValue([record]);
    findUniqueMock.mockResolvedValue({
      ...record,
      lastInboundAt: new Date(),
    });

    const result = await processWhatsAppRegistrationReminders();

    expect(result.skipped).toBe(1);
    expect(templateSendMock).not.toHaveBeenCalled();
  });

  it("does not remind COMPLETED, CANCELLED, or READY_TO_REGISTER users", () => {
    const expiresAt = new Date(Date.now() + WHATSAPP_CONVERSATION_TTL_MS);
    expect(
      isEligibleForRegistrationReminder(
        buildEligibleConversation({ status: "READY_TO_REGISTER" }),
        expiresAt
      )
    ).toBe(false);
    expect(
      isEligibleForRegistrationReminder(
        buildEligibleConversation({ status: "COMPLETED", currentStep: "COMPLETED" }),
        expiresAt
      )
    ).toBe(false);
    expect(
      isEligibleForRegistrationReminder(
        buildEligibleConversation({ status: "CANCELLED", currentStep: "CANCELLED" }),
        expiresAt
      )
    ).toBe(false);
  });

  it("maps template Continue quick replies to existing CONTINUE resume behavior", () => {
    const payload = parseMetaWebhookPayload(
      JSON.stringify({
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  messages: [
                    {
                      from: "919876543210",
                      id: "wamid.template-continue",
                      timestamp: "1504902988",
                      type: "button",
                      button: {
                        text: "Continue",
                        payload: "Continue",
                      },
                    },
                  ],
                },
                field: "messages",
              },
            ],
          },
        ],
      })
    );
    const messages = extractNormalizedWhatsAppMessages(payload!);
    expect(messages[0]?.interactiveReplyId).toBe(
      REGISTRATION_INTERACTIVE_IDS.CONTINUE
    );

    const turn = processRegistrationConversationTurn({
      conversation: buildEligibleConversation({ currentStep: "AWAITING_COLLEGE" }),
      message: { interactiveId: messages[0]?.interactiveReplyId },
      seminarOptions: [],
      waId: "919876543210",
      previousActivityAt: new Date(Date.now() - WHATSAPP_REMINDER_24H_MS),
    });
    expect(turn.conversation.currentStep).toBe("AWAITING_COLLEGE");
    expect(turn.actions.some((action) => action.type === "BUTTONS")).toBe(false);
  });

  it("returns sent24h in processor summary", async () => {
    const lastInboundAt = new Date(Date.now() - WHATSAPP_REMINDER_24H_MS);
    const record = buildPrismaRecord({ lastInboundAt, highestReminderStageSent: 6 });
    findManyMock.mockResolvedValue([record]);
    findUniqueMock.mockResolvedValue(record);

    const result = await processWhatsAppRegistrationReminders();
    expect(result).toMatchObject({
      checked: 1,
      sent24h: 1,
      sent2h: 0,
      sent6h: 0,
    });
  });

  it("still sends 2h reminders unchanged when inactivity is below 24 hours", async () => {
    const lastInboundAt = new Date(Date.now() - WHATSAPP_REMINDER_2H_MS);
    const record = buildPrismaRecord({ lastInboundAt, highestReminderStageSent: 0 });
    findManyMock.mockResolvedValue([record]);
    findUniqueMock.mockResolvedValue(record);

    const result = await processWhatsAppRegistrationReminders();

    expect(result.sent2h).toBe(1);
    expect(result.sent24h).toBe(0);
    expect(templateSendMock).not.toHaveBeenCalled();
    expect(dispatchMock).toHaveBeenCalledTimes(1);
  });
});
