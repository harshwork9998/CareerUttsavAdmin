import {
  partnerHasPortalPassword,
  verifyStoredPartnerPassword,
} from "@/lib/partner-credentials";
import {
  clearPartnerLoginFailures,
  isPartnerLoginRateLimited,
  recordPartnerLoginFailure,
} from "@/lib/partner-login-rate-limit";
import { findPartnersByPortalLoginForApi } from "@/lib/server/partner-service";
import type { Partner } from "@/types";

export const PARTNER_LOGIN_ERROR = "Invalid login or password.";

function normalizeLogin(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export async function findPartnerByPortalLogin(
  login: string
): Promise<Partner | undefined> {
  const matches = await findPartnersByPortalLoginForApi(login);
  return matches[0];
}

export async function findPartnersByPortalLogin(
  login: string
): Promise<Partner[]> {
  return findPartnersByPortalLoginForApi(login);
}

export type PartnerLoginFailureReason =
  | "rate_limited"
  | "invalid_credentials"
  | "not_found"
  | "access_disabled"
  | "missing_password"
  | "ambiguous";

export type PartnerPortalAuthResult =
  | {
      ok: true;
      partner: Partner;
      mustChangePassword: boolean;
    }
  | {
      ok: false;
      status: 401;
      error: string;
      reason: PartnerLoginFailureReason;
      partnerId?: string;
    };

function denied(
  reason: PartnerLoginFailureReason,
  partnerId?: string
): PartnerPortalAuthResult {
  console.info("[partner-login]", { reason, partnerId: partnerId ?? null });
  return {
    ok: false,
    status: 401,
    error: PARTNER_LOGIN_ERROR,
    reason,
    partnerId,
  };
}

/**
 * Authenticate against portalLoginNormalized only.
 * Public failures share one message. Stage is not consulted.
 * portalAccessEnabled must be true.
 */
export async function authenticatePartnerPortalLogin(input: {
  login: string;
  password: string;
  rateLimitKey: string;
}): Promise<PartnerPortalAuthResult> {
  const login = normalizeLogin(input.login);
  const password = input.password ?? "";
  const rateLimitKey = input.rateLimitKey;

  if (isPartnerLoginRateLimited(rateLimitKey)) {
    return denied("rate_limited");
  }

  if (!login || password.length < 6) {
    recordPartnerLoginFailure(rateLimitKey);
    return denied("invalid_credentials");
  }

  const matches = await findPartnersByPortalLoginForApi(login);
  if (matches.length > 1) {
    recordPartnerLoginFailure(rateLimitKey);
    return denied("ambiguous");
  }

  const partner = matches[0];
  if (!partner) {
    recordPartnerLoginFailure(rateLimitKey);
    return denied("not_found");
  }

  if (partner.portalAccessEnabled !== true) {
    recordPartnerLoginFailure(rateLimitKey);
    return denied("access_disabled", partner.id);
  }

  if (!partnerHasPortalPassword(partner)) {
    recordPartnerLoginFailure(rateLimitKey);
    return denied("missing_password", partner.id);
  }

  if (!verifyStoredPartnerPassword(partner, password)) {
    recordPartnerLoginFailure(rateLimitKey);
    return denied("invalid_credentials", partner.id);
  }

  clearPartnerLoginFailures(rateLimitKey);
  return {
    ok: true,
    partner,
    mustChangePassword: !partner.portalPasswordChangedAt,
  };
}
