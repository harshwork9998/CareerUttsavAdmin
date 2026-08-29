import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildWhatsAppRegistrationSuccessActions } from "@/lib/server/whatsapp/whatsapp-registration-bot-actions";
import { dispatchWhatsAppBotActions } from "@/lib/server/whatsapp/whatsapp-bot-dispatcher";
import { setMetaClientFetchForTests } from "@/lib/server/whatsapp/meta-client";

const WA_ID = "919876543210";
const REGISTRATION_PHONE = "9876543210";

function mockJsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("whatsapp bot dispatcher", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.WHATSAPP_ACCESS_TOKEN = "test-access-token-local-only";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789012345";
    process.env.WHATSAPP_GRAPH_API_VERSION = "v22.0";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    setMetaClientFetchForTests(null);
    vi.restoreAllMocks();
  });

  it("dispatches success text before QR media", async () => {
    const actionTypes: string[] = [];
    const fetchMock = vi.fn(async (url, init) => {
      if (String(url).endsWith("/media")) {
        actionTypes.push("MEDIA_UPLOAD");
        return mockJsonResponse(200, { id: "media-qr-001" });
      }
      const body = JSON.parse(String(init?.body));
      actionTypes.push(body.type);
      return mockJsonResponse(200, {
        messages: [{ id: `wamid.${actionTypes.length}` }],
      });
    });
    setMetaClientFetchForTests(fetchMock as typeof fetch);

    const actions = buildWhatsAppRegistrationSuccessActions({
      registrationNumber: "CU-BLR-2026-00042",
      qrPngBase64: Buffer.from("same-qr-png").toString("base64"),
    });

    const summary = await dispatchWhatsAppBotActions(WA_ID, actions);

    expect(summary.dispatched).toBe(3);
    expect(summary.failed).toBe(0);
    expect(actionTypes).toEqual(["text", "text", "MEDIA_UPLOAD", "image"]);
  });

  it("uses waId international digits as the Meta recipient", async () => {
    const fetchMock = vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.to).toBe(WA_ID);
      expect(body.to).not.toBe(REGISTRATION_PHONE);
      return mockJsonResponse(200, {
        messages: [{ id: "wamid.recipient" }],
      });
    });
    setMetaClientFetchForTests(fetchMock as typeof fetch);

    await dispatchWhatsAppBotActions(WA_ID, [
      { type: "TEXT", body: "hello" },
    ]);

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("continues dispatching after a text failure without throwing", async () => {
    let messageCall = 0;
    const fetchMock = vi.fn(async (url) => {
      if (String(url).endsWith("/media")) {
        return mockJsonResponse(200, { id: "media-qr-001" });
      }
      messageCall += 1;
      if (messageCall === 1) {
        return mockJsonResponse(500, {
          error: { message: "temporary failure", code: 2 },
        });
      }
      return mockJsonResponse(200, {
        messages: [{ id: "wamid.image" }],
      });
    });
    setMetaClientFetchForTests(fetchMock as typeof fetch);

    const actions = buildWhatsAppRegistrationSuccessActions({
      registrationNumber: "CU-BLR-2026-00042",
      qrPngBase64: Buffer.from("same-qr-png").toString("base64"),
    });

    const summary = await dispatchWhatsAppBotActions(WA_ID, actions);
    expect(summary.failed).toBe(1);
    expect(summary.dispatched).toBe(2);
    expect(summary.results[0].success).toBe(false);
    expect(summary.results[1].success).toBe(true);
    expect(summary.results[2].success).toBe(true);
  });

  it("fails safely when outbound configuration is missing", async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    const fetchMock = vi.fn();
    setMetaClientFetchForTests(fetchMock as typeof fetch);

    const summary = await dispatchWhatsAppBotActions(WA_ID, [
      { type: "TEXT", body: "hello" },
    ]);

    expect(summary.failed).toBe(1);
    expect(summary.results[0]).toMatchObject({
      success: false,
      errorCode: "META_CLIENT_NOT_CONFIGURED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
