const WINDOW_MS = 15 * 60 * 1000;
const LIMIT = 5;

const globalStore = globalThis as unknown as {
  __cuPartnerLoginFailures?: Map<string, number[]>;
};

function buckets(): Map<string, number[]> {
  if (!globalStore.__cuPartnerLoginFailures) {
    globalStore.__cuPartnerLoginFailures = new Map();
  }
  return globalStore.__cuPartnerLoginFailures;
}

function recentFailures(key: string, now: number): number[] {
  return (buckets().get(key) ?? []).filter((timestamp) => now - timestamp < WINDOW_MS);
}

export function partnerLoginRateLimitKey(ip: string, login: string): string {
  const normalizedIp = ip.trim() || "unknown";
  const normalizedLogin = login.trim().toLowerCase();
  return `${normalizedIp}:${normalizedLogin}`;
}

export function isPartnerLoginRateLimited(key: string, now = Date.now()): boolean {
  const recent = recentFailures(key, now);
  buckets().set(key, recent);
  return recent.length >= LIMIT;
}

export function recordPartnerLoginFailure(key: string, now = Date.now()): void {
  const recent = recentFailures(key, now);
  if (recent.length >= LIMIT) {
    buckets().set(key, recent);
    return;
  }
  recent.push(now);
  buckets().set(key, recent);
}

export function clearPartnerLoginFailures(key: string): void {
  buckets().delete(key);
}

export function resetPartnerLoginRateLimits(): void {
  buckets().clear();
}

export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
