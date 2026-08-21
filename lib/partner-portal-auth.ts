import {
  partnerHasPortalPassword,
  verifyStoredPartnerPassword,
} from "@/lib/partner-credentials";
import { findPartnersByPortalLoginForApi } from "@/lib/server/partner-service";
import type { Partner } from "@/types";

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

export type PartnerPortalAuthResult =
  | {
      ok: true;
      partner: Partner;
      mustChangePassword: boolean;
    }
  | {
      ok: false;
      status: 401 | 503;
      error: string;
      code:
        | "invalid_credentials"
        | "not_activated"
        | "missing_password"
        | "ambiguous_credentials";
    };

/**
 * Authenticate a partner portal login against the Admin partners store.
 * Passwords are verified against a salted hash (never stored as plaintext).
 */
export async function authenticatePartnerPortalLogin(input: {
  login: string;
  password: string;
}): Promise<PartnerPortalAuthResult> {
  const login = normalizeLogin(input.login);
  const password = input.password ?? "";

  if (!login || password.length < 6) {
    return {
      ok: false,
      status: 401,
      error: "Invalid login or password",
      code: "invalid_credentials",
    };
  }

  const matches = await findPartnersByPortalLoginForApi(login);
  if (matches.length > 1) {
    return {
      ok: false,
      status: 503,
      error: "Partner login is ambiguous. Please contact support.",
      code: "ambiguous_credentials",
    };
  }

  const partner = matches[0];
  if (!partner) {
    return {
      ok: false,
      status: 401,
      error: "Invalid login or password",
      code: "invalid_credentials",
    };
  }

  if (!partnerHasPortalPassword(partner)) {
    return {
      ok: false,
      status: 401,
      error: "Partner access has not been activated yet",
      code: "missing_password",
    };
  }

  const activated =
    Boolean(partner.portalInviteSentAt) ||
    Boolean(partner.portalLogin && partnerHasPortalPassword(partner));
  if (!activated) {
    return {
      ok: false,
      status: 401,
      error: "Partner access has not been activated yet",
      code: "not_activated",
    };
  }

  if (!verifyStoredPartnerPassword(partner, password)) {
    return {
      ok: false,
      status: 401,
      error: "Invalid login or password",
      code: "invalid_credentials",
    };
  }

  return {
    ok: true,
    partner,
    mustChangePassword: !partner.portalPasswordChangedAt,
  };
}
