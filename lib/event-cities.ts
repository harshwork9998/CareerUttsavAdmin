import type { Event } from "@/types";

export function normalizeCityKey(city: string): string {
  return city.trim().toLowerCase();
}

export function citiesMatch(a: string, b: string): boolean {
  return normalizeCityKey(a) === normalizeCityKey(b);
}

/** Unique event conduction cities in events list order (first seen label wins). */
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
  return [...byKey.values()];
}

export function formatEventCitiesList(
  cities: string[],
  separator = " · "
): string {
  const unique = cities.map((city) => city.trim()).filter(Boolean);
  if (unique.length === 0) return "No events yet";
  return unique.join(separator);
}

/** e.g. "Bangalore, Mysore & Hubli" */
export function formatEventCitiesDescription(cities: string[]): string {
  const unique = cities.map((city) => city.trim()).filter(Boolean);
  if (unique.length === 0) return "your cities";
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} & ${unique[1]}`;
  return `${unique.slice(0, -1).join(", ")} & ${unique[unique.length - 1]}`;
}
