import { isWhatsAppCampaignDryRun } from "@/lib/server/whatsapp/campaign-dry-run";

export function isWhatsAppCampaignLiveSendEnabled(): boolean {
  if (isWhatsAppCampaignDryRun()) return false;
  return process.env.WHATSAPP_CAMPAIGN_ALLOW_LIVE_SEND?.trim() === "true";
}

export function assertWhatsAppCampaignLiveSendAllowed(): void {
  if (isWhatsAppCampaignDryRun()) return;
  if (!isWhatsAppCampaignLiveSendEnabled()) {
    throw new Error(
      "Live WhatsApp campaign sending is not enabled on this server. Use dry-run locally or set server approval for production."
    );
  }
}

export function readCampaignMaxRecipientsPerLaunch(): number {
  const raw = process.env.WHATSAPP_CAMPAIGN_MAX_RECIPIENTS_PER_LAUNCH?.trim();
  if (!raw) return 1_500;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1_500;
  return Math.min(parsed, 10_000);
}