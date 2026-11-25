import { beforeEach, describe, expect, it, vi } from "vitest";

const updateManyMock = vi.fn();

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    whatsAppRegistrationConversation: {
      updateMany: (...args: unknown[]) => updateManyMock(...args),
    },
  },
}));

import { markPostRegistrationEntryPassDelivered } from "@/lib/server/whatsapp/whatsapp-growth-schedule-eligibility";

describe("post-registration growth schedule eligibility", () => {
  beforeEach(() => {
    updateManyMock.mockReset();
    updateManyMock.mockResolvedValue({ count: 1 });
  });

  it("persists entry-pass delivery timestamp only when not already set", async () => {
    const at = new Date("2026-10-22T12:00:00.000Z");
    const saved = await markPostRegistrationEntryPassDelivered("919876543210", at);

    expect(saved).toBe(true);
    expect(updateManyMock).toHaveBeenCalledWith({
      where: {
        waId: "919876543210",
        postRegistrationEntryPassDeliveredAt: null,
      },
      data: { postRegistrationEntryPassDeliveredAt: at },
    });
  });

  it("returns false when timestamp was already recorded (idempotent)", async () => {
    updateManyMock.mockResolvedValue({ count: 0 });
    const at = new Date("2026-10-22T12:00:00.000Z");
    const saved = await markPostRegistrationEntryPassDelivered("919876543210", at);
    expect(saved).toBe(false);
  });
});