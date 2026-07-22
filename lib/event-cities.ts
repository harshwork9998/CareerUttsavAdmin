import type { Event } from "@/types";

export function normalizeCityKey(city: string): string {
  return city.trim().toLowerCase();
}

export function citiesMatch(a: string, b: string): boolean {
  return normalizeCityKey(a) === normalizeCityKey(b);
}

/** Unique event conduction cities, preserving the first seen display label. */
export function getEventCities(events: Event[]): string[] {
  const byKey = new Map<string, string>();
  for (const event of events) {
    const trimmed = event.city?.trim();
    if (!trimmed) continue;
    const key = normalizeCityKey(trimmed);
    if (!byKey.has(key)) {
      byKey.set(key, trimmed);
    }
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}
