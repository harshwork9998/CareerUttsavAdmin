import { normalizePortalLogin } from "@/lib/server/partner-prisma-import-map";

/**
 * Canonical partner sign-in identity.
 * portalInviteEmail is the address we email. It is not a second login.
 *
 * Compatibility: the migration copies portalInviteEmail into portalLogin only
 * when portalLoginNormalized is empty and that email is not already another
 * partner's login. If the two fields differ, the stored login remains the
 * only accepted identity.
 */
export function portalLoginLookupFilter(
  login: string
): { portalLoginNormalized: string } | null {
  const normalized = normalizePortalLogin(login);
  if (!normalized) return null;
  return { portalLoginNormalized: normalized };
}
