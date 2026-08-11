import { describe, expect, it } from "vitest";

import {
  constrainIndianMobileTyping,
  isValidIndianMobile,
  normalizeIndianMobileInput,
  resolveIndianMobilePaste,
  validateIndianMobileOnWrite,
} from "@/lib/indian-mobile";

describe("normalizeIndianMobileInput", () => {
  it("accepts 10-digit mobiles starting 6–9", () => {
    expect(normalizeIndianMobileInput("9876543210")).toBe("9876543210");
    expect(normalizeIndianMobileInput("6123456789")).toBe("6123456789");
  });

  it("strips +91 / 91 / spaces / hyphens", () => {
    expect(normalizeIndianMobileInput("+91 98765 43210")).toBe("9876543210");
    expect(normalizeIndianMobileInput("91 9876543210")).toBe("9876543210");
    expect(normalizeIndianMobileInput("98765-43210")).toBe("9876543210");
  });

  it("strips leading 0", () => {
    expect(normalizeIndianMobileInput("09876543210")).toBe("9876543210");
  });

  it("rejects invalid prefixes and lengths", () => {
    expect(normalizeIndianMobileInput("5876543210")).toBeNull();
    expect(normalizeIndianMobileInput("12345")).toBeNull();
    expect(normalizeIndianMobileInput("abcdefghij")).toBeNull();
  });
});

describe("constrainIndianMobileTyping", () => {
  it("allows only digits up to 10", () => {
    expect(constrainIndianMobileTyping("98a76b")).toBe("9876");
    expect(constrainIndianMobileTyping("9876543210")).toBe("9876543210");
    expect(constrainIndianMobileTyping("98765432101")).toBe("9876543210");
    expect(constrainIndianMobileTyping("987654321012")).toBe("9876543210");
  });
});

describe("resolveIndianMobilePaste", () => {
  it("normalizes recognized pasted formats to 10 digits", () => {
    expect(resolveIndianMobilePaste("9876543210")).toBe("9876543210");
    expect(resolveIndianMobilePaste("+91 9876543210")).toBe("9876543210");
    expect(resolveIndianMobilePaste("91 9876543210")).toBe("9876543210");
    expect(resolveIndianMobilePaste("09876543210")).toBe("9876543210");
    expect(resolveIndianMobilePaste("98765-43210")).toBe("9876543210");
    expect(resolveIndianMobilePaste("98765 43210")).toBe("9876543210");
  });

  it("rejects invalid long pastes without truncating to a valid number", () => {
    expect(resolveIndianMobilePaste("98765432101")).toBeNull();
    expect(resolveIndianMobilePaste("9198765432100")).toBeNull();
    expect(resolveIndianMobilePaste("0009876543210")).toBeNull();
    expect(resolveIndianMobilePaste("+1 9876543210")).toBeNull();
    // Must not become 9876543210 via blind slice
    expect(resolveIndianMobilePaste("98765432101")).not.toBe("9876543210");
  });
});

describe("validateIndianMobileOnWrite", () => {
  it("preserves unchanged historical values", () => {
    const result = validateIndianMobileOnWrite(
      "+91 22 2572 2545",
      "+91 22 2572 2545"
    );
    expect(result).toEqual({ ok: true, value: "+91 22 2572 2545" });
  });

  it("requires valid mobile when changed", () => {
    const result = validateIndianMobileOnWrite("9876543210", "+91 22 2572 2545");
    expect(result).toEqual({ ok: true, value: "9876543210" });
    expect(isValidIndianMobile("111")).toBe(false);
    const bad = validateIndianMobileOnWrite("111", "+91 22 2572 2545");
    expect(bad.ok).toBe(false);
  });
});
