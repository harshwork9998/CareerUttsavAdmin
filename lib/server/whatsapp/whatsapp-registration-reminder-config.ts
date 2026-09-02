export const WHATSAPP_REMINDER_2H_MS = 2 * 60 * 60 * 1000;
export const WHATSAPP_REMINDER_6H_MS = 6 * 60 * 60 * 1000;
export const WHATSAPP_REMINDER_24H_MS = 24 * 60 * 60 * 1000;
export const WHATSAPP_REMINDER_RETRY_THROTTLE_MS = 15 * 60 * 1000;

export function isWhatsAppRegistrationRemindersEnabled(): boolean {
  return (
    process.env.WHATSAPP_REGISTRATION_REMINDERS_ENABLED?.trim().toLowerCase() ===
    "true"
  );
}

export function readWhatsAppRegistrationReminderTemplateConfig(): {
  templateName: string;
  languageCode: string;
} | null {
  const templateName =
    process.env.WHATSAPP_REGISTRATION_REMINDER_TEMPLATE_NAME?.trim();
  if (!templateName) {
    return null;
  }
  const languageCode =
    process.env.WHATSAPP_REGISTRATION_REMINDER_TEMPLATE_LANGUAGE?.trim() ||
    "en_US";
  return { templateName, languageCode };
}
