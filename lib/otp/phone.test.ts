import { describe, expect, it } from "vitest";

import { normalizeOtpPhone, toMsg91Mobile } from "@/lib/otp/phone";

describe("normalizeOtpPhone", () => {
  it("accepts 10-digit Indian mobiles starting 6–9", () => {
    expect(normalizeOtpPhone("9876543210")).toBe("9876543210");
    expect(normalizeOtpPhone("6123456789")).toBe("6123456789");
  });

  it("accepts 91 and +91 prefixes", () => {
    expect(normalizeOtpPhone("919876543210")).toBe("9876543210");
    expect(normalizeOtpPhone("+919876543210")).toBe("9876543210");
    expect(normalizeOtpPhone("+91 98765 43210")).toBe("9876543210");
  });

  it("accepts leading 0 national format", () => {
    expect(normalizeOtpPhone("09876543210")).toBe("9876543210");
  });

  it("rejects invalid numbers", () => {
    expect(normalizeOtpPhone("5876543210")).toBeNull();
    expect(normalizeOtpPhone("12345")).toBeNull();
    expect(normalizeOtpPhone("")).toBeNull();
    expect(normalizeOtpPhone(null)).toBeNull();
    expect(normalizeOtpPhone("abcdefghij")).toBeNull();
    expect(normalizeOtpPhone("91987654321")).toBeNull();
  });
});

describe("toMsg91Mobile", () => {
  it("prefixes 91", () => {
    expect(toMsg91Mobile("9876543210")).toBe("919876543210");
  });
});
