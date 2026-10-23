import type { Partner } from "@/types";

export function isPartnerPortalEmail(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function generatePartnerLogin(partner: Pick<Partner, "name" | "primaryContact">) {
  const email = partner.primaryContact.email.trim().toLowerCase();
  if (isPartnerPortalEmail(email)) return email;

  const slug = partner.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 24);
  return `${slug || "partner"}@partners.careeruttsav.in`;
}

/**
 * Default portal login for Chapter 8:
 * saved portalLogin → primary contact email → generated fallback.
 * Invite email is the message recipient and is not a login alias.
 */
export function resolvePortalLogin(
  partner: Pick<
    Partner,
    "name" | "primaryContact" | "portalLogin" | "portalInviteEmail"
  >,
  _inviteEmail?: string
): string {
  const stored = partner.portalLogin?.trim().toLowerCase() ?? "";
  if (isPartnerPortalEmail(stored)) return stored;

  const primary = partner.primaryContact.email.trim().toLowerCase();
  if (isPartnerPortalEmail(primary)) return primary;

  return generatePartnerLogin(partner);
}
