import { ROLE_LABELS } from "@/constants";
import { sendEmail } from "@/lib/email";
import type { RoleName, User } from "@/types";

export const ADMIN_APPROVED_EMAIL_SUBJECT =
  "Your Career Uttsav Admin account has been approved";

export const ADMIN_REJECTED_EMAIL_SUBJECT =
  "Update on your Career Uttsav Admin account request";

export type AdminAuthEmailNotificationResult = {
  attempted: boolean;
  sent: boolean;
};

export type AdminAccountApprovedEmailInput = {
  name: string;
  email: string;
  role: RoleName;
  loginUrl: string;
};

export type AdminAccountRejectedEmailInput = {
  name: string;
  email: string;
};

function getAdminLoginUrl(): string {
  return (
    process.env.ADMIN_LOGIN_URL?.trim() || "https://admin.careeruttsav.in"
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildSimpleHtmlEmail(paragraphs: string[]): string {
  const body = paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("\n");
  return `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
    ${body}
  </body>
</html>`;
}

export function buildAdminAccountApprovedEmailContent(
  input: AdminAccountApprovedEmailInput
): { subject: string; html: string; text: string } {
  const roleLabel = ROLE_LABELS[input.role];
  const name = input.name.trim() || "there";

  const text = `Hello ${name},

Your Career Uttsav Admin account has been approved.

Access level: ${roleLabel}

You can now sign in using the email address and password you used while creating your account.

Login:
${input.loginUrl}

If you did not request this account, please contact the Career Uttsav administrator.

Regards,
Career Uttsav Team`;

  const html = buildSimpleHtmlEmail([
    `Hello ${name},`,
    "Your Career Uttsav Admin account has been approved.",
    `Access level: ${roleLabel}`,
    "You can now sign in using the email address and password you used while creating your account.",
    `Login: ${input.loginUrl}`,
    "If you did not request this account, please contact the Career Uttsav administrator.",
    "Regards,",
    "Career Uttsav Team",
  ]);

  return { subject: ADMIN_APPROVED_EMAIL_SUBJECT, html, text };
}

export function buildAdminAccountRejectedEmailContent(
  input: AdminAccountRejectedEmailInput
): { subject: string; html: string; text: string } {
  const name = input.name.trim() || "there";

  const text = `Hello ${name},

Your request for access to Career Uttsav Admin has not been approved.

If you believe this requires clarification, please contact the Career Uttsav administrator.

Regards,
Career Uttsav Team`;

  const html = buildSimpleHtmlEmail([
    `Hello ${name},`,
    "Your request for access to Career Uttsav Admin has not been approved.",
    "If you believe this requires clarification, please contact the Career Uttsav administrator.",
    "Regards,",
    "Career Uttsav Team",
  ]);

  return { subject: ADMIN_REJECTED_EMAIL_SUBJECT, html, text };
}

function logEmailFailure(kind: "approved" | "rejected", error: string): void {
  console.error(`[admin-auth-email] ${kind} notification failed: ${error}`);
}

/**
 * Send account-approved notification. Never throws — callers keep DB changes.
 * Reusable pattern for future transactional admin emails (e.g. password reset).
 */
export async function sendAdminAccountApprovedEmail(
  user: User
): Promise<AdminAuthEmailNotificationResult> {
  const content = buildAdminAccountApprovedEmailContent({
    name: user.name,
    email: user.email,
    role: user.role,
    loginUrl: getAdminLoginUrl(),
  });

  const result = await sendEmail({
    to: user.email,
    subject: content.subject,
    html: content.html,
    text: content.text,
    tags: [
      { name: "category", value: "admin-account-approved" },
      { name: "user_id", value: user.id.slice(0, 64) },
    ],
  });

  if (!result.ok) {
    logEmailFailure("approved", result.error);
    return { attempted: true, sent: false };
  }

  return { attempted: true, sent: true };
}

/** Send account-rejected notification. Never throws — callers keep DB changes. */
export async function sendAdminAccountRejectedEmail(
  user: User
): Promise<AdminAuthEmailNotificationResult> {
  const content = buildAdminAccountRejectedEmailContent({
    name: user.name,
    email: user.email,
  });

  const result = await sendEmail({
    to: user.email,
    subject: content.subject,
    html: content.html,
    text: content.text,
    tags: [
      { name: "category", value: "admin-account-rejected" },
      { name: "user_id", value: user.id.slice(0, 64) },
    ],
  });

  if (!result.ok) {
    logEmailFailure("rejected", result.error);
    return { attempted: true, sent: false };
  }

  return { attempted: true, sent: true };
}

export function buildAdminReviewSuccessMessage(
  action: "approve" | "reject",
  notification: AdminAuthEmailNotificationResult
): string {
  if (action === "approve") {
    return notification.sent
      ? "Account approved and notification email sent."
      : "Account approved, but notification email could not be sent.";
  }

  return notification.sent
    ? "Account rejected and notification email sent."
    : "Account rejected, but notification email could not be sent.";
}
