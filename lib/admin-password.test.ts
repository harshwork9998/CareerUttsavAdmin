import { afterEach, describe, expect, it } from "vitest";

import {
  hashAdminPassword,
  isAdminPasswordHash,
  verifyAdminPassword,
} from "@/lib/admin-password";

describe("admin-password", () => {
  it("hashes and verifies passwords with scrypt", () => {
    const hash = hashAdminPassword("secret-password");
    expect(isAdminPasswordHash(hash)).toBe(true);
    expect(verifyAdminPassword("secret-password", hash)).toBe(true);
    expect(verifyAdminPassword("wrong-password", hash)).toBe(false);
  });

  it("rejects invalid stored hash format", () => {
    expect(verifyAdminPassword("secret", "plaintext")).toBe(false);
    expect(verifyAdminPassword("secret", undefined)).toBe(false);
  });
});
