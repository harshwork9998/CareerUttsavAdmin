import { normalizeRegistrationPhone } from "@/lib/registration-duplicates";
import { generateId } from "@/lib/utils";
import {
  generateOtpCode,
  generateVerificationToken,
  hashOtpValue,
  timingSafeEqualHex,
} from "@/lib/otp/crypto";
import {
  loadOtpChallenges,
  pruneOtpChallenges,
  saveOtpChallenges,
} from "@/lib/otp/persistence";
import { buildOtpSmsMessage, sendSms } from "@/lib/otp/sms";
import {
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
  /** Dev-only: never returned when SMS_PROVIDER is a real provider. */
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

export function normalizeOtpPhone(phone: unknown): string | null {
  if (typeof phone !== "string") return null;
  const normalized = normalizeRegistrationPhone(phone);
  if (!/^[6-9]\d{9}$/.test(normalized)) return null;
  return normalized;
}

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

/**
 * Send (or resend) an OTP for a phone + purpose.
 * Always generates a new code and invalidates any previous unverified code.
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

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  let challenges = pruneOtpChallenges(loadOtpChallenges());

  const existing = findActiveChallenge(challenges, phone, input.purpose);
  const requestTimestamps = (existing?.requestTimestamps ?? []).filter(
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

  if (existing?.lastSentAt) {
    const elapsed = now - new Date(existing.lastSentAt).getTime();
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

  const code = generateOtpCode(OTP_CONFIG.codeLength);
  const codeHash = hashOtpValue(code);
  const expiresAt = new Date(now + OTP_CONFIG.ttlMs).toISOString();
  const nextTimestamps = [...requestTimestamps, nowIso];

  // Invalidate previous unverified challenges for this phone+purpose
  challenges = challenges.filter(
    (c) => !(c.phone === phone && c.purpose === input.purpose && !c.verifiedAt)
  );

  const challenge: OtpChallenge = {
    id: `otp-${generateId()}`,
    phone,
    purpose: input.purpose,
    codeHash,
    expiresAt,
    attempts: 0,
    requestTimestamps: nextTimestamps,
    lastSentAt: nowIso,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
  };

  challenges.unshift(challenge);
  saveOtpChallenges(challenges);

  const sms = await sendSms({
    to: phone,
    message: buildOtpSmsMessage(code, input.purpose),
  });

  if (!sms.ok) {
    return {
      ok: false,
      status: 502,
      error: sms.error || "Could not send OTP. Please try again.",
    };
  }

  const result: SendOtpSuccess = {
    ok: true,
    message: "OTP sent successfully",
    expiresInSeconds: Math.floor(OTP_CONFIG.ttlMs / 1000),
    resendAfterSeconds: Math.floor(OTP_CONFIG.resendCooldownMs / 1000),
  };

  // Surface code only when using the console provider (local/dev).
  if ((process.env.SMS_PROVIDER ?? "console").toLowerCase() === "console") {
    result.debugCode = code;
  }

  return result;
}

/**
 * Verify an OTP. On success, issues a verification token for gated actions
 * (e.g. student registration submit).
 */
export function verifyOtp(input: {
  phone: string;
  purpose: OtpPurpose;
  code: string;
}): VerifyOtpSuccess | OtpServiceError {
  const phone = normalizeOtpPhone(input.phone);
  if (!phone) {
    return {
      ok: false,
      status: 400,
      error: "Enter a valid 10-digit mobile number starting 6–9",
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

  const expected = challenge.codeHash;
  const actual = hashOtpValue(code);
  const matches = timingSafeEqualHex(expected, actual);

  if (!matches) {
    challenge.attempts += 1;
    challenge.updatedAt = nowIso;
    challenges = challenges.map((c) =>
      c.id === challenge.id ? challenge : c
    );
    saveOtpChallenges(challenges);

    const remaining = OTP_CONFIG.maxVerifyAttempts - challenge.attempts;
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
  challenge.verificationTokenHash = hashOtpValue(verificationToken);
  challenge.verificationTokenExpiresAt = new Date(
    now + OTP_CONFIG.verificationTokenTtlMs
  ).toISOString();
  challenge.updatedAt = nowIso;
  // Invalidate the OTP code hash so it cannot be reused
  challenge.codeHash = hashOtpValue(`used:${challenge.id}:${nowIso}`);

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

  if (!challenge?.verificationTokenHash || !challenge.verificationTokenExpiresAt) {
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
    hashOtpValue(token)
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
