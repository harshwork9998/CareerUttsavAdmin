export const WHATSAPP_REMINDER_2H_MS = 2 * 60 * 60 * 1000;
export const WHATSAPP_REMINDER_6H_MS = 6 * 60 * 60 * 1000;
export const WHATSAPP_REMINDER_12H_MS = 12 * 60 * 60 * 1000;
export const WHATSAPP_REMINDER_RETRY_THROTTLE_MS = 15 * 60 * 1000;

export function isWhatsAppRegistrationRemindersEnabled(): boolean {
  return (
    process.env.WHATSAPP_REGISTRATION_REMINDERS_ENABLED?.trim().toLowerCase() ===
    "true"
  );
}
