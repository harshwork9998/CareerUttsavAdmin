import type { WhatsAppBotAction } from "@/lib/server/whatsapp/registration-conversation";

export function buildWhatsAppRegistrationSuccessActions(input: {
  registrationNumber: string;
  qrPngBase64: string;
}): WhatsAppBotAction[] {
  return [
    {
      type: "TEXT",
      body: `✅ Registration Successful!

You're successfully registered for Career Uttsav.

Registration Number:
${input.registrationNumber}

Please keep your QR code handy for entry at the event.`,
    },
    {
      type: "MEDIA",
      mimeType: "image/png",
      filename: "registration-qr.png",
      contentBase64: input.qrPngBase64,
      caption: "Your Career Uttsav entry QR code",
    },
  ];
}

export function buildWhatsAppAlreadyRegisteredActions(input: {
  registrationNumber?: string;
}): WhatsAppBotAction[] {
  const actions: WhatsAppBotAction[] = [
    {
      type: "TEXT",
      body: "You're already registered for Career Uttsav.",
    },
  ];

  if (input.registrationNumber) {
    actions.push({
      type: "TEXT",
      body: `Registration Number:\n${input.registrationNumber}`,
    });
  }

  return actions;
}

export function buildWhatsAppEmailDuplicatePrivacyActions(): WhatsAppBotAction[] {
  return [
    {
      type: "TEXT",
      body: `A registration already exists with this email address.
For privacy, we can't display its registration details here.
If you entered the wrong email, you can start a new registration.`,
    },
  ];
}

export function buildWhatsAppCompletionFailureActions(
  message: string
): WhatsAppBotAction[] {
  return [{ type: "TEXT", body: message }];
}
