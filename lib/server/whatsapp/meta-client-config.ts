export const DEFAULT_WHATSAPP_HTTP_TIMEOUT_MS = 15_000;

export type MetaClientConfig = {
  accessToken: string;
  phoneNumberId: string;
  graphApiVersion: string;
  httpTimeoutMs: number;
};

export type MetaClientConfigResult =
  | { ok: true; config: MetaClientConfig }
  | {
      ok: false;
      errorCode:
        | "META_CLIENT_NOT_CONFIGURED"
        | "META_GRAPH_API_VERSION_REQUIRED";
      message: string;
    };

function parseHttpTimeoutMs(): number {
  const raw = process.env.WHATSAPP_HTTP_TIMEOUT_MS?.trim();
  if (!raw) {
    return DEFAULT_WHATSAPP_HTTP_TIMEOUT_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_WHATSAPP_HTTP_TIMEOUT_MS;
  }
  return parsed;
}

export function getMetaClientConfig(): MetaClientConfigResult {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const graphApiVersion = process.env.WHATSAPP_GRAPH_API_VERSION?.trim();

  if (!accessToken || !phoneNumberId) {
    return {
      ok: false,
      errorCode: "META_CLIENT_NOT_CONFIGURED",
      message: "WhatsApp outbound messaging is not configured",
    };
  }

  if (!graphApiVersion) {
    return {
      ok: false,
      errorCode: "META_GRAPH_API_VERSION_REQUIRED",
      message:
        "WHATSAPP_GRAPH_API_VERSION is required when WhatsApp outbound messaging is enabled",
    };
  }

  return {
    ok: true,
    config: {
      accessToken,
      phoneNumberId,
      graphApiVersion,
      httpTimeoutMs: parseHttpTimeoutMs(),
    },
  };
}

export function buildMetaMessagesUrl(config: MetaClientConfig): string {
  return `https://graph.facebook.com/${config.graphApiVersion}/${config.phoneNumberId}/messages`;
}

export function buildMetaMediaUrl(config: MetaClientConfig): string {
  return `https://graph.facebook.com/${config.graphApiVersion}/${config.phoneNumberId}/media`;
}

export type WhatsAppBusinessAccountConfigResult =
  | { ok: true; wabaId: string }
  | {
      ok: false;
      errorCode: "WHATSAPP_BUSINESS_ACCOUNT_ID_NOT_CONFIGURED";
      message: string;
    };

export function getWhatsAppBusinessAccountId(): WhatsAppBusinessAccountConfigResult {
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim();
  if (!wabaId) {
    return {
      ok: false,
      errorCode: "WHATSAPP_BUSINESS_ACCOUNT_ID_NOT_CONFIGURED",
      message:
        "Add WHATSAPP_BUSINESS_ACCOUNT_ID to server configuration to load approved templates from Meta.",
    };
  }
  return { ok: true, wabaId };
}

export function buildMetaMessageTemplatesUrl(
  config: MetaClientConfig,
  wabaId: string,
  query?: Record<string, string>
): string {
  const params = new URLSearchParams(query);
  const qs = params.toString();
  return `https://graph.facebook.com/${config.graphApiVersion}/${wabaId}/message_templates${qs ? `?${qs}` : ""}`;
}
