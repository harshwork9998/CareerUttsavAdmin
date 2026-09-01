import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OTP_CONFIG } from "@/lib/otp/types";

const PHONE_10 = "9876543210";
const AUTH_KEY = "test-auth-key";
const TEMPLATE_ID = "test-template-id";

function mockFetchSuccess() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ type: "success", message: "ok" }),
  });
}

describe("MSG91 outbound requests", () => {
  beforeEach(() => {
    vi.stubEnv("MSG91_AUTH_KEY", AUTH_KEY);
    vi.stubEnv("MSG91_TEMPLATE_ID", TEMPLATE_ID);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("send OTP uses POST /api/v5/otp with documented query parameters", async () => {
    const fetchMock = mockFetchSuccess();
    vi.stubGlobal("fetch", fetchMock);

    const { msg91SendOtp } = await import("@/lib/otp/msg91");
    await msg91SendOtp({ phone10: PHONE_10 });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(init.method).toBe("POST");
    expect(url.startsWith("https://control.msg91.com/api/v5/otp?")).toBe(true);

    const parsed = new URL(url);
    expect(parsed.searchParams.get("template_id")).toBe(TEMPLATE_ID);
    expect(parsed.searchParams.get("mobile")).toBe("919876543210");
    expect(parsed.searchParams.get("authkey")).toBe(AUTH_KEY);
    expect(parsed.searchParams.get("otp_length")).toBe(
      String(OTP_CONFIG.codeLength)
    );
    expect(parsed.searchParams.get("otp_expiry")).toBe(
      String(Math.floor(OTP_CONFIG.ttlMs / 60_000))
    );

    expect(init.headers).toMatchObject({
      accept: "application/json",
    });
    expect(init.headers).not.toHaveProperty("authkey");
    expect(init.body).toBeUndefined();
  });

  it("verify OTP uses GET /api/v5/otp/verify with mobile and otp query params", async () => {
    const fetchMock = mockFetchSuccess();
    vi.stubGlobal("fetch", fetchMock);

    const { msg91VerifyOtp } = await import("@/lib/otp/msg91");
    await msg91VerifyOtp({ phone10: PHONE_10, otp: "1234" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(init.method).toBe("GET");
    expect(url.startsWith("https://control.msg91.com/api/v5/otp/verify?")).toBe(
      true
    );
    const parsed = new URL(url);
    expect(parsed.searchParams.get("mobile")).toBe("919876543210");
    expect(parsed.searchParams.get("otp")).toBe("1234");
    expect(parsed.searchParams.get("authkey")).toBeNull();
    expect(init.headers).toMatchObject({
      authkey: AUTH_KEY,
      accept: "application/json",
    });
    expect(init.body).toBeUndefined();
  });

  it("retry OTP uses GET /api/v5/otp/retry with documented query parameters", async () => {
    const fetchMock = mockFetchSuccess();
    vi.stubGlobal("fetch", fetchMock);

    const { msg91RetryOtp } = await import("@/lib/otp/msg91");
    await msg91RetryOtp({ phone10: PHONE_10, retrytype: "text" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(init.method).toBe("GET");
    expect(url.startsWith("https://control.msg91.com/api/v5/otp/retry?")).toBe(
      true
    );
    const parsed = new URL(url);
    expect(parsed.searchParams.get("authkey")).toBe(AUTH_KEY);
    expect(parsed.searchParams.get("retrytype")).toBe("text");
    expect(parsed.searchParams.get("mobile")).toBe("919876543210");
    expect(init.headers).toMatchObject({
      accept: "application/json",
    });
    expect(init.headers).not.toHaveProperty("authkey");
    expect(init.body).toBeUndefined();
  });

  it("defaults retrytype to text when omitted", async () => {
    const fetchMock = mockFetchSuccess();
    vi.stubGlobal("fetch", fetchMock);

    const { msg91RetryOtp } = await import("@/lib/otp/msg91");
    await msg91RetryOtp({ phone10: PHONE_10 });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).searchParams.get("retrytype")).toBe("text");
  });

  it("returns config error when MSG91 credentials are missing", async () => {
    vi.stubEnv("MSG91_AUTH_KEY", "");
    vi.stubEnv("MSG91_TEMPLATE_ID", "");

    const { msg91SendOtp } = await import("@/lib/otp/msg91");
    const result = await msg91SendOtp({ phone10: PHONE_10 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe("config");
    expect(result.error).toContain("MSG91_AUTH_KEY");
  });
});
