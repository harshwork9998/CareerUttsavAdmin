import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createAdminSessionToken,
  verifyAdminSessionToken,
} from "@/lib/server/admin-session";

describe("admin session", () => {
  const originalSecret = process.env.ADMIN_SESSION_SECRET;

  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret-value";
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.ADMIN_SESSION_SECRET;
    } else {
      process.env.ADMIN_SESSION_SECRET = originalSecret;
    }
  });

  it("creates and verifies a signed session token", () => {
    const token = createAdminSessionToken({
      userId: "usr-001",
      authVersion: 0,
    });
    const session = verifyAdminSessionToken(token);
    expect(session?.userId).toBe("usr-001");
    expect(session?.authVersion).toBe(0);
  });

  it("rejects tampered tokens", () => {
    const token = createAdminSessionToken({ userId: "usr-001", authVersion: 0 });
    const tampered = `${token}x`;
    expect(verifyAdminSessionToken(tampered)).toBeNull();
  });

  it("rejects expired tokens", () => {
    const token = createAdminSessionToken({ userId: "usr-001", authVersion: 0 });
    const [encoded] = token.split(".");
    const payload = JSON.parse(
      Buffer.from(encoded!, "base64url").toString("utf-8")
    ) as { v: number; userId: string; authVersion?: number; iat: number; exp: number };
    payload.exp = Date.now() - 1000;
    const expiredEncoded = Buffer.from(JSON.stringify(payload)).toString(
      "base64url"
    );
    const { createHmac } = require("crypto") as typeof import("crypto");
    const signature = createHmac("sha256", process.env.ADMIN_SESSION_SECRET!)
      .update(expiredEncoded)
      .digest("base64url");
    expect(verifyAdminSessionToken(`${expiredEncoded}.${signature}`)).toBeNull();
  });
});
