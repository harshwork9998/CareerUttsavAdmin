import type { WhatsAppBotAction } from "@/lib/server/whatsapp/registration-conversation";

/**
 * Phase 2 outbound dispatcher — intentionally no network calls.
 * Phase 3+ will route actions to meta-client.
 */
export function dispatchWhatsAppBotActions(
  actions: WhatsAppBotAction[]
): void {
  void actions;
}
