import { isPhoneSuppressed } from "@/lib/server/whatsapp/campaign-suppression";
import { phoneLast10FromWaId } from "@/lib/server/whatsapp/campaign-phone";

/** Meta customer-service window for session messages (promotional CTA within CSW). */
export const WHATSAPP_CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ChannelInvitePromotionalBlockReason =
  | "suppressed"
  | "customer_service_window_closed"
  | "missing_last_inbound_at"
  | "invalid_wa_id";

export async function channelInvitePromotionalBlockReason(input: {
  waId: string;
  now: Date;
  lastInboundAt: Date | null | undefined;
}): Promise<ChannelInvitePromotionalBlockReason | null> {
  const phoneLast10 = phoneLast10FromWaId(input.waId);
  if (!phoneLast10) {
    return "invalid_wa_id";
  }

  if (await isPhoneSuppressed(phoneLast10)) {
    return "suppressed";
  }

  if (!input.lastInboundAt) {
    return "missing_last_inbound_at";
  }

  const inboundMs = input.lastInboundAt.getTime();
  if (Number.isNaN(inboundMs)) {
    return "missing_last_inbound_at";
  }

  if (input.now.getTime() - inboundMs > WHATSAPP_CUSTOMER_SERVICE_WINDOW_MS) {
    return "customer_service_window_closed";
  }

  return null;
}