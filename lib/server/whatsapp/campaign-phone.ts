import { normalizeIndianMobileInput } from "@/lib/indian-mobile";

/** Canonical Meta WhatsApp recipient: 91 + 10-digit Indian mobile. */
export function toWhatsAppRecipientWaId(input: unknown): string | null {
  const ten = normalizeIndianMobileInput(input);
  if (!ten) return null;
  return `91${ten}`;
}

export function phoneLast10FromWaId(waId: string): string | null {
  const ten = normalizeIndianMobileInput(waId);
  return ten;
}