import { mockEvents } from "@/lib/mock-data/events";
import type { Event } from "@/types";

/** Event catalog used to resolve seminar ids → titles on the server. */
export function getEventCatalog(): Event[] {
  return mockEvents;
}
