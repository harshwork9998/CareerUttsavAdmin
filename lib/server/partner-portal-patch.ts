import type { Partner } from "@/types";

/** Fields the Partner Portal may PATCH via service authentication. */
export const PARTNER_PORTAL_PATCH_ALLOWED_KEYS = [
  "portalDocuments",
  "portalFasciaName",
  "portalWebsiteUrl",
  "portalSmsContent",
  "portalSeminarSpeakers",
  "portalRepresentatives",
] as const;

const ALLOWED = new Set<string>(PARTNER_PORTAL_PATCH_ALLOWED_KEYS);

/** Partner submissions. Admin partnership saves must not write these. */
export const PARTNER_OWNED_SUBMISSION_KEYS = [
  "portalDocuments",
  "portalFasciaName",
  "portalWebsiteUrl",
  "portalSmsContent",
  "portalSeminarSpeakers",
  "portalRepresentatives",
] as const;

export function stripPartnerOwnedSubmissionFields<T extends Partial<Partner>>(
  patch: T
): Omit<T, (typeof PARTNER_OWNED_SUBMISSION_KEYS)[number]> {
  const next = { ...patch };
  for (const key of PARTNER_OWNED_SUBMISSION_KEYS) {
    delete next[key];
  }
  return next;
}

export type PartnerPortalPatchResult =
  | { ok: true; patch: Partial<Partner> }
  | { ok: false; status: 403; error: string };

export function parsePartnerPortalPatch(
  body: unknown
): PartnerPortalPatchResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ALLOWED.has(key)) {
      return { ok: false, status: 403, error: "Forbidden" };
    }
  }

  return { ok: true, patch: record as Partial<Partner> };
}
