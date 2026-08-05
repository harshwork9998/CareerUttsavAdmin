import { createHash, randomInt, randomBytes } from "crypto";

function hashPepper(): string {
  return process.env.OTP_HASH_SECRET ?? "career-uttsav-otp-dev-secret";
}

/** Hash a value with the server pepper. Used for OTP codes and verification tokens. */
export function hashOtpValue(value: string): string {
  return createHash("sha256")
    .update(`${hashPepper()}:${value.trim()}`)
    .digest("hex");
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Cryptographically strong 6-digit OTP (000000–999999, zero-padded). */
export function generateOtpCode(length = 6): string {
  const max = 10 ** length;
  return String(randomInt(0, max)).padStart(length, "0");
}

/** Opaque verification token returned to the client after successful verify. */
export function generateVerificationToken(): string {
  return randomBytes(32).toString("hex");
}
