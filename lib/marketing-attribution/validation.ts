export function parseOptionalISODate(
  value: unknown
): { ok: true; value: Date | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }
  if (typeof value !== "string") {
    return { ok: false, error: "Date must be an ISO string" };
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, error: "Invalid date" };
  }
  return { ok: true, value: parsed };
}

export function validateCampaignDateRange(
  start: Date | null,
  end: Date | null
): string | null {
  if (start && end && end.getTime() < start.getTime()) {
    return "End date must be on or after the start date";
  }
  return null;
}

export function validateEntityName(name: unknown, label: string): string | null {
  if (typeof name !== "string") return `${label} name is required`;
  const trimmed = name.trim();
  if (trimmed.length < 2) return `${label} name must be at least 2 characters`;
  if (trimmed.length > 120) return `${label} name must be at most 120 characters`;
  return null;
}