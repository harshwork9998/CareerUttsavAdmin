import nodemailer, { type SMTPTransportOptions } from "nodemailer";
import type { SentMessageInfo } from "nodemailer";

import {
  EMAIL_SEND_TIMEOUT_ERROR,
  type ProviderSendResult,
  type SendEmailInput,
} from "@/lib/server/email/types";

/** Backstop when the caller does not pass timeoutMs. Password reset uses 12s. */
export const SMTP_TRANSPORT_TIMEOUT_MS = 15_000;

const PRE_ACCEPT_ORIGINAL_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EADDRNOTAVAIL",
  "EDNS",
]);

const AMBIGUOUS_CODES = new Set([
  "ETIMEDOUT",
  "ETIMEOUT",
  "ECONNECTION",
  "ECONNRESET",
  "EPIPE",
  "EAI_AGAIN",
  "ESOCKET",
]);

const DEFINITIVE_CODES = new Set([
  "EAUTH",
  "ENOAUTH",
  "EOAUTH2",
  "EENVELOPE",
  "EMESSAGE",
  "EDNS",
  "ETLS",
  "EREQUIRETLS",
  "ECONFIG",
  "ENOTFOUND",
  "ECONNREFUSED",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EADDRNOTAVAIL",
]);

type SmtpConfig =
  | { ok: true; from: string; transport: SMTPTransportOptions }
  | { ok: false; error: string };

function readRequireTls(): boolean | { error: string } {
  const raw = process.env.SMTP_REQUIRE_TLS;
  if (raw === undefined || raw.trim() === "") {
    return true;
  }

  const value = raw.trim().toLowerCase();
  if (value === "true" || value === "1" || value === "yes") {
    return true;
  }
  if (value === "false" || value === "0" || value === "no") {
    return false;
  }

  return {
    error: `Invalid SMTP_REQUIRE_TLS "${raw.trim()}". Expected "true" or "false".`,
  };
}

function readPort(): number | { error: string } {
  const raw = process.env.SMTP_PORT;
  if (raw === undefined || raw.trim() === "") {
    return 587;
  }

  const port = Number(raw.trim());
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { error: "SMTP_PORT must be an integer from 1 to 65535" };
  }

  return port;
}

function readAuth():
  | { user: string; pass: string }
  | undefined
  | { error: string } {
  const user = process.env.SMTP_USER?.trim() ?? "";
  const pass = process.env.SMTP_PASS ?? "";
  const userSet = user.length > 0;
  const passSet = pass.length > 0;

  if (!userSet && !passSet) {
    return undefined;
  }

  if (!userSet || !passSet) {
    return {
      error:
        "SMTP_USER and SMTP_PASS must both be set when SMTP authentication is enabled",
    };
  }

  return { user, pass };
}

function formatMailbox(name: string, email: string): string {
  if (/[",<>]/.test(name)) {
    const escaped = name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escaped}" <${email}>`;
  }

  return `${name} <${email}>`;
}

function readFromAddress(): string | { error: string } {
  const email = process.env.SMTP_FROM_EMAIL?.trim() ?? "";
  const name = process.env.SMTP_FROM_NAME?.trim() ?? "";

  if (!email) {
    return { error: "SMTP_FROM_EMAIL is not set in the environment" };
  }
  if (!name) {
    return { error: "SMTP_FROM_NAME is not set in the environment" };
  }
  if (/[\r\n]/.test(name) || /[\r\n\s<>]/.test(email)) {
    return { error: "SMTP from address is invalid" };
  }

  return formatMailbox(name, email);
}

function transportTimeout(timeoutMs: number | undefined): number {
  if (timeoutMs === undefined || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return SMTP_TRANSPORT_TIMEOUT_MS;
  }

  return timeoutMs;
}

function readSmtpConfig(timeoutMs: number | undefined): SmtpConfig {
  const host = process.env.SMTP_HOST?.trim() ?? "";
  if (!host) {
    return { ok: false, error: "SMTP_HOST is not set in the environment" };
  }

  const port = readPort();
  if (typeof port !== "number") {
    return { ok: false, error: port.error };
  }

  const requireTls = readRequireTls();
  if (typeof requireTls !== "boolean") {
    return { ok: false, error: requireTls.error };
  }

  const auth = readAuth();
  if (auth && "error" in auth) {
    return { ok: false, error: auth.error };
  }

  const from = readFromAddress();
  if (typeof from !== "string") {
    return { ok: false, error: from.error };
  }

  const timeout = transportTimeout(timeoutMs);
  const secure = port === 465;

  const transport: SMTPTransportOptions = {
    host,
    port,
    secure,
    requireTLS: requireTls && !secure,
    connectionTimeout: timeout,
    greetingTimeout: timeout,
    socketTimeout: timeout,
    dnsTimeout: timeout,
    logger: false,
    debug: false,
    transactionLog: false,
  };

  if (auth) {
    transport.auth = auth;
  }

  return { ok: true, from, transport };
}

function errorText(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Failed to send email via SMTP";
}

function classifySmtpError(error: unknown): "definitive_failure" | "unknown" {
  if (!error || typeof error !== "object") {
    return "unknown";
  }

  const failure = error as {
    code?: unknown;
    originalCode?: unknown;
    responseCode?: unknown;
    message?: unknown;
  };

  if (failure.message === EMAIL_SEND_TIMEOUT_ERROR) {
    return "unknown";
  }

  const responseCode =
    typeof failure.responseCode === "number" ? failure.responseCode : undefined;
  if (responseCode === 421) {
    return "unknown";
  }
  if (responseCode !== undefined && responseCode >= 400) {
    return "definitive_failure";
  }

  const code = typeof failure.code === "string" ? failure.code : "";
  const originalCode =
    typeof failure.originalCode === "string" ? failure.originalCode : "";

  if (PRE_ACCEPT_ORIGINAL_CODES.has(originalCode)) {
    return "definitive_failure";
  }

  if (AMBIGUOUS_CODES.has(code)) {
    return "unknown";
  }

  if (
    DEFINITIVE_CODES.has(code) ||
    DEFINITIVE_CODES.has(originalCode) ||
    code.startsWith("ERR_TLS") ||
    originalCode.startsWith("ERR_TLS")
  ) {
    return "definitive_failure";
  }

  return "unknown";
}

async function sendMailRespectingSignal(
  transporter: ReturnType<typeof nodemailer.createTransport>,
  message: Parameters<
    ReturnType<typeof nodemailer.createTransport>["sendMail"]
  >[0],
  signal?: AbortSignal
): Promise<SentMessageInfo> {
  if (!signal) {
    return transporter.sendMail(message);
  }

  if (signal.aborted) {
    throw Object.assign(new Error(EMAIL_SEND_TIMEOUT_ERROR), {
      code: "ETIMEDOUT",
    });
  }

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      try {
        transporter.close();
      } catch {
        // The caller timeout must still settle as unknown.
      }
      reject(
        Object.assign(new Error(EMAIL_SEND_TIMEOUT_ERROR), {
          code: "ETIMEDOUT",
        })
      );
    };

    signal.addEventListener("abort", onAbort);
    transporter.sendMail(message).then(
      (info) => {
        signal.removeEventListener("abort", onAbort);
        resolve(info);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
}

export async function sendWithSmtp(
  input: SendEmailInput,
  signal?: AbortSignal
): Promise<ProviderSendResult> {
  if (signal?.aborted) {
    return {
      ok: false,
      error: EMAIL_SEND_TIMEOUT_ERROR,
      outcome: "unknown",
    };
  }

  const config = readSmtpConfig(input.timeoutMs);
  if (!config.ok) {
    return {
      ok: false,
      error: config.error,
      outcome: "definitive_failure",
    };
  }

  const transporter = nodemailer.createTransport(config.transport);

  try {
    const info = await sendMailRespectingSignal(
      transporter,
      {
        from: input.from ?? config.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo: input.replyTo,
        attachments: input.attachments?.map((attachment) => ({
          filename: attachment.filename,
          content: Buffer.from(attachment.content, "base64"),
          cid: attachment.contentId,
          contentDisposition: "inline",
        })),
      },
      signal
    );

    if (signal?.aborted) {
      return {
        ok: false,
        error: EMAIL_SEND_TIMEOUT_ERROR,
        outcome: "unknown",
      };
    }

    const rejected = Array.isArray(info.rejected) ? info.rejected : [];
    if (rejected.length > 0) {
      return {
        ok: false,
        error: "SMTP rejected the message",
        outcome: "definitive_failure",
      };
    }

    if (!info.messageId) {
      return {
        ok: false,
        error: "SMTP did not return a message id",
        outcome: "definitive_failure",
      };
    }

    return { ok: true, id: info.messageId, outcome: "accepted" };
  } catch (error) {
    if (
      signal?.aborted ||
      (error instanceof Error && error.message === EMAIL_SEND_TIMEOUT_ERROR)
    ) {
      return {
        ok: false,
        error: EMAIL_SEND_TIMEOUT_ERROR,
        outcome: "unknown",
      };
    }

    return {
      ok: false,
      error: errorText(error),
      outcome: classifySmtpError(error),
    };
  } finally {
    try {
      transporter.close();
    } catch {
      // Closing the socket must not hide the send result.
    }
  }
}
