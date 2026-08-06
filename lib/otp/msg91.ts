/**
 * MSG91 OTP API client.
 * Success detection is isolated in parseMsg91Json / isMsg91Success
 * so it can be adjusted after the first live test.
 */

import { toMsg91Mobile } from "@/lib/otp/phone";

const MSG91_BASE = "https://control.msg91.com/api/v5/otp";
const DEFAULT_TIMEOUT_MS = 15_000;

export type Msg91ApiResult =
  | { ok: true; type: "success"; message?: string; raw: Msg91ResponseBody }
  | {
      ok: false;
      error: string;
      kind: "config" | "network" | "timeout" | "provider" | "parse";
      message?: string;
      type?: string;
      httpStatus?: number;
    };

/** Confirmed MSG91 envelope fields we rely on. Do not invent others. */
export type Msg91ResponseBody = {
  type?: unknown;
  message?: unknown;
};

export function getMsg91Config():
  | { ok: true; authKey: string; templateId: string }
  | { ok: false; error: string } {
  const authKey = process.env.MSG91_AUTH_KEY?.trim() ?? "";
  const templateId = process.env.MSG91_TEMPLATE_ID?.trim() ?? "";
  if (!authKey || !templateId) {
    return {
      ok: false,
      error:
        "MSG91 is not configured. Set MSG91_AUTH_KEY and MSG91_TEMPLATE_ID.",
    };
  }
  return { ok: true, authKey, templateId };
}

/**
 * Treat as success only when JSON parses and type === "success".
 * All other shapes are failure.
 */
export function isMsg91Success(body: Msg91ResponseBody): boolean {
  return body.type === "success";
}

export function parseMsg91Json(text: string):
  | { ok: true; body: Msg91ResponseBody }
  | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "MSG91 returned a non-object JSON body" };
    }
    return { ok: true, body: parsed as Msg91ResponseBody };
  } catch {
    return { ok: false, error: "MSG91 returned invalid JSON" };
  }
}

/** Log provider responses without auth keys, OTPs, or full secrets. */
export function logMsg91ResponseSafe(
  operation: string,
  info: {
    httpStatus?: number;
    type?: unknown;
    message?: unknown;
    kind?: string;
  }
): void {
  const safeMessage =
    typeof info.message === "string"
      ? info.message.slice(0, 200)
      : undefined;
  console.info("[otp:msg91]", {
    operation,
    httpStatus: info.httpStatus,
    type: info.type,
    message: safeMessage,
    kind: info.kind,
  });
}

async function fetchMsg91(
  url: string,
  init: RequestInit,
  operation: string
): Promise<Msg91ApiResult> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    logMsg91ResponseSafe(operation, {
      kind: isTimeout ? "timeout" : "network",
    });
    return {
      ok: false,
      kind: isTimeout ? "timeout" : "network",
      error: isTimeout
        ? "OTP provider timed out. Please try again."
        : "Could not reach OTP provider. Please try again.",
    };
  }

  const text = await response.text();
  const parsed = parseMsg91Json(text);
  if (!parsed.ok) {
    logMsg91ResponseSafe(operation, {
      httpStatus: response.status,
      kind: "parse",
    });
    return {
      ok: false,
      kind: "parse",
      httpStatus: response.status,
      error: "Unexpected response from OTP provider.",
    };
  }

  const body = parsed.body;
  logMsg91ResponseSafe(operation, {
    httpStatus: response.status,
    type: body.type,
    message: body.message,
  });

  if (!response.ok || !isMsg91Success(body)) {
    const providerMessage =
      typeof body.message === "string" ? body.message : undefined;
    return {
      ok: false,
      kind: "provider",
      httpStatus: response.status,
      type: typeof body.type === "string" ? body.type : undefined,
      message: providerMessage,
      error: mapProviderFailureMessage(operation, providerMessage),
    };
  }

  return {
    ok: true,
    type: "success",
    message: typeof body.message === "string" ? body.message : undefined,
    raw: body,
  };
}

function mapProviderFailureMessage(
  operation: string,
  providerMessage?: string
): string {
  const lower = (providerMessage ?? "").toLowerCase();
  if (lower.includes("expir")) {
    return "OTP has expired. Please request a new code.";
  }
  if (operation === "verify") {
    if (
      lower.includes("invalid") ||
      lower.includes("incorrect") ||
      lower.includes("mismatch") ||
      lower.includes("not match")
    ) {
      return "Incorrect OTP. Please try again.";
    }
    return "OTP verification failed. Please try again.";
  }
  if (operation === "send" || operation === "retry") {
    return "Could not send OTP. Please try again.";
  }
  return "OTP provider request failed. Please try again.";
}

export async function msg91SendOtp(input: {
  phone10: string;
}): Promise<Msg91ApiResult> {
  const config = getMsg91Config();
  if (!config.ok) {
    return { ok: false, kind: "config", error: config.error };
  }

  return fetchMsg91(
    MSG91_BASE,
    {
      method: "POST",
      headers: {
        authkey: config.authKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mobile: toMsg91Mobile(input.phone10),
        template_id: config.templateId,
      }),
    },
    "send"
  );
}

export async function msg91VerifyOtp(input: {
  phone10: string;
  otp: string;
}): Promise<Msg91ApiResult> {
  const config = getMsg91Config();
  if (!config.ok) {
    return { ok: false, kind: "config", error: config.error };
  }

  const url = new URL(`${MSG91_BASE}/verify`);
  url.searchParams.set("mobile", toMsg91Mobile(input.phone10));
  url.searchParams.set("otp", input.otp);

  return fetchMsg91(
    url.toString(),
    {
      method: "GET",
      headers: {
        authkey: config.authKey,
      },
    },
    "verify"
  );
}

export async function msg91RetryOtp(input: {
  phone10: string;
  retrytype?: "text" | "voice";
}): Promise<Msg91ApiResult> {
  const config = getMsg91Config();
  if (!config.ok) {
    return { ok: false, kind: "config", error: config.error };
  }

  const url = new URL(`${MSG91_BASE}/retry`);
  url.searchParams.set("mobile", toMsg91Mobile(input.phone10));
  url.searchParams.set("retrytype", input.retrytype ?? "text");

  return fetchMsg91(
    url.toString(),
    {
      method: "GET",
      headers: {
        authkey: config.authKey,
      },
    },
    "retry"
  );
}
