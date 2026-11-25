import type { WhatsAppBotAction } from "@/lib/server/whatsapp/registration-conversation";
import { exportWhatsAppFirstName } from "@/lib/server/whatsapp/registration-conversation";
import {
  buildWhatsAppEventVenueLocationAction,
  isWhatsAppEventVenueLocationEnabled,
  WHATSAPP_EVENT_LOCATION_EXPLANATION_BODY,
} from "@/lib/server/whatsapp/whatsapp-event-venue-location";

export const WHATSAPP_REGISTRATION_ENTRY_PASS_FILENAME =
  "career-uttsav-event-pass.png";

export const WHATSAPP_REGISTRATION_SAVE_QR_BODY =
  "📱 Save this QR code. You’ll need it when you arrive.";

export function buildWhatsAppRegistrationPassFollowUpActions(): WhatsAppBotAction[] {
  const actions: WhatsAppBotAction[] = [];
  if (isWhatsAppEventVenueLocationEnabled()) {
    actions.push(
      buildWhatsAppEventVenueLocationAction(),
      {
        type: "TEXT",
        body: WHATSAPP_EVENT_LOCATION_EXPLANATION_BODY,
      }
    );
  }
  actions.push({
    type: "TEXT",
    body: WHATSAPP_REGISTRATION_SAVE_QR_BODY,
  });
  return actions;
}

export function isWhatsAppRegistrationEntryPassMedia(
  action: WhatsAppBotAction
): boolean {
  return (
    action.type === "MEDIA" &&
    action.filename === WHATSAPP_REGISTRATION_ENTRY_PASS_FILENAME
  );
}

export function isWhatsAppRegistrationPassFollowUpAction(
  action: WhatsAppBotAction
): boolean {
  if (isWhatsAppEventVenueLocationEnabled()) {
    if (action.type === "LOCATION") {
      return true;
    }
    if (
      action.type === "TEXT" &&
      action.body === WHATSAPP_EVENT_LOCATION_EXPLANATION_BODY
    ) {
      return true;
    }
  }
  if (
    action.type === "TEXT" &&
    action.body === WHATSAPP_REGISTRATION_SAVE_QR_BODY
  ) {
    return true;
  }
  return false;
}

export function buildWhatsAppSeminarSelectionCompleteActions(
  selectedCount = 3
): WhatsAppBotAction[] {
  if (selectedCount <= 0) {
    return [];
  }

  const countLabel =
    selectedCount === 1
      ? "1 seminar"
      : `${selectedCount} seminars`;

  return [
    {
      type: "TEXT",
      body: `✅ *${countLabel} selected*

Your seminar preferences are saved.`,
    },
  ];
}

export function buildWhatsAppRegistrationSuccessActions(input: {
  registrationNumber: string;
  qrPngBase64: string;
  studentName?: string | null;
  includeSeminarCompleteMessage?: boolean;
  selectedSeminarCount?: number;
}): WhatsAppBotAction[] {
  const actions: WhatsAppBotAction[] = [];
  const firstName = exportWhatsAppFirstName(input.studentName ?? null);

  if (input.includeSeminarCompleteMessage === true) {
    actions.push(
      ...buildWhatsAppSeminarSelectionCompleteActions(input.selectedSeminarCount)
    );
  }

  actions.push(
    {
      type: "TEXT",
      body: `🎉 YOU’RE IN, ${firstName}!

Your Career Uttsav 2026 registration is confirmed.

📅 19–20 December 2026
📍 Palace Grounds, Bengaluru
🎟️ Entry: FREE
Registration ID: ${input.registrationNumber}

And here’s your entry pass 👇`,
    },
    {
      type: "MEDIA",
      mimeType: "image/png",
      filename: WHATSAPP_REGISTRATION_ENTRY_PASS_FILENAME,
      contentBase64: input.qrPngBase64,
      caption: "Your Career Uttsav entry QR code",
    },
    ...buildWhatsAppRegistrationPassFollowUpActions()
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
      body: "You’re already in! 🎉 Your Career Uttsav registration is complete. Here’s your pass again.",
    },
  ];

  if (input.registrationNumber) {
    actions.push({
      type: "TEXT",
      body: `Registration Number:\n${input.registrationNumber}`,
    });
  }

  if (input.qrPngBase64) {
    actions.push(
      {
        type: "MEDIA",
        mimeType: "image/png",
        filename: WHATSAPP_REGISTRATION_ENTRY_PASS_FILENAME,
        contentBase64: input.qrPngBase64,
        caption: "Your Career Uttsav entry QR code",
      },
      ...buildWhatsAppRegistrationPassFollowUpActions()
    );
  }

  return actions;
}

export function buildWhatsAppSameMobileAlreadyRegisteredActions(input: {
  registrationNumber?: string;
  qrPngBase64?: string;
}): WhatsAppBotAction[] {
  return buildWhatsAppAlreadyRegisteredActions(input);
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

export const WHATSAPP_REGISTRATION_FAILURE_MESSAGE = `Something went wrong while creating your pass.
Your details are safe — please try again in a moment.`;