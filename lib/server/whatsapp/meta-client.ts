export type SendWhatsAppTextInput = {
  to: string;
  text: string;
};

export type SendWhatsAppTextResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string };

function getWhatsAppAccessToken(): string | null {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  return token || null;
}

function getWhatsAppPhoneNumberId(): string | null {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  return phoneNumberId || null;
}

/**
 * Future outbound WhatsApp Cloud API sender.
 * Not called by the webhook route in Phase 1.
 */
export async function sendWhatsAppText(
  input: SendWhatsAppTextInput
): Promise<SendWhatsAppTextResult> {
  const accessToken = getWhatsAppAccessToken();
  const phoneNumberId = getWhatsAppPhoneNumberId();

  if (!accessToken || !phoneNumberId) {
    return {
      ok: false,
      error: "WhatsApp outbound messaging is not configured",
    };
  }

  void input;
  void accessToken;
  void phoneNumberId;

  return {
    ok: false,
    error: "WhatsApp outbound messaging is not implemented",
  };
}
