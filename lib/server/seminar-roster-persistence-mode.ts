export type SeminarRosterPersistenceMode = "json" | "prisma";

/**
 * Temporary cutover switch. Defaults to JSON when unset.
 * Server-only — never expose via NEXT_PUBLIC_*.
 */
export function getSeminarRosterPersistenceMode(): SeminarRosterPersistenceMode {
  const value = process.env.SEMINAR_ROSTER_PERSISTENCE?.trim().toLowerCase();
  if (value === "prisma") {
    return "prisma";
  }
  return "json";
}

export function isPrismaSeminarRosterPersistence(): boolean {
  return getSeminarRosterPersistenceMode() === "prisma";
}
