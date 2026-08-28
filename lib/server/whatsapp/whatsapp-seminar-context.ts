import { getRegistrationSeminarOptions } from "@/lib/server/registration-seminar-options";
import type { SeminarOption } from "@/lib/server/whatsapp/registration-conversation";

export async function getWhatsAppSeminarOptions(): Promise<SeminarOption[]> {
  return getRegistrationSeminarOptions();
}
