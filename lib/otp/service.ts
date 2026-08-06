import { generateId } from "@/lib/utils";
import {
  generateVerificationToken,
  hashVerificationToken,
  timingSafeEqualHex,
} from "@/lib/otp/crypto";
import {
  msg91RetryOtp,
  msg91SendOtp,
  msg91VerifyOtp,
  type Msg91ApiResult,
} from "@/lib/otp/msg91";
import { normalizeOtpPhone } from "@/lib/otp/phone";
import {
  loadOtpChallenges,
  pruneOtpChallenges,
  saveOtpChallenges,
} from "@/lib/otp/persistence";
import { resolveOtpProvider } from "@/lib/otp/provider";
import {
  MOCK_OTP_CODE,
  OTP_CONFIG,
  OTP_PURPOSES,
  type OtpChallenge,
  type OtpPurpose,
} from "@/lib/otp/types";

export type OtpServiceError = {
  ok: false;
  error: string;
  status: number;
  retryAfterSeconds?: number;
};

export type SendOtpSuccess = {
  ok: true;
  message: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
  /** Present only for OTP_PROVIDER=mock (never in production). */
  debugCode?: string;
};

export type VerifyOtpSuccess = {
  ok: true;
  message: string;
  verificationToken: string;
  phone: string;
  purpose: OtpPurpose;
};

function isOtpPurpose(value: unknown): value is OtpPurpose {
  return (
    typeof value === "string" &&
    (OTP_PURPOSES as readonly string[]).includes(value)
  );
}

export function parseOtpPurpose(value: unknown): OtpPurpose | null {
  if (!isOtpPurpose(value)) return null;
  return value;
}

export { normalizeOtpPhone };

function findActiveChallenge(
  challenges: OtpChallenge[],
  phone: string,
  purpose: OtpPurpose
): OtpChallenge | undefined {
  return challenges
    .filter((c) => c.phone === phone && c.purpose === purpose && !c.verifiedAt)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];
}

async function mockSend(): Promise<Msg91ApiResult> {
  return { ok: true, type: "success", message: "mock_otp_sent", raw: { type: "success" } };
}

async function mockRetry(): Promise<Msg91ApiResult> {
  return {
    ok: true,
    type: "success",
    message: "mock_otp_resent",
    raw: { type: "success" },
  };
}

async function mockVerify(otp: string): Promise<Msg91ApiResult> {
  if (otp === MOCK_OTP_CODE) {
    return {
      ok: true,
      type: "success",
      message: "mock_otp_verified",
      raw: { type: "success" },
    };
  }
  return {
    ok: false,
    kind: "provider",
    type: "error",
    message: "invalid_otp",
    error: "Incorrect OTP. Please try again.",
  };
}

/**
 * Send a new OTP, or resend the same active OTP via MSG91 retry when a
 * non-expired challenge already exists.
 */
export async function sendOtp(input: {
  phone: string;
  purpose: OtpPurpose;
}): Promise<SendOtpSuccess | OtpServiceError> {
  const phone = normalizeOtpPhone(input.phone);
  if (!phone) {
    return {
      ok: false,
      status: 400,
      error: "Enter a valid 10-digit mobile number starting 6–9",
    };
  }

  const providerResult = resolveOtpProvider();
  if (!providerResult.ok) {
    return {
      ok: false,
      status: providerResult.status,
      error: providerResult.error,
    };
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  let challenges = pruneOtpChallenges(loadOtpChallenges());

  const existing = findActiveChallenge(challenges, phone, input.purpose);
  const existingValid =
    existing && new Date(existing.expiresAt).getTime() > now
      ? existing
      : undefined;

  const requestTimestamps = (existingValid?.requestTimestamps ?? []).filter(
    (ts) => new Date(ts).getTime() >= now - OTP_CONFIG.requestWindowMs
  );

  if (requestTimestamps.length >= OTP_CONFIG.maxRequests) {
    const oldest = Math.min(
      ...requestTimestamps.map((ts) => new Date(ts).getTime())
    );
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + OTP_CONFIG.requestWindowMs - now) / 1000)
    );
    return {
      ok: false,
      status: 429,
      error: `Too many OTP requests. Try again in ${retryAfterSeconds} seconds.`,
      retryAfterSeconds,
    };
  }

  if (existingValid?.lastSentAt) {
    const elapsed = now - new Date(existingValid.lastSentAt).getTime();
    if (elapsed < OTP_CONFIG.resendCooldownMs) {
      const retryAfterSeconds = Math.ceil(
        (OTP_CONFIG.resendCooldownMs - elapsed) / 1000
      );
      return {
        ok: false,
        status: 429,
        error: `Please wait ${retryAfterSeconds} seconds before requesting another OTP.`,
        retryAfterSeconds,
      };
    }
  }

  const isResend = Boolean(existingValid);
  let providerResponse: Msg91ApiResult;

  if (providerResult.provider === "mock") {
    providerResponse = isResend ? await mockRetry() : await mockSend();
  } else if (isResend) {
    providerResponse = await msg91RetryOtp({ phone10: phone, retrytype: "text" });
  } else {
    providerResponse = await msg91SendOtp({ phone10: phone });
  }

  if (!providerResponse.ok) {
    const status =
      providerResponse.kind === "config"
        ? 503
        : providerResponse.kind === "timeout" ||
            providerResponse.kind === "network"
          ? 504
          : 502;
    return {
      ok: false,
      status,
      error: providerResponse.error,
    };
  }

  const expiresAt = new Date(now + OTP_CONFIG.ttlMs).toISOString();
  const nextTimestamps = [...requestTimestamps, nowIso];

  if (existingValid) {
    existingValid.requestTimestamps = nextTimestamps;
    existingValid.lastSentAt = nowIso;
    existingValid.updatedAt = nowIso;
    // Keep original expiresAt so retry continues the same OTP window
    challenges = challenges.map((c) =>
      c.id === existingValid.id ? existingValid : c
    );
  } else {
    challenges = challenges.filter(
      (c) =>
        !(c.phone === phone && c.purpose === input.purpose && !c.verifiedAt)
    );
    const challenge: OtpChallenge = {
      id: `otp-${generateId()}`,
      phone,
      purpose: input.purpose,
      expiresAt,
      attempts: 0,
      requestTimestamps: nextTimestamps,
      lastSentAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    challenges.unshift(challenge);
  }

  saveOtpChallenges(challenges);

  const result: SendOtpSuccess = {
    ok: true,
    message: isResend ? "OTP resent successfully" : "OTP sent successfully",
    expiresInSeconds: Math.floor(OTP_CONFIG.ttlMs / 1000),
    resendAfterSeconds: Math.floor(OTP_CONFIG.resendCooldownMs / 1000),
  };

  if (providerResult.provider === "mock") {
    result.debugCode = MOCK_OTP_CODE;
  }

  return result;
}

/**
 * Verify an OTP via MSG91 (or mock). On success, issues a verification token
 * for gated actions (e.g. student registration submit).
 */
export async function verifyOtp(input: {
  phone: string;
  purpose: OtpPurpose;
  code: string;
}): Promise<VerifyOtpSuccess | OtpServiceError> {
  const phone = normalizeOtpPhone(input.phone);
  if (!phone) {
    return {
      ok: false,
      status: 400,
      error: "Enter a valid 10-digit mobile number starting 6–9",
    };
  }

  const providerResult = resolveOtpProvider();
  if (!providerResult.ok) {
    return {
      ok: false,
      status: providerResult.status,
      error: providerResult.error,
    };
  }

  const code = String(input.code ?? "").replace(/\D/g, "");
  if (code.length !== OTP_CONFIG.codeLength) {
    return {
      ok: false,
      status: 400,
      error: `Enter the ${OTP_CONFIG.codeLength}-digit OTP`,
    };
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  let challenges = pruneOtpChallenges(loadOtpChallenges());
  const challenge = findActiveChallenge(challenges, phone, input.purpose);

  if (!challenge) {
    return {
      ok: false,
      status: 400,
      error: "No active OTP found. Please request a new code.",
    };
  }

  if (new Date(challenge.expiresAt).getTime() <= now) {
    return {
      ok: false,
      status: 400,
      error: "OTP has expired. Please request a new code.",
    };
  }

  if (challenge.attempts >= OTP_CONFIG.maxVerifyAttempts) {
    return {
      ok: false,
      status: 429,
      error: "Too many incorrect attempts. Please request a new OTP.",
    };
  }

  const providerResponse =
    providerResult.provider === "mock"
      ? await mockVerify(code)
      : await msg91VerifyOtp({ phone10: phone, otp: code });

  if (!providerResponse.ok) {
    if (providerResponse.kind === "config") {
      return { ok: false, status: 503, error: providerResponse.error };
    }
    if (
      providerResponse.kind === "timeout" ||
      providerResponse.kind === "network"
    ) {
      return { ok: false, status: 504, error: providerResponse.error };
    }

    challenge.attempts += 1;
    challenge.updatedAt = nowIso;
    challenges = challenges.map((c) =>
      c.id === challenge.id ? challenge : c
    );
    saveOtpChallenges(challenges);

    const remaining = OTP_CONFIG.maxVerifyAttempts - challenge.attempts;
    const expired =
      providerResponse.error.toLowerCase().includes("expired") ||
      (providerResponse.message ?? "").toLowerCase().includes("expir");

    if (expired) {
      return {
        ok: false,
        status: 400,
        error: "OTP has expired. Please request a new code.",
      };
    }

    return {
      ok: false,
      status: 400,
      error:
        remaining > 0
          ? `Incorrect OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
          : "Too many incorrect attempts. Please request a new OTP.",
    };
  }

  const verificationToken = generateVerificationToken();
  challenge.verifiedAt = nowIso;
  challenge.verificationTokenHash = hashVerificationToken(verificationToken);
  challenge.verificationTokenExpiresAt = new Date(
    now + OTP_CONFIG.verificationTokenTtlMs
  ).toISOString();
  challenge.updatedAt = nowIso;

  challenges = challenges.map((c) => (c.id === challenge.id ? challenge : c));
  saveOtpChallenges(challenges);

  return {
    ok: true,
    message: "Mobile number verified",
    verificationToken,
    phone,
    purpose: input.purpose,
  };
}

/**
 * Confirm a verification token for a phone + purpose (e.g. before creating
 * a student registration). Optionally consume the token (single-use).
 */
export function consumePhoneVerification(input: {
  phone: string;
  purpose: OtpPurpose;
  verificationToken: string;
  consume?: boolean;
}): { ok: true } | OtpServiceError {
  const phone = normalizeOtpPhone(input.phone);
  if (!phone) {
    return {
      ok: false,
      status: 400,
      error: "Mobile number is invalid",
    };
  }

  const token = String(input.verificationToken ?? "").trim();
  if (!token) {
    return {
      ok: false,
      status: 400,
      error: "Please verify your mobile number with OTP before continuing.",
    };
  }

  const now = Date.now();
  let challenges = pruneOtpChallenges(loadOtpChallenges());
  const challenge = challenges.find(
    (c) =>
      c.phone === phone &&
      c.purpose === input.purpose &&
      c.verifiedAt &&
      c.verificationTokenHash
  );

  if (
    !challenge?.verificationTokenHash ||
    !challenge.verificationTokenExpiresAt
  ) {
    return {
      ok: false,
      status: 400,
      error: "Please verify your mobile number with OTP before continuing.",
    };
  }

  if (new Date(challenge.verificationTokenExpiresAt).getTime() <= now) {
    return {
      ok: false,
      status: 400,
      error: "Mobile verification expired. Please verify again.",
    };
  }

  const matches = timingSafeEqualHex(
    challenge.verificationTokenHash,
    hashVerificationToken(token)
  );
  if (!matches) {
    return {
      ok: false,
      status: 400,
      error: "Mobile verification is invalid. Please verify again.",
    };
  }

  if (input.consume !== false) {
    challenge.verificationTokenHash = undefined;
    challenge.verificationTokenExpiresAt = undefined;
    challenge.updatedAt = new Date().toISOString();
    challenges = challenges.map((c) =>
      c.id === challenge.id ? challenge : c
    );
    saveOtpChallenges(challenges);
  }

  return { ok: true };
}
