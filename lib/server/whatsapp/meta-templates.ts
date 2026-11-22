import {
  buildMetaMessageTemplatesUrl,
  getMetaClientConfig,
  getWhatsAppBusinessAccountId,
} from "@/lib/server/whatsapp/meta-client-config";
import {
  normalizeMetaHttpFailure,
  normalizeMetaNetworkFailure,
} from "@/lib/server/whatsapp/meta-client-errors";

export type MetaTemplateButton = {
  type: string;
  text?: string;
  url?: string;
};

export type MetaTemplateComponent = {
  type: string;
  format?: string;
  text?: string;
  example?: { body_text?: string[][]; header_text?: string[] };
  buttons?: MetaTemplateButton[];
};

export type MetaMessageTemplate = {
  name: string;
  language: string;
  status: string;
  category?: string;
  components: MetaTemplateComponent[];
  rejected_reason?: string;
};

export type ListMessageTemplatesResult =
  | { ok: true; templates: MetaMessageTemplate[] }
  | {
      ok: false;
      errorCode: string;
      message: string;
      httpStatus?: number;
    };

type FetchFn = typeof fetch;

function getFetch(): FetchFn {
  const globalFetch = (globalThis as { __metaTemplateFetch?: FetchFn })
    .__metaTemplateFetch;
  if (globalFetch) return globalFetch;
  return globalThis.fetch.bind(globalThis);
}

export function setMetaTemplateFetchForTests(fetchFn: FetchFn | null): void {
  (globalThis as { __metaTemplateFetch?: FetchFn }).__metaTemplateFetch =
    fetchFn ?? undefined;
}

type GraphTemplateListResponse = {
  data?: MetaMessageTemplate[];
  paging?: { next?: string; cursors?: { after?: string } };
};

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function listApprovedMessageTemplates(): Promise<ListMessageTemplatesResult> {
  const wabaResult = getWhatsAppBusinessAccountId();
  if (!wabaResult.ok) {
    return {
      ok: false,
      errorCode: wabaResult.errorCode,
      message: wabaResult.message,
    };
  }

  const configResult = getMetaClientConfig();
  if (!configResult.ok) {
    return {
      ok: false,
      errorCode: configResult.errorCode,
      message: configResult.message,
    };
  }

  const config = configResult.config;
  const templates: MetaMessageTemplate[] = [];
  let after: string | undefined;

  try {
    for (let page = 0; page < 50; page += 1) {
      const query: Record<string, string> = {
        limit: "100",
        fields: "name,language,status,category,components",
      };
      if (after) query.after = after;

      const url = buildMetaMessageTemplatesUrl(
        config,
        wabaResult.wabaId,
        query
      );

      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        config.httpTimeoutMs
      );
      let response: Response;
      try {
        response = await getFetch()(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
          },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      const body = await parseJson(response);
      if (!response.ok) {
        const failure = normalizeMetaHttpFailure(response.status, body);
        const permissionHint =
          response.status === 403
            ? " Confirm the Meta app has whatsapp_business_management permission."
            : "";
        return {
          ok: false,
          errorCode: failure.errorCode,
          message: `Could not load templates from Meta.${permissionHint}`,
          httpStatus: response.status,
        };
      }

      const parsed = body as GraphTemplateListResponse;
      for (const row of parsed.data ?? []) {
        if (row.status === "APPROVED") {
          templates.push(row);
        }
      }

      const nextAfter = parsed.paging?.cursors?.after;
      if (!nextAfter || !parsed.paging?.next) {
        break;
      }
      after = nextAfter;
    }

    templates.sort((a, b) =>
      `${a.name}:${a.language}`.localeCompare(`${b.name}:${b.language}`)
    );

    return { ok: true, templates };
  } catch (error) {
    const failure = normalizeMetaNetworkFailure(error);
    return {
      ok: false,
      errorCode: failure.errorCode,
      message: "Could not reach Meta to load templates.",
    };
  }
}
