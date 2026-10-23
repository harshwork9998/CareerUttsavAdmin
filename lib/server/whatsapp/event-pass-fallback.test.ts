import { beforeEach, describe, expect, it, vi } from "vitest";

const fallbackMock = vi.fn();

vi.mock("sharp", () => {
  const sharp = () => {
    throw new Error("renderer unavailable");
  };
  return { default: sharp };
});

vi.mock("qrcode", () => ({
  default: {
    toBuffer: vi.fn(async () => {
      throw new Error("qr generator unavailable");
    }),
  },
}));

vi.mock("@/lib/email", () => ({
  generateRegistrationQrPngBase64: (...args: unknown[]) => fallbackMock(...args),
}));

import { generateWhatsAppEntryPassPngBase64 } from "@/lib/server/whatsapp/event-pass";

describe("event pass failure fallback", () => {
  beforeEach(() => {
    fallbackMock.mockReset();
  });

  it("sends the plain registration QR when pass rendering fails", async () => {
    const plain = Buffer.from("plain-registration-qr").toString("base64");
    fallbackMock.mockResolvedValue(plain);

    const result = await generateWhatsAppEntryPassPngBase64({
      registrationId: "CU-BLR-2026-00042",
      seminarTitles: ["Do What You Love, Love What You Do"],
    });

    expect(fallbackMock).toHaveBeenCalledWith("CU-BLR-2026-00042");
    expect(result).toBe(plain);
    expect(result.length).toBeGreaterThan(0);
  });

  it("does not return an empty image when the fallback is empty", async () => {
    fallbackMock.mockResolvedValue("");

    await expect(
      generateWhatsAppEntryPassPngBase64({
        registrationId: "CU-BLR-2026-00042",
        seminarTitles: [],
      })
    ).rejects.toThrow(/empty/i);
  });
});
