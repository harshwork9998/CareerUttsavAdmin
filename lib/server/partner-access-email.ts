import { readFile } from "fs/promises";
import path from "path";

import { PARTNER_PORTAL_URL } from "@/lib/partner-welcome-email-content";
import { sendEmail, type SendEmailResult } from "@/lib/email";
import {
  buildPartnerAccessEmailContent,
  type PartnerAccessEmailInput,
} from "@/lib/server/partner-access-email-template";

const LOGO_PATH = path.join(
  process.cwd(),
  "public",
  "images",
  "career-uttsav-logo.png"
);
const LOGO_CID = "career-uttsav-logo";

async function loadPartnerAccessLogo(): Promise<string | null> {
  try {
    const bytes = await readFile(LOGO_PATH);
    return bytes.toString("base64");
  } catch {
    return null;
  }
}

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

export function buildPartnerAccessEmail(input: {
  partnerName: string;
  login: string;
  temporaryPassword: string;
  dueDate?: string | null;
  supportEmail?: string;
  supportPhone?: string | null;
  includeLogo?: boolean;
  portalUrl?: string;
}): { subject: string; html: string; text: string } {
  const content: PartnerAccessEmailInput = {
    institutionName: input.partnerName,
    portalUrl: input.portalUrl?.trim() || partnerPortalBaseUrl(),
    portalLogin: input.login,
    temporaryPassword: input.temporaryPassword,
    dueDate: input.dueDate === undefined ? "2026-12-01" : input.dueDate,
    supportEmail: input.supportEmail,
    supportPhone: input.supportPhone,
    includeLogo: input.includeLogo,
  };
  return buildPartnerAccessEmailContent(content);
}

export async function sendPartnerAccessEmail(input: {
  to: string;
  partnerName: string;
  login: string;
  temporaryPassword: string;
  dueDate?: string | null;
  supportPhone?: string | null;
}): Promise<SendEmailResult> {
  const logo = await loadPartnerAccessLogo();
  const message = buildPartnerAccessEmail({
    ...input,
    includeLogo: Boolean(logo),
  });
  return sendEmail({
    to: input.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    ...(logo
      ? {
          attachments: [
            {
              filename: "career-uttsav-logo.png",
              content: logo,
              contentId: LOGO_CID,
            },
          ],
        }
      : {}),
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
