import { CURRENT_EVENT_ID } from "@/lib/current-events";
import { getRegistrationSeminarOptions } from "@/lib/server/registration-seminar-options";
import { getEventForApi } from "@/lib/server/event-service";
import type { SeminarOption } from "@/lib/server/whatsapp/registration-conversation";
import {
  buildWhatsAppSeminarDayCatalog,
  type WhatsAppSeminarDayCatalog,
} from "@/lib/server/whatsapp/whatsapp-seminar-day-catalog";

export async function getWhatsAppSeminarOptions(): Promise<SeminarOption[]> {
  return getRegistrationSeminarOptions();
}

export async function getWhatsAppSeminarDayCatalog(): Promise<WhatsAppSeminarDayCatalog> {
  const [event, options] = await Promise.all([
    getEventForApi(CURRENT_EVENT_ID),
    getRegistrationSeminarOptions(),
  ]);

  return buildWhatsAppSeminarDayCatalog(
    options,
    event?.startDate,
    event?.endDate
  );
}
