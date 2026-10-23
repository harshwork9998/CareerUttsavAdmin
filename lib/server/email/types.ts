export type EmailAttachment = {
  filename: string;
  content: string;
  contentId: string;
};

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
  attachments?: EmailAttachment[];
  timeoutMs?: number;
};

export type EmailSendOutcome = "accepted" | "definitive_failure" | "unknown";

export type SendEmailResult =
  | { ok: true; id: string; durationMs: number; outcome: "accepted" }
  | {
      ok: false;
      error: string;
      durationMs: number;
      outcome: "definitive_failure" | "unknown";
    };

export type ProviderSendResult =
  | { ok: true; id: string; outcome: "accepted" }
  | {
      ok: false;
      error: string;
      outcome: "definitive_failure" | "unknown";
    };

export const EMAIL_SEND_TIMEOUT_ERROR = "EMAIL_SEND_TIMEOUT";

export const RESEND_AMBIGUOUS_NETWORK_ERROR =
  "Unable to fetch data. The request could not be resolved.";
