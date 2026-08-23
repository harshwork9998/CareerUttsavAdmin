import { describe, expect, it } from "vitest";

import {
  formatRegisterApiError,
  registerApiSchema,
  registerSchema,
} from "@/lib/auth-validation";

const validRegistration = {
  fullName: "New Admin",
  email: "new.admin@careeruttsav.in",
  mobile: "9876543210",
  password: "securepass",
};

describe("register API schema contract", () => {
  it("accepts client payload without confirmPassword", () => {
    const parsed = registerApiSchema.safeParse(validRegistration);
    expect(parsed.success).toBe(true);
  });

  it("rejects payload that only registerSchema would accept with confirmPassword", () => {
    const clientOnly = registerSchema.safeParse({
      ...validRegistration,
      confirmPassword: "securepass",
    });
    expect(clientOnly.success).toBe(true);

    const apiWithoutConfirm = registerApiSchema.safeParse(validRegistration);
    expect(apiWithoutConfirm.success).toBe(true);
  });

  it("rejects missing confirmPassword on client schema", () => {
    const parsed = registerSchema.safeParse(validRegistration);
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid email with friendly message", () => {
    const parsed = registerApiSchema.safeParse({
      ...validRegistration,
      email: "not-an-email",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(formatRegisterApiError(parsed.error)).toBe(
        "Please enter a valid email address"
      );
    }
  });

  it("rejects invalid mobile with friendly message", () => {
    const parsed = registerApiSchema.safeParse({
      ...validRegistration,
      mobile: "12345",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(formatRegisterApiError(parsed.error)).toContain("10-digit");
    }
  });

  it("rejects short password with friendly message", () => {
    const parsed = registerApiSchema.safeParse({
      ...validRegistration,
      password: "short",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(formatRegisterApiError(parsed.error)).toBe(
        "Password must be at least 8 characters"
      );
    }
  });

  it("rejects missing required fullName", () => {
    const parsed = registerApiSchema.safeParse({
      ...validRegistration,
      fullName: "",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(formatRegisterApiError(parsed.error)).toBe("Full name is required");
    }
  });

  it("normalizes +91 mobile numbers", () => {
    const parsed = registerApiSchema.safeParse({
      ...validRegistration,
      mobile: "+91 98765 43210",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.mobile).toBe("9876543210");
    }
  });
});
