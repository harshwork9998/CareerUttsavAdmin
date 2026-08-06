import type { Partner } from "@/types";

import {
  PARTNER_WELCOME_EMAIL_SUBJECT,
  buildPartnerWelcomeHtmlFromTemplate,
  buildPartnerWelcomePlainText,
  type PartnerWelcomeEmailInput,
} from "@/lib/partner-welcome-email-content";
import { PARTNER_WELCOME_HTML_TEMPLATE } from "@/lib/partner-welcome-email-template";

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
 * Invite/send-to email is separate and must not override login.
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

export function generateTempPassword(length = 10) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/** Build welcome email locally (no network) so finish stays snappy. */
export function buildPartnerWelcomeEmail(input: PartnerWelcomeEmailInput) {
  return {
    subject: PARTNER_WELCOME_EMAIL_SUBJECT,
    html: buildPartnerWelcomeHtmlFromTemplate(
      PARTNER_WELCOME_HTML_TEMPLATE,
      input
    ),
    plainText: buildPartnerWelcomePlainText(input),
  };
}

async function copyRichEmailToClipboard(html: string, plainText: string) {
  if (
    typeof ClipboardItem !== "undefined" &&
    navigator.clipboard?.write &&
    typeof Blob !== "undefined"
  ) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plainText], { type: "text/plain" }),
        }),
      ]);
      return "html" as const;
    } catch {
      // Fall through to plain text if rich clipboard is blocked.
    }
  }

  await navigator.clipboard.writeText(plainText);
  return "plain" as const;
}

function openGmailComposeWindow(to: string, subject: string) {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: to.trim(),
    su: subject,
  });
  window.open(
    `https://mail.google.com/mail/?${params.toString()}`,
    "_blank",
    "noopener,noreferrer"
  );
}

/**
 * Opens Gmail compose (call synchronously from a click handler when possible)
 * and copies formatted HTML to the clipboard for paste.
 */
export async function openPartnerWelcomeGmailCompose(input: {
  to: string;
  subject: string;
  html: string;
  plainText: string;
  /** When true, skip window.open — caller already opened Gmail under the user gesture. */
  skipOpen?: boolean;
}): Promise<"html" | "plain"> {
  if (!input.skipOpen) {
    openGmailComposeWindow(input.to, input.subject);
  }
  return copyRichEmailToClipboard(input.html, input.plainText);
}

export { openGmailComposeWindow, PARTNER_WELCOME_EMAIL_SUBJECT };

/** @deprecated Use openPartnerWelcomeGmailCompose for HTML partner emails. */
export function openGmailCompose(input: {
  to: string;
  subject: string;
  body: string;
}) {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: input.to.trim(),
    su: input.subject,
    body: input.body,
  });
  window.open(
    `https://mail.google.com/mail/?${params.toString()}`,
    "_blank",
    "noopener,noreferrer"
  );
}
