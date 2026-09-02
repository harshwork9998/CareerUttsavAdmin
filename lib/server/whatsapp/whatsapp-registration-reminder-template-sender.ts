import { sendWhatsAppTemplate } from "@/lib/server/whatsapp/meta-client";
import type { WhatsAppConversationState } from "@/lib/server/whatsapp/registration-conversation";
import { readWhatsAppRegistrationReminderTemplateConfig } from "@/lib/server/whatsapp/whatsapp-registration-reminder-config";

export type WhatsAppRegistrationReminderTemplateSendResult = {
  success: boolean;
  errorCode?: string;
};

function reminderTemplateDisplayName(studentName: string | null): string {
  const trimmed = studentName?.trim();
  if (!trimmed) {
    return "there";
  }
  return trimmed.split(/\s+/)[0] ?? "there";
}

export async function sendWhatsAppRegistrationReminder24hTemplate(
  to: string,
  conversation: WhatsAppConversationState
): Promise<WhatsAppRegistrationReminderTemplateSendResult> {
  const templateConfig = readWhatsAppRegistrationReminderTemplateConfig();
  if (!templateConfig) {
    return {
      success: false,
      errorCode: "WHATSAPP_REMINDER_TEMPLATE_NOT_CONFIGURED",
    };
  }

  const result = await sendWhatsAppTemplate({
    to,
    templateName: templateConfig.templateName,
    languageCode: templateConfig.languageCode,
    bodyParameters: [reminderTemplateDisplayName(conversation.studentName)],
  });

  if (!result.success) {
    return {
      success: false,
      errorCode: result.errorCode,
    };
  }

  return { success: true };
}
