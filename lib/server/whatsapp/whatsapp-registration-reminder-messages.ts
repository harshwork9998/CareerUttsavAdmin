import { REGISTRATION_INTERACTIVE_IDS } from "@/lib/server/whatsapp/registration-interactive-ids";
import {
  exportWhatsAppFirstName,
  type WhatsAppBotAction,
  type WhatsAppConversationState,
} from "@/lib/server/whatsapp/registration-conversation";

export const WHATSAPP_REMINDER_2H_BUTTON_TITLE = "Continue";
export const WHATSAPP_REMINDER_6H_BUTTON_TITLE = "Get My Free Pass \u2192";

export function buildWhatsAppRegistrationReminder2hActions(
  conversation: WhatsAppConversationState
): WhatsAppBotAction[] {
  const name = exportWhatsAppFirstName(conversation.studentName);
  return [
    {
      type: "BUTTONS",
      body: `Hey ${name} 👋

You were almost there!

I’ve saved your Career Uttsav registration, so you won’t have to start again.

Takes less than a minute to finish.`,
      buttons: [
        {
          id: REGISTRATION_INTERACTIVE_IDS.CONTINUE,
          title: WHATSAPP_REMINDER_2H_BUTTON_TITLE,
        },
        {
          id: REGISTRATION_INTERACTIVE_IDS.RESTART,
          title: "Start Over",
        },
      ],
    },
  ];
}

export function buildWhatsAppRegistrationReminder6hActions(
  _conversation: WhatsAppConversationState
): WhatsAppBotAction[] {
  return [
    {
      type: "BUTTONS",
      body: `Still thinking about it? 👀

Your FREE Career Uttsav pass is waiting.

Universities. Career experts. Seminars. New-age careers. Scholarships — there’s plenty to explore.

And your details are already saved.`,
      buttons: [
        {
          id: REGISTRATION_INTERACTIVE_IDS.CONTINUE,
          title: WHATSAPP_REMINDER_6H_BUTTON_TITLE,
        },
        {
          id: REGISTRATION_INTERACTIVE_IDS.RESTART,
          title: "Start Over",
        },
      ],
    },
  ];
}

export function buildWhatsAppRegistrationReminder12hActions(
  _conversation: WhatsAppConversationState
): WhatsAppBotAction[] {
  return [
    {
      type: "BUTTONS",
      body: `Your Career Uttsav registration is still in progress.

Your details are saved, so you can continue from where you left off.`,
      buttons: [
        {
          id: REGISTRATION_INTERACTIVE_IDS.CONTINUE,
          title: "Continue",
        },
        {
          id: REGISTRATION_INTERACTIVE_IDS.RESTART,
          title: "Start Over",
        },
      ],
    },
  ];
}
