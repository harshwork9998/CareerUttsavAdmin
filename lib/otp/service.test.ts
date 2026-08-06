import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  __resetOtpStoreForTests,
  __setOtpStoreForTests,
} from "@/lib/otp/persistence";
import {
  consumePhoneVerification,
  sendOtp,
  verifyOtp,
} from "@/lib/otp/service";
import { MOCK_OTP_CODE, OTP_CONFIG } from "@/lib/otp/types";

const PHONE = "9876543210";

describe("OTP service (mock provider)", () => {
  beforeEach(() => {
    vi.stubEnv("OTP_PROVIDER", "mock");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PHONE_VERIFICATION_TOKEN_SECRET", "test-secret");
    __setOtpStoreForTests([]);
  });

  afterEach(() => {
    __resetOtpStoreForTests();
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("sends OTP in mock mode with debugCode", async () => {
    const result = await sendOtp({
      phone: PHONE,
      purpose: "student_registration",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.debugCode).toBe(MOCK_OTP_CODE);
    expect(result.resendAfterSeconds).toBe(
      Math.floor(OTP_CONFIG.resendCooldownMs / 1000)
    );
  });

  it("rejects invalid phone on send", async () => {
    const result = await sendOtp({
      phone: "123",
      purpose: "student_registration",
    });
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("returns 503 when MSG91 config missing and provider is msg91", async () => {
    vi.stubEnv("OTP_PROVIDER", "msg91");
    vi.stubEnv("MSG91_AUTH_KEY", "");
    vi.stubEnv("MSG91_TEMPLATE_ID", "");
    const result = await sendOtp({
      phone: PHONE,
      purpose: "student_registration",
    });
    expect(result).toMatchObject({ ok: false, status: 503 });
  });

  it("blocks mock provider in production", async () => {
    vi.stubEnv("OTP_PROVIDER", "mock");
    vi.stubEnv("NODE_ENV", "production");
    const result = await sendOtp({
      phone: PHONE,
      purpose: "student_registration",
    });
    expect(result).toMatchObject({ ok: false, status: 503 });
  });

  it("enforces resend cooldown", async () => {
    const first = await sendOtp({
      phone: PHONE,
      purpose: "student_registration",
    });
    expect(first.ok).toBe(true);

    const second = await sendOtp({
      phone: PHONE,
      purpose: "student_registration",
    });
    expect(second).toMatchObject({ ok: false, status: 429 });
    if (!second.ok) {
      expect(second.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("enforces max 3 sends per 15 minutes", async () => {
    vi.useFakeTimers();
    const base = new Date("2026-01-01T00:00:00.000Z");
    vi.setSystemTime(base);

    for (let i = 0; i < 3; i += 1) {
      const result = await sendOtp({
        phone: PHONE,
        purpose: "student_registration",
      });
      expect(result.ok).toBe(true);
      vi.advanceTimersByTime(OTP_CONFIG.resendCooldownMs + 1);
    }

    const blocked = await sendOtp({
      phone: PHONE,
      purpose: "student_registration",
    });
    expect(blocked).toMatchObject({ ok: false, status: 429 });
  });

  it("verifies only the mock OTP and issues a verificationToken", async () => {
    await sendOtp({ phone: PHONE, purpose: "student_registration" });

    const bad = await verifyOtp({
      phone: PHONE,
      purpose: "student_registration",
      code: "000000",
    });
    expect(bad).toMatchObject({ ok: false, status: 400 });

    const good = await verifyOtp({
      phone: PHONE,
      purpose: "student_registration",
      code: MOCK_OTP_CODE,
    });
    expect(good.ok).toBe(true);
    if (!good.ok) return;
    expect(good.verificationToken).toMatch(/^[a-f0-9]{64}$/);
    expect(good.phone).toBe(PHONE);
  });

  it("limits verification attempts", async () => {
    await sendOtp({ phone: PHONE, purpose: "student_registration" });

    for (let i = 0; i < OTP_CONFIG.maxVerifyAttempts; i += 1) {
      const result = await verifyOtp({
        phone: PHONE,
        purpose: "student_registration",
        code: "000000",
      });
      expect(result.ok).toBe(false);
    }

    const locked = await verifyOtp({
      phone: PHONE,
      purpose: "student_registration",
      code: MOCK_OTP_CODE,
    });
    expect(locked).toMatchObject({ ok: false, status: 429 });
  });

  it("treats locally expired challenges as expired", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    await sendOtp({ phone: PHONE, purpose: "student_registration" });
    vi.advanceTimersByTime(OTP_CONFIG.ttlMs + 1);

    const result = await verifyOtp({
      phone: PHONE,
      purpose: "student_registration",
      code: MOCK_OTP_CODE,
    });
    expect(result).toMatchObject({
      ok: false,
      status: 400,
      error: "OTP has expired. Please request a new code.",
    });
  });

  it("creates a one-time consumable verificationToken", async () => {
    await sendOtp({ phone: PHONE, purpose: "student_registration" });
    const verified = await verifyOtp({
      phone: PHONE,
      purpose: "student_registration",
      code: MOCK_OTP_CODE,
    });
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;

    const first = consumePhoneVerification({
      phone: PHONE,
      purpose: "student_registration",
      verificationToken: verified.verificationToken,
      consume: true,
    });
    expect(first).toEqual({ ok: true });

    const second = consumePhoneVerification({
      phone: PHONE,
      purpose: "student_registration",
      verificationToken: verified.verificationToken,
      consume: true,
    });
    expect(second.ok).toBe(false);
  });
});

describe("OTP service (MSG91 fetch)", () => {
  beforeEach(() => {
    vi.stubEnv("OTP_PROVIDER", "msg91");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MSG91_AUTH_KEY", "test-auth-key");
    vi.stubEnv("MSG91_TEMPLATE_ID", "test-template");
    vi.stubEnv("PHONE_VERIFICATION_TOKEN_SECRET", "test-secret");
    __setOtpStoreForTests([]);
  });

  afterEach(() => {
    __resetOtpStoreForTests();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("send success when MSG91 returns type success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ type: "success", message: "otp_sent" }),
      })
    );

    const result = await sendOtp({
      phone: PHONE,
      purpose: "student_registration",
    });
    expect(result.ok).toBe(true);
    expect(result).not.toHaveProperty("debugCode");
  });

  it("send failure when MSG91 type is not success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ type: "error", message: "Authentication failure" }),
      })
    );

    const result = await sendOtp({
      phone: PHONE,
      purpose: "student_registration",
    });
    expect(result).toMatchObject({ ok: false, status: 502 });
  });

  it("verify succeeds only when type === success", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ type: "success" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({ type: "error", message: "invalid otp" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({ type: "success", message: "OTP verified success" }),
        })
    );

    await sendOtp({ phone: PHONE, purpose: "student_registration" });

    const fail = await verifyOtp({
      phone: PHONE,
      purpose: "student_registration",
      code: "111111",
    });
    expect(fail.ok).toBe(false);

    const pass = await verifyOtp({
      phone: PHONE,
      purpose: "student_registration",
      code: "222222",
    });
    expect(pass.ok).toBe(true);
  });

  it("maps MSG91 expired verify responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ type: "success" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({ type: "error", message: "OTP expired" }),
        })
    );

    await sendOtp({ phone: PHONE, purpose: "student_registration" });
    const result = await verifyOtp({
      phone: PHONE,
      purpose: "student_registration",
      code: "111111",
    });
    expect(result).toMatchObject({
      ok: false,
      error: "OTP has expired. Please request a new code.",
    });
  });

  it("uses retry endpoint on resend after cooldown", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ type: "success" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendOtp({ phone: PHONE, purpose: "student_registration" });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "https://control.msg91.com/api/v5/otp"
    );
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");

    vi.advanceTimersByTime(OTP_CONFIG.resendCooldownMs + 1);
    await sendOtp({ phone: PHONE, purpose: "student_registration" });

    const retryUrl = String(fetchMock.mock.calls[1]?.[0]);
    expect(retryUrl).toContain("/otp/retry");
    expect(retryUrl).toContain("retrytype=text");
    expect(retryUrl).toContain("mobile=919876543210");
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("GET");

    vi.useRealTimers();
  });
});
