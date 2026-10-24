const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

export function followUpDialogNextShowStorageKey(adminUserId: string): string {
  return `cu-partner-followups-next-show-${adminUserId}`;
}

function storage(): Storage | null {
  if (typeof globalThis.localStorage === "undefined") return null;
  return globalThis.localStorage;
}

export function readFollowUpDialogNextShowAt(
  adminUserId: string
): number | null {
  const store = storage();
  if (!store) return null;
  const raw = store.getItem(followUpDialogNextShowStorageKey(adminUserId));
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function markFollowUpDialogDismissed(
  adminUserId: string,
  now: Date = new Date()
): void {
  const store = storage();
  if (!store) return;
  const nextShowAt = now.getTime() + THREE_HOURS_MS;
  store.setItem(
    followUpDialogNextShowStorageKey(adminUserId),
    String(nextShowAt)
  );
}

export function canShowFollowUpDialog(
  adminUserId: string,
  now: Date = new Date()
): boolean {
  const nextShowAt = readFollowUpDialogNextShowAt(adminUserId);
  if (nextShowAt === null) return true;
  return now.getTime() >= nextShowAt;
}
