import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;
const SCRYPT_PREFIX = "scrypt";

/** One-way hash for partner portal passwords (salted scrypt). */
export function hashPartnerPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${SCRYPT_PREFIX}$${salt}$${hash}`;
}

export function isPartnerPasswordHash(value: string | undefined): boolean {
  if (!value) return false;
  const parts = value.split("$");
  return parts.length === 3 && parts[0] === SCRYPT_PREFIX && Boolean(parts[1] && parts[2]);
}

/** Verify a password against a stored scrypt hash (or legacy plaintext). */
export function verifyPartnerPassword(
  password: string,
  stored: string | undefined
): boolean {
  if (!stored) return false;

  if (!isPartnerPasswordHash(stored)) {
    // Legacy plaintext rows — exact match only until migrated.
    return stored === password;
  }

  const [, salt, expectedHex] = stored.split("$");
  if (!salt || !expectedHex) return false;

  try {
    const actual = scryptSync(password, salt, KEY_LENGTH);
    const expected = Buffer.from(expectedHex, "hex");
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
