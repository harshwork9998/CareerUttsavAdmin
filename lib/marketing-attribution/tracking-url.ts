const DEFAULT_PUBLIC_ORIGIN = "https://careeruttsav.in";

export function getMarketingTrackingSiteOrigin(): string {
  const fromEnv =
    process.env.MARKETING_TRACKING_SITE_URL?.trim() ||
    process.env.PUBLIC_SITE_ORIGIN?.trim() ||
    "";
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  return DEFAULT_PUBLIC_ORIGIN;
}

export function buildCampaignTrackingUrl(trackingCode: string): string {
  const origin = getMarketingTrackingSiteOrigin();
  const code = encodeURIComponent(trackingCode.trim());
  return `${origin}/?ref=${code}`;
}