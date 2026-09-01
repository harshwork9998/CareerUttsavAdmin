/** Extensible OTP purposes — registration now; login / password-reset later. */
export type OtpPurpose =
  | "student_registration"
  | "login"
  | "password_reset";

/**
 * Local challenge metadata for rate limiting and post-verify tokens.
 * MSG91 owns OTP generation/verification — never store OTP codes here.
 */
export type OtpChallenge = {
  id: string;
  phone: string;
  purpose: OtpPurpose;
  expiresAt: string;
  /** Failed verify attempts for the current challenge. */
  attempts: number;
  /** Timestamps of OTP send/resend requests (for rate limiting). */
  requestTimestamps: string[];
  lastSentAt: string;
  verifiedAt?: string;
  /** Hash of the one-time verification token issued after successful verify. */
  verificationTokenHash?: string;
  verificationTokenExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
};

export const OTP_PURPOSES: OtpPurpose[] = [
  "student_registration",
  "login",
  "password_reset",
];

export const OTP_CONFIG = {
  codeLength: 4,
  /** OTP validity window (local tracking; MSG91 also enforces expiry). */
  ttlMs: 5 * 60 * 1000,
  /** Max wrong verify attempts per active challenge. */
  maxVerifyAttempts: 5,
  /** Max send/resend requests within the rate window. */
  maxRequests: 3,
  /** Window for counting send requests. */
  requestWindowMs: 15 * 60 * 1000,
  /** Minimum gap between sends/resends. */
  resendCooldownMs: 60 * 1000,
  /** How long a verification token remains valid for registration submit. */
  verificationTokenTtlMs: 30 * 60 * 1000,
} as const;

/**
 * Fixed OTP for OTP_PROVIDER=mock only (local development).
 * Never used when MSG91 is active. Never allowed in production.
 */
export const MOCK_OTP_CODE = "1234";
