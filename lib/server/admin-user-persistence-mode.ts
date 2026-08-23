export type AdminUserPersistenceMode = "json" | "prisma";

/**
 * Temporary cutover switch for Admin user/auth persistence.
 * Defaults to JSON when unset. Server-only — never expose via NEXT_PUBLIC_*.
 */
export function getAdminUserPersistenceMode(): AdminUserPersistenceMode {
  const value = process.env.ADMIN_USER_PERSISTENCE?.trim().toLowerCase();
  if (value === "prisma") {
    return "prisma";
  }
  return "json";
}

export function isPrismaAdminUserPersistence(): boolean {
  return getAdminUserPersistenceMode() === "prisma";
}
