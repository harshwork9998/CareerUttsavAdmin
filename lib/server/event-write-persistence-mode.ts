export type EventWritePersistenceMode = "json" | "prisma";

/**
 * Temporary cutover switch for Event CREATE/PATCH/DELETE.
 * Defaults to JSON when unset. Server-only — never expose via NEXT_PUBLIC_*.
 */
export function getEventWritePersistenceMode(): EventWritePersistenceMode {
  const value = process.env.EVENT_WRITE_PERSISTENCE?.trim().toLowerCase();
  if (value === "prisma") {
    return "prisma";
  }
  return "json";
}

export function isPrismaEventWritePersistence(): boolean {
  return getEventWritePersistenceMode() === "prisma";
}
