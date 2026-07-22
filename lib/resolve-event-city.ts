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
  if (title.includes("mysore") || title.includes("mysuru")) return "Mysore";
  if (title.includes("hubli") || title.includes("hubballi")) return "Hubli";
  return null;
}
