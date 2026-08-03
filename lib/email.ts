import { readFile } from "fs/promises";
import path from "path";

import QRCode from "qrcode";
import { Resend } from "resend";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set in the environment");
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export function getDefaultFromAddress(): string {
  return (
    process.env.RESEND_FROM_EMAIL ??
    "Career Uttsav <onboarding@resend.dev>"
  );
}

/** Replace `{{key}}` placeholders in an HTML string. */
export function applyTemplatePlaceholders(
  html: string,
  values: Record<string, string>
): string {
  return Object.entries(values).reduce((output, [key, value]) => {
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    return output.replace(pattern, value);
  }, html);
}

export async function loadEmailTemplate(
  relativePath: string
): Promise<string> {
  const absolutePath = path.join(process.cwd(), relativePath);
  return readFile(absolutePath, "utf8");
}

/**
 * Generate a PNG data-URL QR code from a registration ID
 * (suitable for embedding directly in email HTML).
 */
export async function generateRegistrationQrDataUrl(
  registrationId: string
): Promise<string> {
  return QRCode.toDataURL(registrationId, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 280,
    color: {
      dark: "#111111",
      light: "#FFFFFF",
    },
  });
}

/**
 * Reusable Resend sender for transactional emails.
 * Callers decide whether to await or fire-and-forget.
 */
export async function sendEmail(
  input: SendEmailInput
): Promise<SendEmailResult> {
  try {
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: input.from ?? getDefaultFromAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo,
      tags: input.tags,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data?.id) {
      return { ok: false, error: "Resend did not return an email id" };
    }

    return { ok: true, id: data.id };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown email send failure";
    return { ok: false, error: message };
  }
}

export type StudentWelcomeEmailInput = {
  to: string;
  name: string;
  /** Unique registration identifier encoded into the QR code */
  registrationId: string;
};

/**
 * Send the Career Uttsav student welcome email using the existing HTML template.
 * Failures are returned to the caller — registration flows should not abort on them.
 */
export async function sendStudentWelcomeEmail(
  input: StudentWelcomeEmailInput
): Promise<SendEmailResult> {
  const [template, qrCode] = await Promise.all([
    loadEmailTemplate("emails/student-welcome.html"),
    generateRegistrationQrDataUrl(input.registrationId),
  ]);

  const html = applyTemplatePlaceholders(template, {
    name: input.name.trim() || "there",
    qrCode,
  });

  return sendEmail({
    to: input.to,
    subject: "Welcome to Career Uttsav — your registration is confirmed",
    html,
    tags: [
      { name: "category", value: "student-welcome" },
      { name: "registration_id", value: input.registrationId.slice(0, 64) },
    ],
  });
}
