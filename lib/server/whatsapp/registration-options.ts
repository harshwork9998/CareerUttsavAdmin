export {
  REGISTRATION_BOARD_OPTIONS,
  REGISTRATION_CLASS_OPTIONS,
  REGISTRATION_STREAM_OPTIONS,
  canonicalizeClassLabel,
  MAX_SEMINAR_INTERESTS,
} from "@/lib/registration-validation";

/** WhatsApp chatbot exposes only Male and Female (not Other). */
export const WHATSAPP_GENDER_OPTIONS = ["Male", "Female"] as const;

export type WhatsAppGenderOption = (typeof WHATSAPP_GENDER_OPTIONS)[number];

export function isWhatsAppGenderOption(
  value: string
): value is WhatsAppGenderOption {
  return (WHATSAPP_GENDER_OPTIONS as readonly string[]).includes(value);
}
