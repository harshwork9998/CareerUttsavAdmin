import { readFile } from "fs/promises";
import path from "path";

import QRCode from "qrcode";

import { sendWithResend, getDefaultFromAddress } from "@/lib/server/email/providers/resend";
import { sendWithSmtp } from "@/lib/server/email/providers/smtp";
import { resolveEmailProvider } from "@/lib/server/email/resolve-provider";
import {
  EMAIL_SEND_TIMEOUT_ERROR,
  RESEND_AMBIGUOUS_NETWORK_ERROR,
  type EmailAttachment,
  type EmailSendOutcome,
  type SendEmailInput,
  type SendEmailResult,
} from "@/lib/server/email/types";

export type { EmailAttachment, EmailSendOutcome, SendEmailInput, SendEmailResult };
export { EMAIL_SEND_TIMEOUT_ERROR, RESEND_AMBIGUOUS_NETWORK_ERROR, getDefaultFromAddress };

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
 * Generate a PNG QR code as base64 for a CID inline attachment.
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

function withDuration(
  result: Awaited<ReturnType<typeof sendWithResend>>,
  durationMs: number
): SendEmailResult {
  if (result.ok) {
    return {
      ok: true,
      id: result.id,
      durationMs,
      outcome: "accepted",
    };
  }

  return {
    ok: false,
    error: result.error,
    durationMs,
    outcome: result.outcome,
  };
}

/**
 * Provider-neutral transactional sender.
 * Callers decide whether to await or fire-and-forget.
 * EMAIL_PROVIDER selects resend or smtp. A missing value stays on Resend.
 */
async function performSendEmail(
  input: SendEmailInput,
  signal?: AbortSignal
): Promise<SendEmailResult> {
  const startedAt = Date.now();
  const elapsedMs = () => Date.now() - startedAt;

  if (signal?.aborted) {
    return {
      ok: false,
      error: EMAIL_SEND_TIMEOUT_ERROR,
      durationMs: elapsedMs(),
      outcome: "unknown",
    };
  }

  try {
    const provider = resolveEmailProvider();
    const result =
      provider === "smtp"
        ? await sendWithSmtp(input, signal)
        : await sendWithResend(input, signal);

    if (signal?.aborted) {
      return {
        ok: false,
        error: EMAIL_SEND_TIMEOUT_ERROR,
        durationMs: elapsedMs(),
        outcome: "unknown",
      };
    }

    return withDuration(result, elapsedMs());
  } catch (error) {
    if (signal?.aborted) {
      return {
        ok: false,
        error: EMAIL_SEND_TIMEOUT_ERROR,
        durationMs: elapsedMs(),
        outcome: "unknown",
      };
    }

    const message =
      error instanceof Error ? error.message : "Unknown email send failure";
    const definitive =
      message === "RESEND_API_KEY is not set in the environment" ||
      message.startsWith("Invalid EMAIL_PROVIDER");

    return {
      ok: false,
      error: message,
      durationMs: elapsedMs(),
      outcome: definitive ? "definitive_failure" : "unknown",
    };
  }
}

export async function sendEmail(
  input: SendEmailInput
): Promise<SendEmailResult> {
  if (!input.timeoutMs) {
    return performSendEmail(input);
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  let timedOut = false;

  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, input.timeoutMs);

  try {
    const result = await performSendEmail(input, controller.signal);

    if (timedOut || controller.signal.aborted) {
      return {
        ok: false,
        error: EMAIL_SEND_TIMEOUT_ERROR,
        durationMs: input.timeoutMs,
        outcome: "unknown",
      };
    }

    return result;
  } finally {
    clearTimeout(timeoutHandle);
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
