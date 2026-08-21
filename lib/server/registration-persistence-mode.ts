export type RegistrationPersistenceMode = "json" | "prisma";

/**
 * Temporary cutover switch. Defaults to JSON when unset.
 * Server-only — never expose via NEXT_PUBLIC_*.
 */
export function getRegistrationPersistenceMode(): RegistrationPersistenceMode {
  const value = process.env.REGISTRATION_PERSISTENCE?.trim().toLowerCase();
  if (value === "prisma") {
    return "prisma";
  }
  return "json";
}

export function isPrismaRegistrationPersistence(): boolean {
  return getRegistrationPersistenceMode() === "prisma";
}
