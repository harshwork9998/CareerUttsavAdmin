import {
  partnerHasPortalPassword,
  verifyStoredPartnerPassword,
} from "@/lib/partner-credentials";
import { loadPartners } from "@/lib/server/partners-persistence";
import type { Partner } from "@/types";

function normalizeLogin(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export function findPartnerByPortalLogin(login: string): Partner | undefined {
  const normalized = normalizeLogin(login);
  if (!normalized) return undefined;
  return loadPartners().find((partner) => {
    return (
      normalizeLogin(partner.portalLogin) === normalized ||
      normalizeLogin(partner.portalInviteEmail) === normalized
    );
  });
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
        | "missing_password";
    };

/**
 * Authenticate a partner portal login against the Admin partners store.
 * Passwords are verified against a salted hash (never stored as plaintext).
 */
export function authenticatePartnerPortalLogin(input: {
  login: string;
  password: string;
}): PartnerPortalAuthResult {
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

  const partner = findPartnerByPortalLogin(login);
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

  // Activated once credentials exist; invite-sent stamp is preferred but not required
  // so draft-saved Chapter 8 credentials still work before "Send email & finish".
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
