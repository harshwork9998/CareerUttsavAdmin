import type { Event } from "@/types";

/** Sole current Career Uttsav operational event (Bangalore 2026). */
export const CURRENT_EVENT_ID = "evt-001";

/** City for the current operational event. */
export const CURRENT_EVENT_CITY = "Bangalore";

/**
 * Current events for Admin create/select UX.
 * Returns only evt-001 when present — never falls back to Mysore/Hubli.
 * Does not mutate the input array; historical events remain in the catalog.
 */
export function getCurrentEvents(events: Event[]): Event[] {
  const current = events.find((event) => event.id === CURRENT_EVENT_ID);
  return current ? [current] : [];
}

/**
 * Resolve the single current event from a catalog, or null if missing.
 */
export function getCurrentEvent(events: Event[]): Event | null {
  return events.find((event) => event.id === CURRENT_EVENT_ID) ?? null;
}
