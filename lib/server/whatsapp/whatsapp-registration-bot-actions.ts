import type { WhatsAppBotAction } from "@/lib/server/whatsapp/registration-conversation";

export const WHATSAPP_SEMINAR_SELECTION_COMPLETE_MESSAGE =
  "✅ *3 of 3 selected*\n\nYour seminar preferences are saved.";

export function buildWhatsAppSeminarSelectionCompleteActions(): WhatsAppBotAction[] {
  return [
    {
      type: "TEXT",
      body: WHATSAPP_SEMINAR_SELECTION_COMPLETE_MESSAGE,
    },
  ];
}

export function buildWhatsAppRegistrationSuccessActions(input: {
  registrationNumber: string;
  qrPngBase64: string;
  includeSeminarCompleteMessage?: boolean;
}): WhatsAppBotAction[] {
  const actions: WhatsAppBotAction[] = [];

  if (input.includeSeminarCompleteMessage !== false) {
    actions.push(...buildWhatsAppSeminarSelectionCompleteActions());
  }

  actions.push(
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
    }
  );

  return actions;
}

export function buildWhatsAppAlreadyRegisteredActions(input: {
  registrationNumber?: string;
  qrPngBase64?: string;
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

  if (input.qrPngBase64) {
    actions.push({
      type: "MEDIA",
      mimeType: "image/png",
      filename: "registration-qr.png",
      contentBase64: input.qrPngBase64,
      caption: "Your Career Uttsav entry QR code",
    });
  }

  return actions;
}

export function buildWhatsAppSameMobileAlreadyRegisteredActions(input: {
  registrationNumber?: string;
  qrPngBase64?: string;
}): WhatsAppBotAction[] {
  const actions: WhatsAppBotAction[] = [
    {
      type: "TEXT",
      body: "You're already registered for Career Uttsav with this WhatsApp number.",
    },
  ];

  if (input.registrationNumber) {
    actions.push({
      type: "TEXT",
      body: `Registration Number:\n${input.registrationNumber}`,
    });
  }

  if (input.qrPngBase64) {
    actions.push({
      type: "MEDIA",
      mimeType: "image/png",
      filename: "registration-qr.png",
      contentBase64: input.qrPngBase64,
      caption: "Your Career Uttsav entry QR code",
    });
  }

  return actions;
}

export function buildWhatsAppEmailDuplicatePrivacyActions(): WhatsAppBotAction[] {
  return [
    {
      type: "TEXT",
      body: `A registration already exists with this email address.

If you entered the wrong email, send *Hi* to start again with the correct details.`,
    },
  ];
}

export function buildWhatsAppRegistrationConflictActions(): WhatsAppBotAction[] {
  return [
    {
      type: "TEXT",
      body: `We couldn't complete this registration because your WhatsApp number and email are linked to different existing registrations. Please contact support for help.`,
    },
  ];
}

export function buildWhatsAppCompletionFailureActions(
  message: string
): WhatsAppBotAction[] {
  return [{ type: "TEXT", body: message }];
}
