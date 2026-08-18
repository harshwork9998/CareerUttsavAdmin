import type { Registration } from "@/types";

/** Resolve conduction city from event id map, with title fallback for legacy rows. */
export function resolveEventCity(
  registration: Registration,
  eventCityById: Map<string, string>
): string | null {
  const fromEvent = eventCityById.get(registration.eventId)?.trim();
  if (fromEvent) {
    return fromEvent;
  }
  const title = registration.eventTitle.toLowerCase();
  if (title.includes("bangalore") || title.includes("bengaluru")) {
    return "Bangalore";
  }
  return null;
}
