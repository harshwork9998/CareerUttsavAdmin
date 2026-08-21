export type PartnerPersistenceMode = "json" | "prisma";

/**
 * Temporary cutover switch. Defaults to JSON when unset.
 * Server-only — never expose via NEXT_PUBLIC_*.
 */
export function getPartnerPersistenceMode(): PartnerPersistenceMode {
  const value = process.env.PARTNER_PERSISTENCE?.trim().toLowerCase();
  if (value === "prisma") {
    return "prisma";
  }
  return "json";
}

export function isPrismaPartnerPersistence(): boolean {
  return getPartnerPersistenceMode() === "prisma";
}
