import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  listApprovedMessageTemplates,
  setMetaTemplateFetchForTests,
} from "@/lib/server/whatsapp/meta-templates";

describe("listApprovedMessageTemplates", () => {
  beforeEach(() => {
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = "123456789";
    process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "phone-id";
    process.env.WHATSAPP_GRAPH_API_VERSION = "v22.0";
  });

  afterEach(() => {
    setMetaTemplateFetchForTests(null);
    delete process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_GRAPH_API_VERSION;
  });

  it("returns WABA configuration error when account id is missing", async () => {
    delete process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    const result = await listApprovedMessageTemplates();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("WHATSAPP_BUSINESS_ACCOUNT_ID_NOT_CONFIGURED");
    }
  });

  it("paginates approved templates", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes("after=page2")) {
        return new Response(
          JSON.stringify({
            data: [
              { name: "a", language: "en", status: "APPROVED", components: [] },
              { name: "b", language: "en", status: "DRAFT", components: [] },
            ],
            paging: {
              cursors: { after: "page2" },
              next: "https://graph.facebook.com/next",
            },
          }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({
          data: [
            { name: "c", language: "hi", status: "APPROVED", components: [] },
          ],
        }),
        { status: 200 }
      );
    });
    setMetaTemplateFetchForTests(fetchMock);

    const result = await listApprovedMessageTemplates();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.templates.map((t) => t.name)).toEqual(["a", "c"]);
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});