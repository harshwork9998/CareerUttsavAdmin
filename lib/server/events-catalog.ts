import { loadEvents } from "@/lib/server/events-persistence";
import type { Event } from "@/types";

/** Event catalog used to resolve seminar ids → titles on the server. */
export function getEventCatalog(): Event[] {
  return loadEvents();
}
