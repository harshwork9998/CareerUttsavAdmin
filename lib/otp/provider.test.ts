import { afterEach, describe, expect, it } from "vitest";

import {
  isMsg91Success,
  parseMsg91Json,
} from "@/lib/otp/msg91";
import { resolveOtpProvider } from "@/lib/otp/provider";

describe("MSG91 response parsing", () => {
  it("treats type === success as success", () => {
    expect(isMsg91Success({ type: "success", message: "OTP verified success" })).toBe(
      true
    );
  });

  it("rejects non-success types", () => {
    expect(isMsg91Success({ type: "error", message: "Authentication failure" })).toBe(
      false
    );
    expect(isMsg91Success({ type: "Success" })).toBe(false);
    expect(isMsg91Success({ message: "OTP verified success" })).toBe(false);
    expect(isMsg91Success({})).toBe(false);
  });

  it("parses JSON objects only", () => {
    expect(parseMsg91Json('{"type":"success"}')).toEqual({
      ok: true,
      body: { type: "success" },
    });
    expect(parseMsg91Json("not-json").ok).toBe(false);
    expect(parseMsg91Json("[]").ok).toBe(false);
  });
});

describe("resolveOtpProvider", () => {
  afterEach(() => {
    // no shared mutation — each call passes env explicitly
  });

  it("defaults to msg91 and requires config", () => {
    const missing = resolveOtpProvider({
      NODE_ENV: "development",
      MSG91_AUTH_KEY: "",
      MSG91_TEMPLATE_ID: "",
    });
    expect(missing).toEqual({
      ok: false,
      status: 503,
      error:
        "MSG91 is not configured. Set MSG91_AUTH_KEY and MSG91_TEMPLATE_ID.",
    });

    const ok = resolveOtpProvider({
      NODE_ENV: "development",
      MSG91_AUTH_KEY: "key",
      MSG91_TEMPLATE_ID: "tmpl",
    });
    expect(ok).toEqual({ ok: true, provider: "msg91" });
  });

  it("requires phone verification secret in production for msg91", () => {
    expect(
      resolveOtpProvider({
        NODE_ENV: "production",
        MSG91_AUTH_KEY: "key",
        MSG91_TEMPLATE_ID: "tmpl",
      })
    ).toMatchObject({
      ok: false,
      status: 503,
      error: expect.stringContaining("PHONE_VERIFICATION_TOKEN_SECRET"),
    });

    expect(
      resolveOtpProvider({
        NODE_ENV: "production",
        MSG91_AUTH_KEY: "key",
        MSG91_TEMPLATE_ID: "tmpl",
        PHONE_VERIFICATION_TOKEN_SECRET: "production-secret",
      })
    ).toEqual({ ok: true, provider: "msg91" });

    expect(
      resolveOtpProvider({
        NODE_ENV: "production",
        MSG91_AUTH_KEY: "key",
        MSG91_TEMPLATE_ID: "tmpl",
        OTP_HASH_SECRET: "legacy-production-secret",
      })
    ).toEqual({ ok: true, provider: "msg91" });
  });

  it("allows mock only outside production unless ALLOW_MOCK_OTP=true", () => {
    expect(
      resolveOtpProvider({
        OTP_PROVIDER: "mock",
        NODE_ENV: "development",
      })
    ).toEqual({ ok: true, provider: "mock" });

    expect(
      resolveOtpProvider({
        OTP_PROVIDER: "mock",
        NODE_ENV: "production",
      })
    ).toMatchObject({ ok: false, status: 503 });

    expect(
      resolveOtpProvider({
        OTP_PROVIDER: "mock",
        NODE_ENV: "development",
        VERCEL_ENV: "production",
      })
    ).toMatchObject({ ok: false, status: 503 });

    expect(
      resolveOtpProvider({
        OTP_PROVIDER: "mock",
        NODE_ENV: "production",
        ALLOW_MOCK_OTP: "true",
      })
    ).toEqual({ ok: true, provider: "mock" });
  });
});
