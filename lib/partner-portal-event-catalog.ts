import type { Event } from "@/types";

/** Slim event catalog shape consumed by the Partner Portal. */
export type PartnerPortalEventCatalogItem = {
  id: string;
  title: string;
  city: string;
  startDate: string;
  endDate: string;
  seminars: Array<{
    id: string;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    hall: number;
  }>;
};

export function toPartnerPortalEventCatalog(
  events: Event[]
): PartnerPortalEventCatalogItem[] {
  return events.map((event) => ({
    id: event.id,
    title: event.title,
    city: event.city,
    startDate: event.startDate,
    endDate: event.endDate,
    seminars: (event.seminars ?? []).map((seminar) => ({
      id: seminar.id,
      title: seminar.title,
      date: seminar.date,
      startTime: seminar.startTime,
      endTime: seminar.endTime,
      hall: seminar.hall,
    })),
  }));
}
