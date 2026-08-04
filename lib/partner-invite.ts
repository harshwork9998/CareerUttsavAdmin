import type { Partner } from "@/types";

import type { PartnerWelcomeEmailInput } from "@/lib/partner-welcome-email-content";

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

/** Login shown in Chapter 8 and used by the partner portal. */
export function resolvePortalLogin(
  partner: Pick<
    Partner,
    "name" | "primaryContact" | "portalLogin" | "portalInviteEmail"
  >,
  inviteEmail?: string
): string {
  const invite = inviteEmail?.trim().toLowerCase() ?? "";
  if (isPartnerPortalEmail(invite)) return invite;

  const stored = partner.portalLogin?.trim().toLowerCase() ?? "";
  if (isPartnerPortalEmail(stored)) return stored;

  const sentTo = partner.portalInviteEmail?.trim().toLowerCase() ?? "";
  if (isPartnerPortalEmail(sentTo)) return sentTo;

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

export async function buildPartnerWelcomeEmail(input: PartnerWelcomeEmailInput) {
  const res = await fetch("/api/partners/welcome-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Could not build welcome email");
  }

  return res.json() as Promise<{
    subject: string;
    html: string;
    plainText: string;
  }>;
}

async function copyRichEmailToClipboard(html: string, plainText: string) {
  if (
    typeof ClipboardItem !== "undefined" &&
    navigator.clipboard?.write &&
    typeof Blob !== "undefined"
  ) {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plainText], { type: "text/plain" }),
      }),
    ]);
    return "html";
  }

  await navigator.clipboard.writeText(plainText);
  return "plain";
}

/** Opens Gmail compose and copies formatted HTML to the clipboard for paste. */
export async function openPartnerWelcomeGmailCompose(input: {
  to: string;
  subject: string;
  html: string;
  plainText: string;
}): Promise<"html" | "plain"> {
  const mode = await copyRichEmailToClipboard(input.html, input.plainText);

  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: input.to.trim(),
    su: input.subject,
  });
  window.open(
    `https://mail.google.com/mail/?${params.toString()}`,
    "_blank",
    "noopener,noreferrer"
  );

  return mode;
}

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
