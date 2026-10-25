/** Minimum ms between processing the same QR payload (client-side guard). */
export const CHECK_IN_SAME_PAYLOAD_DEBOUNCE_MS = 2500;

export function normalizeCheckInQrPayload(raw: string): string {
  return raw.trim();
}

export function shouldIgnoreDuplicatePayload(
  lastPayload: string | null,
  lastProcessedAt: number | null,
  payload: string,
  now: number = Date.now()
): boolean {
  if (!lastPayload || lastProcessedAt === null) return false;
  if (lastPayload !== payload) return false;
  return now - lastProcessedAt < CHECK_IN_SAME_PAYLOAD_DEBOUNCE_MS;
}

export function countEventCheckIns(
  registrations: ReadonlyArray<{ status: string }>
): number {
  return registrations.filter((r) => r.status === "Checked In").length;
}

export function eventCheckInStats(
  registrations: ReadonlyArray<{ status: string }>
): { total: number; checkedIn: number; remaining: number } {
  const total = registrations.length;
  const checkedIn = countEventCheckIns(registrations);
  return {
    total,
    checkedIn,
    remaining: Math.max(0, total - checkedIn),
  };
}
