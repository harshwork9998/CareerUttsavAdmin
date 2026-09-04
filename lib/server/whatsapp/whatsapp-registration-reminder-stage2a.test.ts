import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  WHATSAPP_CONVERSATION_TTL_MS,
  WHATSAPP_RESUME_INACTIVITY_MS,
  computePreviousActivityAtFromExpiresAt,
  isReturningUserInactivity,
  processRegistrationConversationTurn,
  type WhatsAppConversationState,
} from "@/lib/server/whatsapp/registration-conversation";
import {
  WHATSAPP_REMINDER_2H_MS,
  WHATSAPP_REMINDER_6H_MS,
} from "@/lib/server/whatsapp/whatsapp-registration-reminder-config";
import { REGISTRATION_INTERACTIVE_IDS } from "@/lib/server/whatsapp/registration-interactive-ids";
import {
  determineReminderStageToSend,
  effectiveLastInboundAt,
  isEligibleForRegistrationReminder,
  isReminderRetryThrottled,
} from "@/lib/server/whatsapp/whatsapp-registration-reminder-eligibility";
import {
  buildWhatsAppRegistrationReminder2hActions,
  buildWhatsAppRegistrationReminder6hActions,
} from "@/lib/server/whatsapp/whatsapp-registration-reminder-messages";
import { WHATSAPP_REMINDER_CRON_KEY_HEADER } from "@/lib/server/whatsapp/whatsapp-reminder-cron-auth";
import { resetWaIdSerializerForTests } from "@/lib/server/whatsapp/whatsapp-wa-id-serializer";

const findManyMock = vi.fn();
const findUniqueMock = vi.fn();
const upsertMock = vi.fn();
const updateMock = vi.fn();
const dispatchMock = vi.fn();

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    whatsAppRegistrationConversation: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      upsert: (...args: unknown[]) => upsertMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}));

vi.mock("@/lib/server/whatsapp/whatsapp-bot-dispatcher", () => ({
  dispatchWhatsAppBotActions: (...args: unknown[]) => dispatchMock(...args),
}));

import { saveWhatsAppConversationState } from "@/lib/server/whatsapp/whatsapp-conversation-store";
import { processWhatsAppRegistrationReminders } from "@/lib/server/whatsapp/whatsapp-registration-reminder-processor";
import { POST as registrationRemindersPost } from "@/app/api/internal/whatsapp/registration-reminders/route";

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

function reminderHeaders(secret = "reminder-secret") {
  return {
    [WHATSAPP_REMINDER_CRON_KEY_HEADER]: secret,
  };
}

describe("WhatsApp registration reminder Stage 2A", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWaIdSerializerForTests();
    process.env.WHATSAPP_REGISTRATION_REMINDERS_ENABLED = "true";
    process.env.WHATSAPP_REMINDER_CRON_SECRET = "reminder-secret";
    dispatchMock.mockResolvedValue({ dispatched: 1, failed: 0, results: [] });
    updateMock.mockResolvedValue({});
    upsertMock.mockImplementation(async ({ create, update }: { create: unknown; update: unknown }) =>
      update ?? create
    );
  });

  afterEach(() => {
    delete process.env.WHATSAPP_REGISTRATION_REMINDERS_ENABLED;
    delete process.env.WHATSAPP_REMINDER_CRON_SECRET;
  });

  it("updates lastInboundAt on inbound save", async () => {
    const now = Date.now();
    findUniqueMock.mockResolvedValue({
      expiresAt: new Date(now + WHATSAPP_CONVERSATION_TTL_MS),
    });

    await saveWhatsAppConversationState(buildEligibleConversation(), {
      refreshExpiry: true,
      touchLastInboundAt: true,
    });

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          lastInboundAt: expect.any(Date),
        }),
      })
    );
  });

  it("does not touch lastInboundAt when touchLastInboundAt is omitted", async () => {
    findUniqueMock.mockResolvedValue({
      expiresAt: new Date(Date.now() + WHATSAPP_CONVERSATION_TTL_MS),
    });

    await saveWhatsAppConversationState(buildEligibleConversation(), {
      refreshExpiry: true,
    });

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.not.objectContaining({
          lastInboundAt: expect.any(Date),
        }),
      })
    );
  });

  it("uses lastInboundAt for Stage 1.1 returning-user activity when present", () => {
    const lastInboundAt = new Date(Date.now() - WHATSAPP_RESUME_INACTIVITY_MS - 60_000);
    expect(isReturningUserInactivity(lastInboundAt)).toBe(true);
  });

  it("falls back to expiresAt-based activity for legacy rows without lastInboundAt", () => {
    const expiresAt = new Date(Date.now() + WHATSAPP_CONVERSATION_TTL_MS);
    const previousActivityAt = computePreviousActivityAtFromExpiresAt(expiresAt);
    expect(isReturningUserInactivity(previousActivityAt)).toBe(false);
  });

  it("does not remind conversations without studentName", () => {
    expect(
      isEligibleForRegistrationReminder(
        buildEligibleConversation({
          studentName: null,
          email: null,
          classLabel: null,
          gender: null,
        }),
        new Date(Date.now() + WHATSAPP_CONVERSATION_TTL_MS)
      )
    ).toBe(false);
    expect(
      isEligibleForRegistrationReminder(
        buildEligibleConversation({
          studentName: "   ",
        }),
        new Date(Date.now() + WHATSAPP_CONVERSATION_TTL_MS)
      )
    ).toBe(false);
  });

  it("reminds as soon as studentName is saved", () => {
    const conversation = buildEligibleConversation({
      studentName: "Aarav Sharma",
      email: null,
      classLabel: null,
      gender: null,
      board: null,
      interestedStream: null,
      college: null,
      city: null,
      currentStep: "AWAITING_EMAIL",
    });
    expect(
      isEligibleForRegistrationReminder(
        conversation,
        new Date(Date.now() + WHATSAPP_CONVERSATION_TTL_MS)
      )
    ).toBe(true);
  });

  it("reminds when only studentName is present", () => {
    expect(
      isEligibleForRegistrationReminder(
        buildEligibleConversation({
          studentName: "Aarav Sharma",
          email: null,
          classLabel: null,
          gender: null,
          board: null,
          interestedStream: null,
          college: null,
          city: null,
          currentStep: "AWAITING_EMAIL",
        }),
        new Date(Date.now() + WHATSAPP_CONVERSATION_TTL_MS)
      )
    ).toBe(true);
  });

  it("does not remind AWAITING_START conversations", () => {
    expect(
      isEligibleForRegistrationReminder(
        buildEligibleConversation({
          currentStep: "AWAITING_START",
          studentName: "Aarav Sharma",
        }),
        new Date(Date.now() + WHATSAPP_CONVERSATION_TTL_MS)
      )
    ).toBe(false);
  });

  it("does not remind expired conversations", () => {
    expect(
      isEligibleForRegistrationReminder(
        buildEligibleConversation({ studentName: "Aarav Sharma" }),
        new Date(Date.now() - 60_000)
      )
    ).toBe(false);
  });

  it("does not remind READY_TO_REGISTER conversations", () => {
    expect(
      isEligibleForRegistrationReminder(
        buildEligibleConversation({
          status: "READY_TO_REGISTER",
          currentStep: "READY_TO_REGISTER",
        }),
        new Date(Date.now() + WHATSAPP_CONVERSATION_TTL_MS)
      )
    ).toBe(false);
  });

  it("does not remind COMPLETED or CANCELLED conversations", () => {
    expect(
      isEligibleForRegistrationReminder(
        buildEligibleConversation({ status: "COMPLETED", currentStep: "COMPLETED" }),
        new Date(Date.now() + WHATSAPP_CONVERSATION_TTL_MS)
      )
    ).toBe(false);
    expect(
      isEligibleForRegistrationReminder(
        buildEligibleConversation({ status: "CANCELLED", currentStep: "CANCELLED" }),
        new Date(Date.now() + WHATSAPP_CONVERSATION_TTL_MS)
      )
    ).toBe(false);
  });

  it("sends no reminder before 2 hours of inactivity", () => {
    expect(
      determineReminderStageToSend(WHATSAPP_REMINDER_2H_MS - 60_000, 0)
    ).toBeNull();
  });

  it("sends the 2h reminder after 2 hours of inactivity", () => {
    expect(determineReminderStageToSend(WHATSAPP_REMINDER_2H_MS, 0)).toBe(2);
  });

  it("does not repeat the 2h reminder", () => {
    expect(
      determineReminderStageToSend(WHATSAPP_REMINDER_2H_MS + 60_000, 2)
    ).toBeNull();
  });

  it("sends the 6h reminder after 6 hours of inactivity", () => {
    expect(determineReminderStageToSend(WHATSAPP_REMINDER_6H_MS, 2)).toBe(6);
  });

  it("sends only the 6h reminder when the first run happens at 8 hours", () => {
    expect(
      determineReminderStageToSend(8 * 60 * 60 * 1000, 0)
    ).toBe(6);
  });

  it("resets the inactivity clock when the user returns", () => {
    const expiresAt = new Date(Date.now() + WHATSAPP_CONVERSATION_TTL_MS);
    const oldActivity = new Date(Date.now() - 8 * 60 * 60 * 1000);
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

  it("resets reminder tracking on restart", async () => {
    findUniqueMock.mockResolvedValue({
      expiresAt: new Date(Date.now() + WHATSAPP_CONVERSATION_TTL_MS),
    });

    await saveWhatsAppConversationState(buildEligibleConversation(), {
      refreshExpiry: true,
      touchLastInboundAt: true,
      resetReminderTracking: true,
    });

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          highestReminderStageSent: 0,
          lastReminderAttemptAt: null,
        }),
      })
    );

    const restart = processRegistrationConversationTurn({
      conversation: buildEligibleConversation(),
      message: { interactiveId: REGISTRATION_INTERACTIVE_IDS.RESTART },
      seminarOptions: [],
      waId: "919876543210",
    });
    expect(restart.resetReminderTracking).toBe(true);
  });

  it("sends nothing when the feature flag is false", async () => {
    process.env.WHATSAPP_REGISTRATION_REMINDERS_ENABLED = "false";
    findManyMock.mockResolvedValue([
      buildPrismaRecord({
        lastInboundAt: new Date(Date.now() - WHATSAPP_REMINDER_2H_MS),
      }),
    ]);

    const result = await processWhatsAppRegistrationReminders();
    expect(result).toEqual({
      checked: 0,
      sent2h: 0,
      sent6h: 0,
      sent12h: 0,
      skipped: 0,
      failed: 0,
    });
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("returns 401 for a missing or wrong cron secret", async () => {
    const missing = await registrationRemindersPost(
      new Request("http://localhost/api/internal/whatsapp/registration-reminders", {
        method: "POST",
      })
    );
    expect(missing.status).toBe(401);

    const wrong = await registrationRemindersPost(
      new Request("http://localhost/api/internal/whatsapp/registration-reminders", {
        method: "POST",
        headers: reminderHeaders("wrong"),
      })
    );
    expect(wrong.status).toBe(401);
  });

  it("runs with a valid cron secret", async () => {
    findManyMock.mockResolvedValue([]);

    const response = await registrationRemindersPost(
      new Request("http://localhost/api/internal/whatsapp/registration-reminders", {
        method: "POST",
        headers: reminderHeaders(),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      checked: 0,
      sent2h: 0,
      sent6h: 0,
      sent12h: 0,
      skipped: 0,
      failed: 0,
    });
  });

  it("sends at most one reminder for duplicate cron invocations", async () => {
    const lastInboundAt = new Date(Date.now() - WHATSAPP_REMINDER_2H_MS);
    const record = buildPrismaRecord({ lastInboundAt, highestReminderStageSent: 0 });
    findManyMock.mockResolvedValue([record]);
    findUniqueMock.mockImplementation(async () => ({
      ...record,
      highestReminderStageSent:
        updateMock.mock.calls.length > 0
          ? updateMock.mock.calls.at(-1)?.[0]?.data?.highestReminderStageSent ?? 0
          : 0,
    }));

    await Promise.all([
      processWhatsAppRegistrationReminders(),
      processWhatsAppRegistrationReminders(),
    ]);

    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ highestReminderStageSent: 2 }),
      })
    );
  });

  it("skips reminder send when inbound activity changes during serialization", async () => {
    const snapshotInbound = new Date(Date.now() - WHATSAPP_REMINDER_2H_MS);
    const record = buildPrismaRecord({
      lastInboundAt: snapshotInbound,
      highestReminderStageSent: 0,
    });
    findManyMock.mockResolvedValue([record]);
    findUniqueMock.mockResolvedValue({
      ...record,
      lastInboundAt: new Date(),
    });

    const result = await processWhatsAppRegistrationReminders();
    expect(result.sent2h).toBe(0);
    expect(result.skipped).toBe(1);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("keeps failed sends retryable without advancing stage", async () => {
    const lastInboundAt = new Date(Date.now() - WHATSAPP_REMINDER_2H_MS);
    const record = buildPrismaRecord({ lastInboundAt, highestReminderStageSent: 0 });
    findManyMock.mockResolvedValue([record]);
    findUniqueMock.mockResolvedValue(record);
    dispatchMock.mockResolvedValueOnce({ dispatched: 0, failed: 1, results: [] });

    const result = await processWhatsAppRegistrationReminders();
    expect(result.failed).toBe(1);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastReminderAttemptAt: expect.any(Date) }),
      })
    );
    expect(updateMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ highestReminderStageSent: 2 }),
      })
    );
  });

  it("skips retry when the last failed attempt was less than 15 minutes ago", () => {
    expect(
      isReminderRetryThrottled(new Date(Date.now() - 5 * 60 * 1000))
    ).toBe(true);
  });

  it("continues processing other reminders after one failure", async () => {
    const now = Date.now();
    const recordA = buildPrismaRecord({
      conversation: { waId: "919800000001" },
      lastInboundAt: new Date(now - WHATSAPP_REMINDER_2H_MS),
    });
    const recordB = buildPrismaRecord({
      conversation: { waId: "919800000002" },
      lastInboundAt: new Date(now - WHATSAPP_REMINDER_2H_MS),
    });
    findManyMock.mockResolvedValue([recordA, recordB]);
    findUniqueMock.mockImplementation(async ({ where }: { where: { waId: string } }) =>
      [recordA, recordB].find((record) => record.waId === where.waId) ?? null
    );
    dispatchMock
      .mockResolvedValueOnce({ dispatched: 0, failed: 1, results: [] })
      .mockResolvedValueOnce({ dispatched: 1, failed: 0, results: [] });

    const result = await processWhatsAppRegistrationReminders();
    expect(result.failed).toBe(1);
    expect(result.sent2h).toBe(1);
    expect(dispatchMock).toHaveBeenCalledTimes(2);
  });

  it("builds 2h and 6h reminder button actions with existing interactive IDs", () => {
    const twoHour = buildWhatsAppRegistrationReminder2hActions(
      buildEligibleConversation()
    )[0];
    const sixHour = buildWhatsAppRegistrationReminder6hActions(
      buildEligibleConversation()
    )[0];

    expect(twoHour.type).toBe("BUTTONS");
    if (twoHour.type === "BUTTONS") {
      expect(twoHour.buttons.map((button) => button.id)).toEqual([
        REGISTRATION_INTERACTIVE_IDS.CONTINUE,
        REGISTRATION_INTERACTIVE_IDS.RESTART,
      ]);
    }
    if (sixHour.type === "BUTTONS") {
      expect(sixHour.buttons.map((button) => button.id)).toEqual([
        REGISTRATION_INTERACTIVE_IDS.CONTINUE,
        REGISTRATION_INTERACTIVE_IDS.RESTART,
      ]);
    }
  });

  it("processor sends 2h then 6h across separate runs", async () => {
    const lastInboundAt = new Date(Date.now() - WHATSAPP_REMINDER_2H_MS);
    const record = buildPrismaRecord({ lastInboundAt, highestReminderStageSent: 0 });
    findManyMock.mockResolvedValue([record]);
    findUniqueMock.mockResolvedValue(record);

    const first = await processWhatsAppRegistrationReminders();
    expect(first.sent2h).toBe(1);

    const afterTwoHours = buildPrismaRecord({
      lastInboundAt,
      highestReminderStageSent: 2,
    });
    findManyMock.mockResolvedValue([afterTwoHours]);
    findUniqueMock.mockResolvedValue(afterTwoHours);
    findUniqueMock.mockResolvedValue({
      ...afterTwoHours,
      lastInboundAt: new Date(Date.now() - WHATSAPP_REMINDER_6H_MS),
    });
    findManyMock.mockResolvedValue([
      buildPrismaRecord({
        lastInboundAt: new Date(Date.now() - WHATSAPP_REMINDER_6H_MS),
        highestReminderStageSent: 2,
      }),
    ]);
    findUniqueMock.mockResolvedValue(
      buildPrismaRecord({
        lastInboundAt: new Date(Date.now() - WHATSAPP_REMINDER_6H_MS),
        highestReminderStageSent: 2,
      })
    );

    const second = await processWhatsAppRegistrationReminders();
    expect(second.sent6h).toBe(1);
  });

  it("throttles processor retries within 15 minutes after failure", async () => {
    const lastInboundAt = new Date(Date.now() - WHATSAPP_REMINDER_2H_MS);
    const record = buildPrismaRecord({
      lastInboundAt,
      highestReminderStageSent: 0,
      lastReminderAttemptAt: new Date(Date.now() - 5 * 60 * 1000),
    });
    findManyMock.mockResolvedValue([record]);
    findUniqueMock.mockResolvedValue(record);

    const result = await processWhatsAppRegistrationReminders();
    expect(result.skipped).toBe(1);
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});
