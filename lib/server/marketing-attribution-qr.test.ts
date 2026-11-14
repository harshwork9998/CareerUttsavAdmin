import { describe, expect, it, vi } from "vitest";
import QRCode from "qrcode";

import { buildCampaignTrackingUrl } from "@/lib/marketing-attribution/tracking-url";

vi.mock("@/lib/server/admin-auth", () => ({
  requireSuperuser: vi.fn(async () => ({ user: { id: "admin" } })),
}));

vi.mock("@/lib/server/marketing-attribution-prisma-store", () => ({
  getMarketingCampaignById: vi.fn(async () => ({
    id: "camp-1",
    trackingCode: "AUTO26",
  })),
}));

describe("campaign QR generation", () => {
  it("encodes the tracking URL only", async () => {
    const url = buildCampaignTrackingUrl("AUTO26");
    const spy = vi
      .spyOn(QRCode, "toBuffer")
      .mockResolvedValue(Buffer.from("png") as never);
    const { GET } = await import(
      "@/app/api/marketing-attribution/campaigns/[id]/qr/route"
    );
    const response = await GET(new Request("http://test"), {
      params: Promise.resolve({ id: "camp-1" }),
    });
    expect(response.status).toBe(200);
    expect(spy).toHaveBeenCalledWith(
      url,
      expect.objectContaining({ type: "png" })
    );
    spy.mockRestore();
  });
});