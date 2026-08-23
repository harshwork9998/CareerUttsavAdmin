import { CURRENT_EVENT_ID } from "@/lib/current-events";
import { getEventForApi } from "@/lib/server/event-service";
import type { SeminarOption } from "@/lib/server/whatsapp/registration-conversation";

export async function getWhatsAppSeminarOptions(): Promise<SeminarOption[]> {
  const event = await getEventForApi(CURRENT_EVENT_ID);
  if (!event) {
    return [];
  }

  return (event.seminars ?? [])
    .filter((seminar) => seminar.id && seminar.title?.trim())
    .map((seminar) => ({
      id: seminar.id,
      title: seminar.title.trim(),
    }));
}
