export const WHATSAPP_CAMPAIGN_POLL_MS = 3_000;
export const WHATSAPP_CAMPAIGN_CLAIM_LEASE_MS = 60_000;
export const WHATSAPP_CAMPAIGN_MAX_SEND_ATTEMPTS = 3;
export const WHATSAPP_CAMPAIGN_UNKNOWN_AFTER_MS = 48 * 60 * 60 * 1000;

export function readCampaignDefaultSendDelayMs(): number {
  const raw = process.env.WHATSAPP_CAMPAIGN_SEND_DELAY_MS?.trim();
  if (!raw) return 400;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 50) return 400;
  return parsed;
}

export function readCampaignDefaultBatchSize(): number {
  const raw = process.env.WHATSAPP_CAMPAIGN_BATCH_SIZE?.trim();
  if (!raw) return 25;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 25;
  return Math.min(parsed, 100);
}