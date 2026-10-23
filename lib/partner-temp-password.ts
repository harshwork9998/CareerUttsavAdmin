import { randomBytes } from "crypto";

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%&*?";
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

const TEMP_PASSWORD_LENGTH = 12;

function randomIndex(size: number): number {
  if (size <= 0) return 0;
  const limit = Math.floor(0x1_0000_0000 / size) * size;
  let value = 0;
  do {
    value = randomBytes(4).readUInt32BE(0);
  } while (value >= limit);
  return value % size;
}

function pick(alphabet: string): string {
  return alphabet[randomIndex(alphabet.length)] ?? "";
}

function shuffle(chars: string[]): string[] {
  const next = [...chars];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    const current = next[i];
    next[i] = next[j] ?? current;
    next[j] = current;
  }
  return next;
}

/** Cryptographically random temporary password. Not logged and not stored. */
export function generateTemporaryPassword(
  length = TEMP_PASSWORD_LENGTH
): string {
  const size = Math.max(TEMP_PASSWORD_LENGTH, length);
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < size) {
    chars.push(pick(ALL));
  }
  return shuffle(chars).join("");
}
