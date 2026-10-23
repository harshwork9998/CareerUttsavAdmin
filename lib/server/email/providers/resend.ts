import { Resend } from "resend";

import {
  EMAIL_SEND_TIMEOUT_ERROR,
  RESEND_AMBIGUOUS_NETWORK_ERROR,
  type ProviderSendResult,
  type SendEmailInput,
} from "@/lib/server/email/types";

/**
 * Resend v6.x forwards unknown PostOptions fields (including `signal`) to `fetch`
 * at runtime even though CreateEmailRequestOptions does not yet declare it.
 */
type ResendEmailSendOptions = { signal?: AbortSignal };

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
    process.env.RESEND_FROM_EMAIL ?? "Career Uttsav <onboarding@resend.dev>"
  );
}

function classifyEmailSendFailure(
  error: string
): "definitive_failure" | "unknown" {
  if (
    error === EMAIL_SEND_TIMEOUT_ERROR ||
    error === RESEND_AMBIGUOUS_NETWORK_ERROR
  ) {
    return "unknown";
  }

  return "definitive_failure";
}

export async function sendWithResend(
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

  try {
    const resend = getResendClient();
    const requestOptions: ResendEmailSendOptions | undefined = signal
      ? { signal }
      : undefined;
    const { data, error } = await resend.emails.send(
      {
        from: input.from ?? getDefaultFromAddress(),
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo: input.replyTo,
        tags: input.tags,
        attachments: input.attachments?.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
          contentId: attachment.contentId,
        })),
      },
      requestOptions as Parameters<Resend["emails"]["send"]>[1]
    );

    if (signal?.aborted) {
      return {
        ok: false,
        error: EMAIL_SEND_TIMEOUT_ERROR,
        outcome: "unknown",
      };
    }

    if (error) {
      return {
        ok: false,
        error: error.message,
        outcome: classifyEmailSendFailure(error.message),
      };
    }

    if (!data?.id) {
      return {
        ok: false,
        error: "Resend did not return an email id",
        outcome: "definitive_failure",
      };
    }

    return { ok: true, id: data.id, outcome: "accepted" };
  } catch (error) {
    if (signal?.aborted) {
      return {
        ok: false,
        error: EMAIL_SEND_TIMEOUT_ERROR,
        outcome: "unknown",
      };
    }

    const message =
      error instanceof Error ? error.message : "Unknown email send failure";
    return {
      ok: false,
      error: message,
      outcome:
        message === "RESEND_API_KEY is not set in the environment"
          ? "definitive_failure"
          : "unknown",
    };
  }
}
