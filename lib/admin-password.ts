import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;
const SCRYPT_PREFIX = "scrypt";

/** One-way hash for Admin user passwords (salted scrypt). */
export function hashAdminPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${SCRYPT_PREFIX}$${salt}$${hash}`;
}

export function isAdminPasswordHash(value: string | undefined): boolean {
  if (!value) return false;
  const parts = value.split("$");
  return (
    parts.length === 3 &&
    parts[0] === SCRYPT_PREFIX &&
    Boolean(parts[1] && parts[2])
  );
}

/** Verify a password against a stored scrypt hash. */
export function verifyAdminPassword(
  password: string,
  storedHash: string | undefined
): boolean {
  if (!storedHash || !isAdminPasswordHash(storedHash)) {
    return false;
  }

  const [, salt, expectedHex] = storedHash.split("$");
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
