import { beforeEach, describe, expect, it, vi } from "vitest";

import { WHATSAPP_CUSTOMER_SERVICE_WINDOW_MS } from "@/lib/server/whatsapp/whatsapp-growth-channel-policy";
import { channelInvitePromotionalBlockReason } from "@/lib/server/whatsapp/whatsapp-growth-channel-policy";

const isPhoneSuppressedMock = vi.fn();

vi.mock("@/lib/server/whatsapp/campaign-suppression", () => ({
  isPhoneSuppressed: (...args: unknown[]) => isPhoneSuppressedMock(...args),
}));

describe("channel invite promotional policy", () => {
  beforeEach(() => {
    isPhoneSuppressedMock.mockReset();
    isPhoneSuppressedMock.mockResolvedValue(false);
  });

  it("allows a recent inbound within the customer-service window", async () => {
    const now = new Date("2026-10-22T12:35:00.000Z");
    const lastInboundAt = new Date(
      now.getTime() - WHATSAPP_CUSTOMER_SERVICE_WINDOW_MS + 60_000
    );
    await expect(
      channelInvitePromotionalBlockReason({
        waId: "919876543210",
        now,
        lastInboundAt,
      })
    ).resolves.toBeNull();
  });

  it("blocks suppressed recipients", async () => {
    isPhoneSuppressedMock.mockResolvedValue(true);
    await expect(
      channelInvitePromotionalBlockReason({
        waId: "919876543210",
        now: new Date(),
        lastInboundAt: new Date(),
      })
    ).resolves.toBe("suppressed");
    expect(isPhoneSuppressedMock).toHaveBeenCalledWith("9876543210");
  });

  it("blocks when the customer-service window has expired", async () => {
    const now = new Date("2026-10-23T13:00:00.000Z");
    const lastInboundAt = new Date(
      now.getTime() - WHATSAPP_CUSTOMER_SERVICE_WINDOW_MS - 1
    );
    await expect(
      channelInvitePromotionalBlockReason({
        waId: "919876543210",
        now,
        lastInboundAt,
      })
    ).resolves.toBe("customer_service_window_closed");
  });

  it("blocks when last inbound time is unknown", async () => {
    await expect(
      channelInvitePromotionalBlockReason({
        waId: "919876543210",
        now: new Date(),
        lastInboundAt: null,
      })
    ).resolves.toBe("missing_last_inbound_at");
  });
});