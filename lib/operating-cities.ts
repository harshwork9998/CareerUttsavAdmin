/** Career Uttsav operating cities — partners and events must use one of these. */
export const OPERATING_CITIES = ["Bangalore", "Mysore", "Hubli"] as const;

export type OperatingCity = (typeof OPERATING_CITIES)[number];

export function isOperatingCity(value: string): value is OperatingCity {
  return OPERATING_CITIES.includes(value as OperatingCity);
}

export function assertOperatingCity(value: string): OperatingCity | null {
  return isOperatingCity(value) ? value : null;
}
