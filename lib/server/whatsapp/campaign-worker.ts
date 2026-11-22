import { WHATSAPP_CAMPAIGN_POLL_MS } from "@/lib/server/whatsapp/campaign-config";
import { processWhatsAppCampaignSends } from "@/lib/server/whatsapp/campaign-processor";

let poller: ReturnType<typeof setInterval> | null = null;

export function startWhatsAppCampaignWorker(): void {
  if (poller) return;
  poller = setInterval(() => {
    void processWhatsAppCampaignSends().catch((error: unknown) => {
      console.error(
        "[whatsapp-campaign] poll failed",
        error instanceof Error ? error.message : "unknown"
      );
    });
  }, WHATSAPP_CAMPAIGN_POLL_MS);
  poller.unref?.();
}

export function stopWhatsAppCampaignWorkerForTests(): void {
  if (!poller) return;
  clearInterval(poller);
  poller = null;
}