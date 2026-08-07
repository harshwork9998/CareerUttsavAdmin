import {
  hashPartnerPassword,
  isPartnerPasswordHash,
  verifyPartnerPassword,
} from "@/lib/partner-password";
import type { Partner } from "@/types";

export type PublicPartner = Omit<
  Partner,
  "portalPasswordHash" | "portalTempPassword"
> & {
  /** True when a portal password is stored (hash only — never returned). */
  hasPortalPassword?: boolean;
};

/** Persist auth fields safely: hash any plaintext password, never keep plaintext. */
export function applyPartnerCredentialFields(
  existing: Partner,
  patch: Partial<Partner>
): Partner {
  const next: Partner = {
    ...existing,
    ...patch,
    id: existing.id,
  };

  const incomingPassword = patch.portalTempPassword;
  if (typeof incomingPassword === "string" && incomingPassword.trim().length >= 6) {
    next.portalPasswordHash = hashPartnerPassword(incomingPassword.trim());
    next.portalAuthVersion = (existing.portalAuthVersion ?? 0) + 1;
  } else if (
    typeof patch.portalPasswordHash === "string" &&
    isPartnerPasswordHash(patch.portalPasswordHash)
  ) {
    next.portalPasswordHash = patch.portalPasswordHash;
    if (patch.portalPasswordHash !== existing.portalPasswordHash) {
      next.portalAuthVersion = (existing.portalAuthVersion ?? 0) + 1;
    }
  } else {
    next.portalPasswordHash = existing.portalPasswordHash;
  }

  delete next.portalTempPassword;
  delete next.hasPortalPassword;
  return next;
}

/** Upgrade legacy plaintext passwords to hashes (idempotent). */
export function migratePartnerCredentials(partner: Partner): Partner {
  const plaintext = partner.portalTempPassword?.trim();
  if (plaintext && !isPartnerPasswordHash(partner.portalPasswordHash)) {
    return {
      ...partner,
      portalPasswordHash: hashPartnerPassword(plaintext),
      portalTempPassword: undefined,
    };
  }

  if (partner.portalTempPassword) {
    const { portalTempPassword: _removed, ...rest } = partner;
    return rest;
  }

  return partner;
}

export function partnerHasPortalPassword(partner: Partner): boolean {
  return Boolean(
    isPartnerPasswordHash(partner.portalPasswordHash) ||
      partner.portalTempPassword
  );
}

export function toPublicPartner(partner: Partner): PublicPartner {
  const {
    portalPasswordHash: _hash,
    portalTempPassword: _temp,
    ...rest
  } = partner;
  return {
    ...rest,
    hasPortalPassword: partnerHasPortalPassword(partner),
  };
}

export function verifyStoredPartnerPassword(
  partner: Partner,
  password: string
): boolean {
  if (isPartnerPasswordHash(partner.portalPasswordHash)) {
    return verifyPartnerPassword(password, partner.portalPasswordHash);
  }
  return verifyPartnerPassword(password, partner.portalTempPassword);
}
