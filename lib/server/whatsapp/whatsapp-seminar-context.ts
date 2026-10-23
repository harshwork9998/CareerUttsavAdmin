import { CURRENT_EVENT_ID } from "@/lib/current-events";
import { getRegistrationSeminarOptions } from "@/lib/server/registration-seminar-options";
import { getEventForApi } from "@/lib/server/event-service";
import type { SeminarOption } from "@/lib/server/whatsapp/registration-conversation";
import {
  eventArtworkSeminarsToSeminarOptions,
} from "@/lib/server/whatsapp/whatsapp-artwork-seminar-catalog";
import {
  buildWhatsAppSeminarDayCatalog,
  type WhatsAppSeminarDayCatalog,
} from "@/lib/server/whatsapp/whatsapp-seminar-day-catalog";

export async function getWhatsAppSeminarOptions(): Promise<SeminarOption[]> {
  return getRegistrationSeminarOptions();
}

/** Current-event seminars used for WhatsApp artwork picker resolution. */
export async function getWhatsAppEventArtworkSeminarOptions(): Promise<
  SeminarOption[]
> {
  const event = await getEventForApi(CURRENT_EVENT_ID);
  return eventArtworkSeminarsToSeminarOptions(event?.seminars ?? []);
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
