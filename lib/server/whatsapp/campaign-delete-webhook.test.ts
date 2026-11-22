import { describe, expect, it, vi } from "vitest";

import { applyCampaignDeliveryStatus } from "@/lib/server/whatsapp/campaign-delivery-webhook";

const { findUnique, updateMock } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    whatsAppCampaignRecipient: {
      findUnique,
      update: updateMock,
    },
  },
}));

describe("late webhook after campaign removal", () => {
  it("still updates delivery when recipient evidence is retained", async () => {
    findUnique.mockResolvedValue({
      id: "recipient-1",
      status: "SENT",
    });
    updateMock.mockResolvedValue({});

    const handled = await applyCampaignDeliveryStatus({
      messageId: "wamid.stored",
      status: "delivered",
    });

    expect(handled).toBe(true);
    expect(updateMock).toHaveBeenCalled();
  });
});