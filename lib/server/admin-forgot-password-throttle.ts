type ThrottleEntry = {
  count: number;
  windowStartedAt: number;
};

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 3;

const buckets = new Map<string, ThrottleEntry>();

function pruneExpired(now: number): void {
  for (const [key, entry] of buckets.entries()) {
    if (now - entry.windowStartedAt >= WINDOW_MS) {
      buckets.delete(key);
    }
  }
}

/**
 * Lightweight in-memory throttle for forgot-password abuse protection.
 * Per server instance only — sufficient for this admin app without new deps.
 */
export function shouldThrottleForgotPasswordRequest(input: {
  email: string;
  ip?: string | null;
}): boolean {
  const now = Date.now();
  pruneExpired(now);

  const normalizedEmail = input.email.trim().toLowerCase();
  const ip = input.ip?.trim() || "unknown";
  const key = `${normalizedEmail}|${ip}`;
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStartedAt >= WINDOW_MS) {
    buckets.set(key, { count: 1, windowStartedAt: now });
    return false;
  }

  if (existing.count >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  existing.count += 1;
  buckets.set(key, existing);
  return false;
}

export function resetForgotPasswordThrottleForTests(): void {
  buckets.clear();
}
