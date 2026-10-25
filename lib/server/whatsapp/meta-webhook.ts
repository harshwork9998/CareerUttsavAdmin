import { createHmac, timingSafeEqual } from "crypto";

const SIGNATURE_PREFIX = "sha256=";

export type MetaWebhookVerificationInput = {
  mode: string | null;
  verifyToken: string | null;
  challenge: string | null;
};

export type MetaWebhookVerificationResult =
  | { ok: true; challenge: string }
  | { ok: false };

export type NormalizedWhatsAppMessage = {
  messageId: string;
  waId: string;
  timestamp: string;
  type: string;
  textBody?: string;
  interactiveReplyId?: string;
  interactiveReplyTitle?: string;
};

type MetaWebhookMessage = {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string };
  };
};

type MetaWebhookStatusError = {
  code?: number;
  title?: string;
  message?: string;
  href?: string;
  error_data?: {
    details?: string;
  };
};

type MetaWebhookStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: MetaWebhookStatusError[];
};

type MetaWebhookChangeValue = {
  messaging_product?: string;
  messages?: MetaWebhookMessage[];
  statuses?: MetaWebhookStatus[];
};

type MetaWebhookChange = {
  value?: MetaWebhookChangeValue;
  field?: string;
};

type MetaWebhookEntry = {
  changes?: MetaWebhookChange[];
};

export type MetaWebhookPayload = {
  object?: string;
  entry?: MetaWebhookEntry[];
};

export function getWhatsAppVerifyToken(): string | null {
  const token = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  return token || null;
}

export function getMetaAppSecret(): string | null {
  const secret = process.env.META_APP_SECRET?.trim();
  return secret || null;
}

export function handleMetaWebhookVerification(
  input: MetaWebhookVerificationInput
): MetaWebhookVerificationResult {
  const expectedToken = getWhatsAppVerifyToken();

  if (
    !expectedToken ||
    !input.mode ||
    !input.verifyToken ||
    input.challenge === null ||
    input.challenge === undefined
  ) {
    return { ok: false };
  }

  if (input.mode === "subscribe" && input.verifyToken === expectedToken) {
    return { ok: true, challenge: input.challenge };
  }

  return { ok: false };
}

export function computeMetaWebhookSignature(
  rawBody: string,
  appSecret: string
): string {
  const digest = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return `${SIGNATURE_PREFIX}${digest}`;
}

export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader?.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }

  const provided = signatureHeader.slice(SIGNATURE_PREFIX.length);
  const expected = createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");

  try {
    const providedBuf = Buffer.from(provided, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (providedBuf.length === 0 || providedBuf.length !== expectedBuf.length) {
      return false;
    }
    return timingSafeEqual(providedBuf, expectedBuf);
  } catch {
    return false;
  }
}

export function parseMetaWebhookPayload(rawBody: string): MetaWebhookPayload | null {
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed as MetaWebhookPayload;
  } catch {
    return null;
  }
}

function readInteractiveReply(message: MetaWebhookMessage): {
  id?: string;
  title?: string;
} {
  const interactive = message.interactive;
  if (!interactive) {
    return {};
  }

  if (interactive.button_reply) {
    return {
      id: interactive.button_reply.id,
      title: interactive.button_reply.title,
    };
  }

  if (interactive.list_reply) {
    return {
      id: interactive.list_reply.id,
      title: interactive.list_reply.title,
    };
  }

  return {};
}

export function extractNormalizedWhatsAppMessages(
  payload: MetaWebhookPayload
): NormalizedWhatsAppMessage[] {
  const messages: NormalizedWhatsAppMessage[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        if (!message.id || !message.from || !message.type) {
          continue;
        }

        const interactiveReply = readInteractiveReply(message);
        const normalized: NormalizedWhatsAppMessage = {
          messageId: message.id,
          waId: message.from,
          timestamp: message.timestamp ?? "",
          type: message.type,
        };

        if (message.type === "text" && message.text?.body) {
          normalized.textBody = message.text.body;
        }

        if (interactiveReply.id) {
          normalized.interactiveReplyId = interactiveReply.id;
        }
        if (interactiveReply.title) {
          normalized.interactiveReplyTitle = interactiveReply.title;
        }

        messages.push(normalized);
      }
    }
  }

  return messages;
}

export type WhatsAppDeliveryErrorDiagnostics = {
  deliveryErrorCode?: number;
  deliveryErrorTitle?: string;
  deliveryErrorMessage?: string;
  deliveryErrorDetails?: string;
};

function sanitizeDeliveryError(
  error: MetaWebhookStatusError
): WhatsAppDeliveryErrorDiagnostics {
  const details = error.error_data?.details;
  return {
    deliveryErrorCode:
      typeof error.code === "number" ? error.code : undefined,
    deliveryErrorTitle:
      typeof error.title === "string" && error.title.trim()
        ? error.title.trim()
        : undefined,
    deliveryErrorMessage:
      typeof error.message === "string" && error.message.trim()
        ? error.message.trim()
        : undefined,
    deliveryErrorDetails:
      typeof details === "string" && details.trim() ? details.trim() : undefined,
  };
}

export function extractDeliveryErrorsFromWebhookStatus(
  errors: MetaWebhookStatusError[] | undefined
): WhatsAppDeliveryErrorDiagnostics[] {
  if (!errors?.length) {
    return [];
  }
  return errors.map(sanitizeDeliveryError);
}

export type NormalizedWhatsAppStatus = {
  messageId: string;
  status: string;
  recipientId?: string;
  timestamp?: string;
  deliveryErrors?: WhatsAppDeliveryErrorDiagnostics[];
};

export function extractNormalizedWhatsAppStatuses(
  payload: MetaWebhookPayload
): NormalizedWhatsAppStatus[] {
  const statuses: NormalizedWhatsAppStatus[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        if (!status.id || !status.status) {
          continue;
        }
        const deliveryErrors = extractDeliveryErrorsFromWebhookStatus(
          status.errors
        );
        statuses.push({
          messageId: status.id,
          status: status.status,
          recipientId: status.recipient_id,
          timestamp: status.timestamp,
          ...(deliveryErrors.length > 0 ? { deliveryErrors } : {}),
        });
      }
    }
  }

  return statuses;
}

export function safeLogWhatsAppDeliveryStatus(
  status: NormalizedWhatsAppStatus
): void {
  const base = {
    messageId: status.messageId,
    status: status.status,
    recipient: status.recipientId ? maskWaId(status.recipientId) : undefined,
    timestamp: status.timestamp,
  };

  if (status.status !== "failed" || !status.deliveryErrors?.length) {
    console.info("[whatsapp-webhook] delivery status", base);
    return;
  }

  const first = status.deliveryErrors[0]!;
  console.info("[whatsapp-webhook] delivery status", {
    ...base,
    deliveryErrorCode: first.deliveryErrorCode,
    deliveryErrorTitle: first.deliveryErrorTitle,
    deliveryErrorMessage: first.deliveryErrorMessage,
    deliveryErrorDetails: first.deliveryErrorDetails,
    ...(status.deliveryErrors.length > 1
      ? { deliveryErrorCount: status.deliveryErrors.length }
      : {}),
  });
}

export function maskWaId(waId: string): string {
  const digits = waId.replace(/\D/g, "");
  if (digits.length <= 4) {
    return "****";
  }
  return `****${digits.slice(-4)}`;
}

export function safeLogIncomingWhatsAppMessage(
  message: NormalizedWhatsAppMessage
): void {
  console.info("[whatsapp-webhook] incoming message", {
    messageId: message.messageId,
    messageType: message.type,
    sender: maskWaId(message.waId),
    hasTextBody: Boolean(message.textBody),
    hasInteractiveReply: Boolean(message.interactiveReplyId),
  });
}
