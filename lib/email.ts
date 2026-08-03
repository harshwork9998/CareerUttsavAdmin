import { readFile } from "fs/promises";
import path from "path";

import QRCode from "qrcode";
import { Resend } from "resend";

export type EmailAttachment = {
  filename: string;
  content: string;
  contentId: string;
};

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
  attachments?: EmailAttachment[];
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
 * Generate a PNG QR code as base64 (for Resend CID inline attachments).
 * Data URLs in img src are blocked by most email clients (Gmail, Outlook, etc.).
 */
export async function generateRegistrationQrPngBase64(
  registrationId: string
): Promise<string> {
  const value = registrationId.trim();
  if (!value) {
    throw new Error("Registration ID is required for QR generation");
  }

  const buffer = await QRCode.toBuffer(value, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 280,
    type: "png",
    color: {
      dark: "#111111",
      light: "#FFFFFF",
    },
  });

  return buffer.toString("base64");
}

/** @deprecated Prefer generateRegistrationQrPngBase64 + CID attachments for email. */
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
      attachments: input.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentId: attachment.contentId,
      })),
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
  const [template, qrContent] = await Promise.all([
    loadEmailTemplate("emails/student-welcome.html"),
    generateRegistrationQrPngBase64(input.registrationId),
  ]);

  const html = applyTemplatePlaceholders(template, {
    name: input.name.trim() || "there",
  });

  return sendEmail({
    to: input.to,
    subject: "Welcome to Career Uttsav — your registration is confirmed",
    html,
    attachments: [
      {
        filename: "registration-qr.png",
        content: qrContent,
        contentId: "registration-qr",
      },
    ],
    tags: [
      { name: "category", value: "student-welcome" },
      { name: "registration_id", value: input.registrationId.slice(0, 64) },
    ],
  });
}
