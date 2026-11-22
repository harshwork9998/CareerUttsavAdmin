import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    whatsAppCampaignRecipient: {
      findUnique: vi.fn(async () => ({
        id: "rec-1",
        status: "ACCEPTED",
      })),
      update: vi.fn(async () => ({})),
    },
  },
}));

import { applyCampaignDeliveryStatus } from "@/lib/server/whatsapp/campaign-delivery-webhook";
import { prisma } from "@/lib/server/prisma";

describe("applyCampaignDeliveryStatus", () => {
  beforeEach(() => {
    vi.mocked(prisma.whatsAppCampaignRecipient.update).mockClear();
  });

  it("maps delivered webhook to recipient row", async () => {
    const updated = await applyCampaignDeliveryStatus({
      messageId: "wamid.1",
      status: "delivered",
    });
    expect(updated).toBe(true);
    expect(prisma.whatsAppCampaignRecipient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rec-1" },
        data: expect.objectContaining({ status: "DELIVERED" }),
      })
    );
  });
});