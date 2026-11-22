import { maskWaId } from "@/lib/server/whatsapp/meta-webhook";
import {
  isWhatsAppOptOutMessage,
  recordWhatsAppOptOut,
} from "@/lib/server/whatsapp/campaign-suppression";
import { isWhatsAppCampaignDryRun } from "@/lib/server/whatsapp/campaign-dry-run";
import { sendWhatsAppText } from "@/lib/server/whatsapp/meta-client";

export async function handleInboundOptOutIfNeeded(input: {
  waId: string;
  text?: string;
}): Promise<boolean> {
  if (!isWhatsAppOptOutMessage(input.text)) {
    return false;
  }

  await recordWhatsAppOptOut({
    waId: input.waId,
    reason: "user_stop",
    source: "whatsapp_inbound",
  });

  console.info("[whatsapp-campaign] opt-out recorded", {
    sender: maskWaId(input.waId),
  });

  if (!isWhatsAppCampaignDryRun()) {
    await sendWhatsAppText({
      to: input.waId,
      text: "You have been unsubscribed from Career Uttsav WhatsApp updates. Reply START only if you wish to register for the event.",
    });
  }

  return true;
}