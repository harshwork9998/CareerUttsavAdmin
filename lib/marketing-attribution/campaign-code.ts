const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,31}$/;

export const CAMPAIGN_TRACKING_CODE_MIN_LENGTH = 2;
export const CAMPAIGN_TRACKING_CODE_MAX_LENGTH = 32;

export function normalizeCampaignTrackingCodeInput(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function campaignTrackingCodeKey(value: string): string {
  return normalizeCampaignTrackingCodeInput(value).toLowerCase();
}

export function validateCampaignTrackingCode(value: string): string | null {
  const normalized = normalizeCampaignTrackingCodeInput(value);
  if (normalized.length < CAMPAIGN_TRACKING_CODE_MIN_LENGTH) {
    return `Tracking code must be at least ${CAMPAIGN_TRACKING_CODE_MIN_LENGTH} characters`;
  }
  if (normalized.length > CAMPAIGN_TRACKING_CODE_MAX_LENGTH) {
    return `Tracking code must be at most ${CAMPAIGN_TRACKING_CODE_MAX_LENGTH} characters`;
  }
  if (!CODE_PATTERN.test(normalized)) {
    return "Tracking code may use letters, numbers, hyphens, and underscores (must start with a letter or number)";
  }
  return null;
}

function alphanumericToken(value: string, maxLen: number): string {
  const letters = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!letters) return "";
  return letters.slice(0, maxLen);
}

export function suggestCampaignTrackingCode(
  campaignName: string,
  year = new Date().getFullYear()
): string {
  const parts = campaignName
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let base: string;
  if (parts.length >= 2) {
    base =
      alphanumericToken(parts[0], 3) +
      alphanumericToken(parts[1], 4);
  } else if (parts.length === 1) {
    base = alphanumericToken(parts[0], 6);
  } else {
    base = "CAMP";
  }
  if (!base) base = "CAMP";
  const yearSuffix = String(year).slice(-2);
  const candidate = `${base}${yearSuffix}`.slice(0, CAMPAIGN_TRACKING_CODE_MAX_LENGTH);
  const err = validateCampaignTrackingCode(candidate);
  return err ? "CAMP26" : candidate;
}