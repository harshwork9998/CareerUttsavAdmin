import { REGISTRATION_INTERACTIVE_IDS } from "@/lib/server/whatsapp/registration-interactive-ids";
import type {
  WhatsAppBotAction,
  WhatsAppConversationState,
} from "@/lib/server/whatsapp/registration-conversation";

function reminderDisplayName(studentName: string | null): string {
  const trimmed = studentName?.trim();
  if (!trimmed) {
    return "there";
  }
  return trimmed.split(/\s+/)[0] ?? "there";
}

export function buildWhatsAppRegistrationReminder2hActions(
  conversation: WhatsAppConversationState
): WhatsAppBotAction[] {
  const name = reminderDisplayName(conversation.studentName);
  return [
    {
      type: "BUTTONS",
      body: `Hi ${name} 👋

Your Career Uttsav registration is still incomplete.
We've saved your progress.

Continue whenever you're ready.`,
      buttons: [
        {
          id: REGISTRATION_INTERACTIVE_IDS.CONTINUE,
          title: "Continue",
        },
        {
          id: REGISTRATION_INTERACTIVE_IDS.RESTART,
          title: "Start over",
        },
      ],
    },
  ];
}

export function buildWhatsAppRegistrationReminder6hActions(
  conversation: WhatsAppConversationState
): WhatsAppBotAction[] {
  return [
    {
      type: "BUTTONS",
      body: `Just a reminder 👋

Your Career Uttsav registration is still incomplete and your progress is saved.

Would you like to continue?`,
      buttons: [
        {
          id: REGISTRATION_INTERACTIVE_IDS.CONTINUE,
          title: "Continue",
        },
        {
          id: REGISTRATION_INTERACTIVE_IDS.RESTART,
          title: "Start over",
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
          title: "Start over",
        },
      ],
    },
  ];
}
