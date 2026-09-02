import {
  buildMetaMediaUrl,
  buildMetaMessagesUrl,
  getMetaClientConfig,
  type MetaClientConfig,
} from "@/lib/server/whatsapp/meta-client-config";
import {
  extractMetaErrorCode,
  normalizeMetaHttpFailure,
  normalizeMetaNetworkFailure,
  type NormalizedMetaError,
} from "@/lib/server/whatsapp/meta-client-errors";
import { maskWaId } from "@/lib/server/whatsapp/meta-webhook";

export type MetaSendSuccess = {
  success: true;
  messageId: string;
};

export type MetaSendFailure = {
  success: false;
} & NormalizedMetaError;

export type MetaSendResult = MetaSendSuccess | MetaSendFailure;

export type MetaMediaUploadSuccess = {
  success: true;
  mediaId: string;
};

export type MetaMediaUploadFailure = {
  success: false;
} & NormalizedMetaError;

export type MetaMediaUploadResult = MetaMediaUploadSuccess | MetaMediaUploadFailure;

export type SendWhatsAppTextInput = {
  to: string;
  text: string;
};

export type SendWhatsAppButtonsInput = {
  to: string;
  body: string;
  buttons: Array<{ id: string; title: string }>;
};

export type SendWhatsAppListInput = {
  to: string;
  body: string;
  buttonText: string;
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
};

export type UploadWhatsAppMediaInput = {
  mimeType: string;
  filename: string;
  contentBase64: string;
};

export type SendWhatsAppImageInput = {
  to: string;
  mediaId: string;
  caption?: string;
};

export type SendWhatsAppTemplateBodyParameter = {
  parameterName: string;
  text: string;
};

export type SendWhatsAppTemplateInput = {
  to: string;
  templateName: string;
  languageCode: string;
  bodyParameters?: SendWhatsAppTemplateBodyParameter[];
};

type FetchFn = typeof fetch;

let customFetch: FetchFn | null = null;

export function setMetaClientFetchForTests(fetchFn: FetchFn | null): void {
  customFetch = fetchFn;
}

function getFetch(): FetchFn {
  return customFetch ?? globalThis.fetch.bind(globalThis);
}

function normalizeRecipient(to: string): string {
  return to.replace(/\D/g, "");
}

type MetaMessagesResponse = {
  messages?: Array<{ id?: string }>;
};

type MetaMediaResponse = {
  id?: string;
};

async function parseJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractMessageId(body: unknown): string | null {
  const messages = (body as MetaMessagesResponse).messages;
  const messageId = messages?.[0]?.id;
  return typeof messageId === "string" && messageId.length > 0 ? messageId : null;
}

function extractMediaId(body: unknown): string | null {
  const mediaId = (body as MetaMediaResponse).id;
  return typeof mediaId === "string" && mediaId.length > 0 ? mediaId : null;
}

async function metaGraphRequest(input: {
  config: MetaClientConfig;
  url: string;
  init: RequestInit;
  actionType: string;
  recipient: string;
}): Promise<
  | { ok: true; body: unknown }
  | { ok: false; failure: MetaSendFailure }
> {
  const recipient = normalizeRecipient(input.recipient);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      input.config.httpTimeoutMs
    );

    let response: Response;
    try {
      response = await getFetch()(input.url, {
        ...input.init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const body = await parseJsonBody(response);

    if (!response.ok) {
      const failure = normalizeMetaHttpFailure(response.status, body);
      safeLogMetaOutboundFailure({
        actionType: input.actionType,
        recipient,
        httpStatus: failure.httpStatus,
        metaErrorCode: failure.metaErrorCode,
        errorCode: failure.errorCode,
      });
      return { ok: false, failure: { success: false, ...failure } };
    }

    return { ok: true, body };
  } catch (error) {
    const failure = normalizeMetaNetworkFailure(error);
    safeLogMetaOutboundFailure({
      actionType: input.actionType,
      recipient,
      errorCode: failure.errorCode,
    });
    return { ok: false, failure: { success: false, ...failure } };
  }
}

function safeLogMetaOutboundSuccess(input: {
  actionType: string;
  recipient: string;
  messageId?: string;
  mediaId?: string;
}): void {
  console.info("[whatsapp-meta] outbound success", {
    actionType: input.actionType,
    recipient: maskWaId(input.recipient),
    messageId: input.messageId,
    mediaId: input.mediaId,
  });
}

function safeLogMetaOutboundFailure(input: {
  actionType: string;
  recipient: string;
  errorCode: string;
  httpStatus?: number;
  metaErrorCode?: number;
}): void {
  console.warn("[whatsapp-meta] outbound failure", {
    actionType: input.actionType,
    recipient: maskWaId(input.recipient),
    errorCode: input.errorCode,
    httpStatus: input.httpStatus,
    metaErrorCode: input.metaErrorCode,
  });
}

async function sendMetaMessagePayload(input: {
  config: MetaClientConfig;
  to: string;
  payload: Record<string, unknown>;
  actionType: string;
}): Promise<MetaSendResult> {
  const result = await metaGraphRequest({
    config: input.config,
    url: buildMetaMessagesUrl(input.config),
    recipient: input.to,
    actionType: input.actionType,
    init: {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input.payload),
    },
  });

  if (!result.ok) {
    return result.failure;
  }

  const messageId = extractMessageId(result.body);
  if (!messageId) {
    const failure: MetaSendFailure = {
      success: false,
      errorCode: "META_INVALID_RESPONSE",
      retryable: false,
    };
    safeLogMetaOutboundFailure({
      actionType: input.actionType,
      recipient: input.to,
      errorCode: failure.errorCode,
    });
    return failure;
  }

  safeLogMetaOutboundSuccess({
    actionType: input.actionType,
    recipient: input.to,
    messageId,
  });
  return { success: true, messageId };
}

function buildBaseMessagePayload(to: string): Record<string, unknown> {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizeRecipient(to),
  };
}

export async function sendWhatsAppText(
  input: SendWhatsAppTextInput
): Promise<MetaSendResult> {
  const configResult = getMetaClientConfig();
  if (!configResult.ok) {
    return {
      success: false,
      errorCode: configResult.errorCode,
      retryable: false,
    };
  }

  return sendMetaMessagePayload({
    config: configResult.config,
    to: input.to,
    actionType: "TEXT",
    payload: {
      ...buildBaseMessagePayload(input.to),
      type: "text",
      text: { body: input.text },
    },
  });
}

export async function sendWhatsAppButtons(
  input: SendWhatsAppButtonsInput
): Promise<MetaSendResult> {
  const configResult = getMetaClientConfig();
  if (!configResult.ok) {
    return {
      success: false,
      errorCode: configResult.errorCode,
      retryable: false,
    };
  }

  return sendMetaMessagePayload({
    config: configResult.config,
    to: input.to,
    actionType: "BUTTONS",
    payload: {
      ...buildBaseMessagePayload(input.to),
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: input.body },
        action: {
          buttons: input.buttons.map((button) => ({
            type: "reply",
            reply: {
              id: button.id,
              title: button.title,
            },
          })),
        },
      },
    },
  });
}

export async function sendWhatsAppList(
  input: SendWhatsAppListInput
): Promise<MetaSendResult> {
  const configResult = getMetaClientConfig();
  if (!configResult.ok) {
    return {
      success: false,
      errorCode: configResult.errorCode,
      retryable: false,
    };
  }

  return sendMetaMessagePayload({
    config: configResult.config,
    to: input.to,
    actionType: "LIST",
    payload: {
      ...buildBaseMessagePayload(input.to),
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: input.body },
        action: {
          button: input.buttonText,
          sections: input.sections.map((section) => ({
            title: section.title,
            rows: section.rows.map((row) => ({
              id: row.id,
              title: row.title,
              ...(row.description ? { description: row.description } : {}),
            })),
          })),
        },
      },
    },
  });
}

export async function uploadWhatsAppMedia(
  input: UploadWhatsAppMediaInput
): Promise<MetaMediaUploadResult> {
  const configResult = getMetaClientConfig();
  if (!configResult.ok) {
    return {
      success: false,
      errorCode: configResult.errorCode,
      retryable: false,
    };
  }

  const config = configResult.config;
  const bytes = Buffer.from(input.contentBase64, "base64");
  const formData = new FormData();
  formData.append("messaging_product", "whatsapp");
  formData.append(
    "file",
    new Blob([bytes], { type: input.mimeType }),
    input.filename
  );

  const result = await metaGraphRequest({
    config,
    url: buildMetaMediaUrl(config),
    recipient: "media-upload",
    actionType: "MEDIA_UPLOAD",
    init: {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: formData,
    },
  });

  if (!result.ok) {
    return result.failure;
  }

  const mediaId = extractMediaId(result.body);
  if (!mediaId) {
    const failure: MetaMediaUploadFailure = {
      success: false,
      errorCode: "META_INVALID_RESPONSE",
      retryable: false,
    };
    safeLogMetaOutboundFailure({
      actionType: "MEDIA_UPLOAD",
      recipient: "media-upload",
      errorCode: failure.errorCode,
    });
    return failure;
  }

  safeLogMetaOutboundSuccess({
    actionType: "MEDIA_UPLOAD",
    recipient: "media-upload",
    mediaId,
  });
  return { success: true, mediaId };
}

export async function sendWhatsAppImage(
  input: SendWhatsAppImageInput
): Promise<MetaSendResult> {
  const configResult = getMetaClientConfig();
  if (!configResult.ok) {
    return {
      success: false,
      errorCode: configResult.errorCode,
      retryable: false,
    };
  }

  return sendMetaMessagePayload({
    config: configResult.config,
    to: input.to,
    actionType: "IMAGE",
    payload: {
      ...buildBaseMessagePayload(input.to),
      type: "image",
      image: {
        id: input.mediaId,
        ...(input.caption ? { caption: input.caption } : {}),
      },
    },
  });
}

export async function sendWhatsAppTemplate(
  input: SendWhatsAppTemplateInput
): Promise<MetaSendResult> {
  const configResult = getMetaClientConfig();
  if (!configResult.ok) {
    return {
      success: false,
      errorCode: configResult.errorCode,
      retryable: false,
    };
  }

  const components =
    input.bodyParameters && input.bodyParameters.length > 0
      ? [
          {
            type: "body",
            parameters: input.bodyParameters.map((parameter) => ({
              type: "text",
              parameter_name: parameter.parameterName,
              text: parameter.text,
            })),
          },
        ]
      : undefined;

  return sendMetaMessagePayload({
    config: configResult.config,
    to: input.to,
    actionType: "TEMPLATE",
    payload: {
      ...buildBaseMessagePayload(input.to),
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.languageCode },
        ...(components ? { components } : {}),
      },
    },
  });
}

export { extractMetaErrorCode };
