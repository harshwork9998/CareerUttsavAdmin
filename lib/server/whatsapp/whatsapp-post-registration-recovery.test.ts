import { beforeEach, describe, expect, it, vi } from "vitest";

const scheduleMock = vi.fn();
const loadConversationMock = vi.fn();
const findManyMock = vi.fn();
const triggerCountMock = vi.fn();

vi.mock("@/lib/server/whatsapp/whatsapp-post-registration-schedule", () => ({
  schedulePostRegistrationGrowthTriggers: (...args: unknown[]) => scheduleMock(...args),
}));

vi.mock("@/lib/server/whatsapp/whatsapp-conversation-store", () => ({
  loadWhatsAppConversationRecordByWaId: (...args: unknown[]) =>
    loadConversationMock(...args),
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    whatsAppRegistrationConversation: {
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
    whatsAppPostRegistrationTrigger: {
      count: (...args: unknown[]) => triggerCountMock(...args),
    },
  },
}));

import {
  POST_REGISTRATION_GROWTH_RECOVERY_LOOKBACK_MS,
  recoverMissingPostRegistrationGrowthSchedules,
} from "@/lib/server/whatsapp/whatsapp-post-registration-recovery";

const NOW = new Date("2026-10-22T12:05:00.000Z");
const ENTRY_PASS_AT = new Date("2026-10-22T12:00:00.000Z");

describe("post-registration growth schedule recovery", () => {
  beforeEach(() => {
    scheduleMock.mockReset();
    loadConversationMock.mockReset();
    findManyMock.mockReset();
    triggerCountMock.mockReset();
    scheduleMock.mockResolvedValue({ scheduled: true });
    loadConversationMock.mockResolvedValue({
      waId: "919876543210",
      status: "COMPLETED",
      currentStep: "COMPLETED",
      completedRegistrationId: "reg-001",
    });
    triggerCountMock.mockResolvedValue(0);
    findManyMock.mockImplementation(async () => [
      {
        waId: "919876543210",
        completedRegistrationId: "reg-001",
        postRegistrationEntryPassDeliveredAt: ENTRY_PASS_AT,
      },
    ]);
  });

  it("queries only conversations with verified entry-pass QR delivery within lookback", async () => {
    await recoverMissingPostRegistrationGrowthSchedules(NOW);

    const call = findManyMock.mock.calls[0]?.[0];
    const since = new Date(NOW.getTime() - POST_REGISTRATION_GROWTH_RECOVERY_LOOKBACK_MS);
    expect(call?.where?.postRegistrationEntryPassDeliveredAt).toEqual({
      not: null,
      gte: since,
    });
    expect(call?.where?.status).toBe("COMPLETED");
    expect(call?.where?.completedRegistrationId).toEqual({ not: null });
  });

  it("does not recover when prisma returns no QR-eligible rows (failed QR / COMPLETED only)", async () => {
    findManyMock.mockResolvedValue([]);
    const result = await recoverMissingPostRegistrationGrowthSchedules(NOW);
    expect(result.examined).toBe(0);
    expect(result.recovered).toBe(0);
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it("recovers missing growth triggers using entry-pass time as completedAt anchor", async () => {
    const result = await recoverMissingPostRegistrationGrowthSchedules(NOW);

    expect(result.recovered).toBe(1);
    expect(scheduleMock).toHaveBeenCalledOnce();
    expect(scheduleMock.mock.calls[0]?.[0]).toMatchObject({
      registrationId: "reg-001",
      waId: "919876543210",
      completedAt: ENTRY_PASS_AT,
    });
  });

  it("skips registrations that already have growth triggers (no duplicate scheduling)", async () => {
    triggerCountMock.mockResolvedValue(3);
    const result = await recoverMissingPostRegistrationGrowthSchedules(NOW);
    expect(result.skipped).toBe(1);
    expect(result.recovered).toBe(0);
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it("records scheduling failures without throwing (worker restart safe)", async () => {
    scheduleMock.mockRejectedValue(new Error("db unavailable"));
    const result = await recoverMissingPostRegistrationGrowthSchedules(NOW);
    expect(result.failed).toBe(1);
    expect(result.recovered).toBe(0);
  });

  it("does not schedule when recovery batch is empty for registrations outside lookback", async () => {
    findManyMock.mockResolvedValue([]);
    const historicalNow = new Date("2026-11-25T12:00:00.000Z");
    const result = await recoverMissingPostRegistrationGrowthSchedules(historicalNow);
    expect(result.examined).toBe(0);
    expect(scheduleMock).not.toHaveBeenCalled();
  });
});