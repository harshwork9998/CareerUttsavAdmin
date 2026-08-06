import { createHash, randomBytes, timingSafeEqual } from "crypto";

/**
 * Secret used only to hash opaque phone verification tokens
 * (issued after successful OTP verify). Does not hash MSG91 OTPs.
 *
 * Prefer PHONE_VERIFICATION_TOKEN_SECRET; OTP_HASH_SECRET is accepted
 * temporarily for local/env migration.
 */
function tokenSecret(): string {
  return (
    process.env.PHONE_VERIFICATION_TOKEN_SECRET ??
    process.env.OTP_HASH_SECRET ??
    "career-uttsav-phone-verification-dev-secret"
  );
}

/** Hash a verification token with the server pepper. Never store plaintext tokens. */
export function hashVerificationToken(value: string): string {
  return createHash("sha256")
    .update(`${tokenSecret()}:${value.trim()}`)
    .digest("hex");
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "hex");
    const bufB = Buffer.from(b, "hex");
    if (bufA.length === 0 || bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/** Opaque verification token returned to the client after successful verify. */
export function generateVerificationToken(): string {
  return randomBytes(32).toString("hex");
}
