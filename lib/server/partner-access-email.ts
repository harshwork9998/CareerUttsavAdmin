import { PARTNER_PORTAL_URL } from "@/lib/partner-welcome-email-content";
import { sendEmail, type SendEmailResult } from "@/lib/email";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function partnerPortalBaseUrl(): string {
  return (
    process.env.PARTNER_PORTAL_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_PARTNER_PORTAL_URL?.replace(/\/$/, "") ||
    PARTNER_PORTAL_URL.replace(/\/$/, "")
  );
}

export const PARTNER_ACCESS_EMAIL_SUBJECT =
  "Your Career Uttsav Partner Portal access";

export function buildPartnerAccessEmail(input: {
  partnerName: string;
  login: string;
  temporaryPassword: string;
}): { subject: string; html: string; text: string } {
  const name = input.partnerName.trim() || "Partner";
  const portalUrl = partnerPortalBaseUrl();
  const text = [
    `Hello ${name},`,
    "",
    "Your Career Uttsav Partner Portal access has been created.",
    "",
    `Login ID:`,
    input.login,
    "",
    `Temporary Password:`,
    input.temporaryPassword,
    "",
    `Partner Portal:`,
    portalUrl,
    "",
    "For security, you will be required to create a new password when you first log in.",
    "",
    "If you need assistance, contact:",
    "info@careeruttsav.in",
    "",
    "Team Career Uttsav",
    "K2 Learning Resources India Pvt. Ltd.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="font-family:Arial,sans-serif;color:#14121A;line-height:1.5;">
  <p>Hello ${escapeHtml(name)},</p>
  <p>Your Career Uttsav Partner Portal access has been created.</p>
  <p><strong>Login ID:</strong><br>${escapeHtml(input.login)}</p>
  <p><strong>Temporary Password:</strong><br>${escapeHtml(input.temporaryPassword)}</p>
  <p><strong>Partner Portal:</strong><br><a href="${escapeHtml(portalUrl)}">${escapeHtml(portalUrl)}</a></p>
  <p>For security, you will be required to create a new password when you first log in.</p>
  <p>If you need assistance, contact:<br>info@careeruttsav.in</p>
  <p>Team Career Uttsav<br>K2 Learning Resources India Pvt. Ltd.</p>
</body>
</html>`;

  return { subject: PARTNER_ACCESS_EMAIL_SUBJECT, html, text };
}

export async function sendPartnerAccessEmail(input: {
  to: string;
  partnerName: string;
  login: string;
  temporaryPassword: string;
}): Promise<SendEmailResult> {
  const message = buildPartnerAccessEmail(input);
  return sendEmail({
    to: input.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
}

export const PARTNER_RESET_EMAIL_SUBJECT =
  "Reset your Career Uttsav Partner Portal password";

export function buildPartnerResetEmail(input: {
  partnerName: string;
  resetUrl: string;
}): { subject: string; html: string; text: string } {
  const name = input.partnerName.trim() || "Partner";
  const text = [
    `Hello ${name},`,
    "",
    "We received a request to reset your Career Uttsav Partner Portal password.",
    "",
    input.resetUrl,
    "",
    "This link expires in 30 minutes and can be used only once.",
    "",
    "If you did not request this, you can ignore this email.",
    "",
    "For support:",
    "info@careeruttsav.in",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="font-family:Arial,sans-serif;color:#14121A;line-height:1.5;">
  <p>Hello ${escapeHtml(name)},</p>
  <p>We received a request to reset your Career Uttsav Partner Portal password.</p>
  <p><a href="${escapeHtml(input.resetUrl)}">Reset Password</a></p>
  <p>This link expires in 30 minutes and can be used only once.</p>
  <p>If you did not request this, you can ignore this email.</p>
  <p>For support:<br>info@careeruttsav.in</p>
</body>
</html>`;

  return { subject: PARTNER_RESET_EMAIL_SUBJECT, html, text };
}

export function buildPartnerResetUrl(token: string): string {
  const url = new URL("/reset-password", `${partnerPortalBaseUrl()}/`);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function sendPartnerResetEmail(input: {
  to: string;
  partnerName: string;
  resetUrl: string;
}): Promise<SendEmailResult> {
  const message = buildPartnerResetEmail(input);
  return sendEmail({
    to: input.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
}

export function logEmailResult(input: {
  kind: "partner-access-email" | "partner-reset-email";
  partnerId: string;
  result: SendEmailResult;
}): void {
  console.info(`[${input.kind}]`, {
    partnerId: input.partnerId,
    outcome: input.result.outcome,
    messageId: input.result.ok ? input.result.id : undefined,
    durationMs: input.result.durationMs,
  });
}
