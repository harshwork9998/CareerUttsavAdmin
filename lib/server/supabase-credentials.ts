/** Server-only Supabase credential helpers (never import from client components). */

const SECRET_ENV_NAMES = ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;

/**
 * Privileged Supabase API key for Storage/admin SDK calls.
 * Prefer `SUPABASE_SECRET_KEY` (sb_secret_…); fall back to legacy service role JWT.
 */
export function readSupabaseSecretKey(): string | null {
  for (const name of SECRET_ENV_NAMES) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
}

/** @deprecated Use {@link readSupabaseSecretKey}. */
export function readSupabaseServiceRoleKey(): string | null {
  return readSupabaseSecretKey();
}
