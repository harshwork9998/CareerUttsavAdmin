import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  WHATSAPP_CONVERSATION_TTL_MS,
  type WhatsAppConversationState,
} from "@/lib/server/whatsapp/registration-conversation";
import {
  WHATSAPP_REMINDER_12H_MS,
  WHATSAPP_REMINDER_2H_MS,
  WHATSAPP_REMINDER_6H_MS,
} from "@/lib/server/whatsapp/whatsapp-registration-reminder-config";
import { REGISTRATION_INTERACTIVE_IDS } from "@/lib/server/whatsapp/registration-interactive-ids";
import {
  determineReminderStageToSend,
  effectiveLastInboundAt,
  isEligibleForRegistrationReminder,
} from "@/lib/server/whatsapp/whatsapp-registration-reminder-eligibility";
import {
  buildWhatsAppRegistrationReminder12hActions,
} from "@/lib/server/whatsapp/whatsapp-registration-reminder-messages";
import { resetWaIdSerializerForTests } from "@/lib/server/whatsapp/whatsapp-wa-id-serializer";

const findManyMock = vi.fn();
const findUniqueMock = vi.fn();
const updateMock = vi.fn();
const dispatchMock = vi.fn();

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

import { processWhatsAppRegistrationReminders } from "@/lib/server/whatsapp/whatsapp-registration-reminder-processor";

function buildEligibleConversation(
  overrides: Partial<WhatsAppConversationState> = {}
): WhatsAppConversationState {
  return {
    waId: "919876543210",
    status: "ACTIVE",
    currentStep: "AWAITING_EMAIL",
    studentName: "Aarav Sharma",
    email: null,
    classLabel: null,
    gender: null,
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

describe("WhatsApp registration reminder 12h stage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWaIdSerializerForTests();
    process.env.WHATSAPP_REGISTRATION_REMINDERS_ENABLED = "true";
    dispatchMock.mockResolvedValue({ dispatched: 1, failed: 0, results: [] });
    updateMock.mockResolvedValue({});
  });

  afterEach(() => {
    delete process.env.WHATSAPP_REGISTRATION_REMINDERS_ENABLED;
  });

  it("sends no reminder before 2 hours", () => {
    expect(
      determineReminderStageToSend(WHATSAPP_REMINDER_2H_MS - 60_000, 0)
    ).toBeNull();
  });

  it("sends the 2h reminder at 2 hours", () => {
    expect(determineReminderStageToSend(WHATSAPP_REMINDER_2H_MS, 0)).toBe(2);
  });

  it("sends the 6h reminder at 6 hours", () => {
    expect(determineReminderStageToSend(WHATSAPP_REMINDER_6H_MS, 2)).toBe(6);
  });

  it("sends the 12h reminder at 12 hours", () => {
    expect(
      determineReminderStageToSend(WHATSAPP_REMINDER_12H_MS, 6)
    ).toBe(12);
  });

  it("sends only 12 when highest=0 at 13 hours", () => {
    expect(determineReminderStageToSend(13 * 60 * 60 * 1000, 0)).toBe(12);
  });

  it("sends only 12 when highest=2 at 13 hours", () => {
    expect(determineReminderStageToSend(13 * 60 * 60 * 1000, 2)).toBe(12);
  });

  it("sends 12 when highest=6 and inactivity is at least 12 hours", () => {
    expect(
      determineReminderStageToSend(WHATSAPP_REMINDER_12H_MS, 6)
    ).toBe(12);
  });

  it("sends nothing when highest=12", () => {
    expect(
      determineReminderStageToSend(WHATSAPP_REMINDER_12H_MS + 60_000, 12)
    ).toBeNull();
  });

  it("uses BUTTONS sender for 12h reminders", async () => {
    const lastInboundAt = new Date(Date.now() - WHATSAPP_REMINDER_12H_MS);
    const record = buildPrismaRecord({ lastInboundAt, highestReminderStageSent: 6 });
    findManyMock.mockResolvedValue([record]);
    findUniqueMock.mockResolvedValue(record);

    const result = await processWhatsAppRegistrationReminders();

    expect(result.sent12h).toBe(1);
    expect(dispatchMock).toHaveBeenCalledWith(
      "919876543210",
      buildWhatsAppRegistrationReminder12hActions(buildEligibleConversation())
    );
  });

  it("does not use Meta template sending for 12h reminders", async () => {
    const lastInboundAt = new Date(Date.now() - 13 * 60 * 60 * 1000);
    const record = buildPrismaRecord({ lastInboundAt, highestReminderStageSent: 0 });
    findManyMock.mockResolvedValue([record]);
    findUniqueMock.mockResolvedValue(record);

    await processWhatsAppRegistrationReminders();

    expect(dispatchMock).toHaveBeenCalledTimes(1);
    const actions = dispatchMock.mock.calls[0]?.[1];
    expect(actions?.[0]?.type).toBe("BUTTONS");
  });

  it("preserves Continue and Start over interactive IDs on 12h reminders", () => {
    const action = buildWhatsAppRegistrationReminder12hActions(
      buildEligibleConversation()
    )[0];
    expect(action.type).toBe("BUTTONS");
    if (action.type === "BUTTONS") {
      expect(action.buttons.map((button) => button.id)).toEqual([
        REGISTRATION_INTERACTIVE_IDS.CONTINUE,
        REGISTRATION_INTERACTIVE_IDS.RESTART,
      ]);
    }
  });

  it("resets the inactivity clock when the user returns", () => {
    const expiresAt = new Date(Date.now() + WHATSAPP_CONVERSATION_TTL_MS);
    const oldActivity = new Date(Date.now() - 13 * 60 * 60 * 1000);
    const newActivity = new Date();
    expect(
      effectiveLastInboundAt(oldActivity, expiresAt).getTime()
    ).not.toBe(effectiveLastInboundAt(newActivity, expiresAt).getTime());
    expect(
      determineReminderStageToSend(
        Date.now() - effectiveLastInboundAt(newActivity, expiresAt).getTime(),
        2
      )
    ).toBeNull();
  });

  it("does not repeat previously sent reminder stages", () => {
    expect(
      determineReminderStageToSend(WHATSAPP_REMINDER_2H_MS + 60_000, 2)
    ).toBeNull();
    expect(
      determineReminderStageToSend(WHATSAPP_REMINDER_6H_MS + 60_000, 6)
    ).toBeNull();
  });

  it("returns sent12h in processor summary", async () => {
    const lastInboundAt = new Date(Date.now() - WHATSAPP_REMINDER_12H_MS);
    const record = buildPrismaRecord({ lastInboundAt, highestReminderStageSent: 6 });
    findManyMock.mockResolvedValue([record]);
    findUniqueMock.mockResolvedValue(record);

    const result = await processWhatsAppRegistrationReminders();
    expect(result).toMatchObject({
      checked: 1,
      sent12h: 1,
      sent2h: 0,
      sent6h: 0,
    });
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
});
