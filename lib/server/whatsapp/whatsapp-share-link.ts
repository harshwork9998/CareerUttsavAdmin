const WHATSAPP_EDITABLE_SHARE_ENDPOINT = "https://api.whatsapp.com/send";

/**
 * Opens WhatsApp with pre-filled text and no recipient.
 * The student chooses who receives it, and can edit the text before sending.
 */
export function buildEditableWhatsAppShareUrl(text: string): string {
  return `${WHATSAPP_EDITABLE_SHARE_ENDPOINT}?text=${encodeURIComponent(text)}`;
}

export function editableWhatsAppShareHasFixedRecipient(url: string): boolean {
  const parsed = new URL(url);
  if (parsed.searchParams.has("phone")) return true;
  if (parsed.hostname === "wa.me") {
    return parsed.pathname.replace(/\//g, "").length > 0;
  }
  return false;
}
