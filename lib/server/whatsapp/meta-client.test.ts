import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildMetaMediaUrl,
  buildMetaMessagesUrl,
  getMetaClientConfig,
} from "@/lib/server/whatsapp/meta-client-config";
import {
  sendWhatsAppButtons,
  sendWhatsAppImage,
  sendWhatsAppList,
  sendWhatsAppText,
  setMetaClientFetchForTests,
  uploadWhatsAppMedia,
} from "@/lib/server/whatsapp/meta-client";

const TEST_ACCESS_TOKEN = "test-access-token-local-only";
const TEST_PHONE_NUMBER_ID = "123456789012345";
const TEST_GRAPH_VERSION = "v22.0";
const TEST_RECIPIENT = "919876543210";

function mockJsonResponse(
  status: number,
  body: unknown,
  init?: { ok?: boolean }
): Response {
  return {
    ok: init?.ok ?? (status >= 200 && status < 300),
    status,
    json: async () => body,
  } as Response;
}

function captureFetch(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(handler);
  setMetaClientFetchForTests(fetchMock as typeof fetch);
  return fetchMock;
}

describe("meta client configuration", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.WHATSAPP_ACCESS_TOKEN = TEST_ACCESS_TOKEN;
    process.env.WHATSAPP_PHONE_NUMBER_ID = TEST_PHONE_NUMBER_ID;
    process.env.WHATSAPP_GRAPH_API_VERSION = TEST_GRAPH_VERSION;
    delete process.env.WHATSAPP_HTTP_TIMEOUT_MS;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    setMetaClientFetchForTests(null);
    vi.restoreAllMocks();
  });

  it("builds the messages URL from configuration", () => {
    const config = getMetaClientConfig();
    expect(config.ok).toBe(true);
    if (!config.ok) return;
    expect(buildMetaMessagesUrl(config.config)).toBe(
      `https://graph.facebook.com/${TEST_GRAPH_VERSION}/${TEST_PHONE_NUMBER_ID}/messages`
    );
  });

  it("builds the media URL from configuration", () => {
    const config = getMetaClientConfig();
    expect(config.ok).toBe(true);
    if (!config.ok) return;
    expect(buildMetaMediaUrl(config.config)).toBe(
      `https://graph.facebook.com/${TEST_GRAPH_VERSION}/${TEST_PHONE_NUMBER_ID}/media`
    );
  });

  it("fails safely when outbound configuration is missing", async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    const result = await sendWhatsAppText({
      to: TEST_RECIPIENT,
      text: "hello",
    });
    expect(result).toEqual({
      success: false,
      errorCode: "META_CLIENT_NOT_CONFIGURED",
      retryable: false,
    });
  });

  it("requires WHATSAPP_GRAPH_API_VERSION when outbound credentials are set", async () => {
    delete process.env.WHATSAPP_GRAPH_API_VERSION;

    const config = getMetaClientConfig();
    expect(config).toEqual({
      ok: false,
      errorCode: "META_GRAPH_API_VERSION_REQUIRED",
      message:
        "WHATSAPP_GRAPH_API_VERSION is required when WhatsApp outbound messaging is enabled",
    });

    const result = await sendWhatsAppText({
      to: TEST_RECIPIENT,
      text: "hello",
    });
    expect(result).toEqual({
      success: false,
      errorCode: "META_GRAPH_API_VERSION_REQUIRED",
      retryable: false,
    });
  });
});

describe("meta client outbound requests", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.WHATSAPP_ACCESS_TOKEN = TEST_ACCESS_TOKEN;
    process.env.WHATSAPP_PHONE_NUMBER_ID = TEST_PHONE_NUMBER_ID;
    process.env.WHATSAPP_GRAPH_API_VERSION = TEST_GRAPH_VERSION;
    process.env.WHATSAPP_HTTP_TIMEOUT_MS = "5000";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    setMetaClientFetchForTests(null);
    vi.restoreAllMocks();
  });

  it("sendWhatsAppText builds the correct URL and payload", async () => {
    const fetchMock = captureFetch(async (url, init) => {
      expect(String(url)).toBe(
        `https://graph.facebook.com/${TEST_GRAPH_VERSION}/${TEST_PHONE_NUMBER_ID}/messages`
      );
      expect(init?.method).toBe("POST");
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe(`Bearer ${TEST_ACCESS_TOKEN}`);
      expect(headers.get("Content-Type")).toBe("application/json");
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: TEST_RECIPIENT,
        type: "text",
        text: { body: "Hello student" },
      });
      return mockJsonResponse(200, {
        messages: [{ id: "wamid.outbound-text" }],
      });
    });

    const result = await sendWhatsAppText({
      to: TEST_RECIPIENT,
      text: "Hello student",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result).toEqual({
      success: true,
      messageId: "wamid.outbound-text",
    });
  });

  it("never logs the access token", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    captureFetch(async () =>
      mockJsonResponse(401, {
        error: { message: "Invalid OAuth access token", code: 190 },
      })
    );

    await sendWhatsAppText({ to: TEST_RECIPIENT, text: "hello" });

    const logs = JSON.stringify([...warnSpy.mock.calls, ...infoSpy.mock.calls]);
    expect(logs).not.toContain(TEST_ACCESS_TOKEN);
    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it("extracts wamid from a successful text response", async () => {
    captureFetch(async () =>
      mockJsonResponse(200, {
        messages: [{ id: "wamid.success" }],
      })
    );

    const result = await sendWhatsAppText({
      to: TEST_RECIPIENT,
      text: "ok",
    });
    expect(result).toEqual({ success: true, messageId: "wamid.success" });
  });

  it("normalizes Meta 4xx failures safely", async () => {
    captureFetch(async () =>
      mockJsonResponse(400, {
        error: { message: "bad request", code: 100, error_subcode: 33 },
      })
    );

    const result = await sendWhatsAppText({
      to: TEST_RECIPIENT,
      text: "bad",
    });
    expect(result).toMatchObject({
      success: false,
      errorCode: "META_CLIENT_ERROR",
      retryable: false,
      httpStatus: 400,
      metaErrorCode: 100,
      metaErrorSubcode: 33,
    });
    expect(JSON.stringify(result)).not.toContain(TEST_ACCESS_TOKEN);
  });

  it("marks Meta 5xx failures as retryable", async () => {
    captureFetch(async () =>
      mockJsonResponse(503, {
        error: { message: "service unavailable", code: 2 },
      })
    );

    const result = await sendWhatsAppText({
      to: TEST_RECIPIENT,
      text: "retry",
    });
    expect(result).toMatchObject({
      success: false,
      errorCode: "META_SERVER_ERROR",
      retryable: true,
      httpStatus: 503,
      metaErrorCode: 2,
    });
  });

  it("handles network errors", async () => {
    captureFetch(async () => {
      throw new TypeError("fetch failed");
    });

    const result = await sendWhatsAppText({
      to: TEST_RECIPIENT,
      text: "network",
    });
    expect(result).toEqual({
      success: false,
      errorCode: "META_NETWORK_ERROR",
      retryable: true,
    });
  });

  it("handles request timeouts", async () => {
    process.env.WHATSAPP_HTTP_TIMEOUT_MS = "25";

    captureFetch((_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) {
          reject(new Error("missing abort signal"));
          return;
        }
        signal.addEventListener("abort", () => {
          const error = new Error("Aborted");
          error.name = "AbortError";
          reject(error);
        });
      })
    );

    const result = await sendWhatsAppText({
      to: TEST_RECIPIENT,
      text: "timeout",
    });
    expect(result).toEqual({
      success: false,
      errorCode: "META_REQUEST_TIMEOUT",
      retryable: true,
    });
  });

  it("sendWhatsAppButtons sends exactly two reply buttons for gender", async () => {
    captureFetch(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.interactive.type).toBe("button");
      expect(body.interactive.action.buttons).toHaveLength(2);
      expect(body.interactive.action.buttons[0].reply).toEqual({
        id: "gender:male",
        title: "Male",
      });
      expect(body.interactive.action.buttons[1].reply).toEqual({
        id: "gender:female",
        title: "Female",
      });
      return mockJsonResponse(200, {
        messages: [{ id: "wamid.buttons" }],
      });
    });

    const result = await sendWhatsAppButtons({
      to: TEST_RECIPIENT,
      body: "Select your gender",
      buttons: [
        { id: "gender:male", title: "Male" },
        { id: "gender:female", title: "Female" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("sendWhatsAppButtons sends exactly three reply buttons for stream", async () => {
    captureFetch(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.interactive.action.buttons).toHaveLength(3);
      return mockJsonResponse(200, {
        messages: [{ id: "wamid.stream" }],
      });
    });

    const result = await sendWhatsAppButtons({
      to: TEST_RECIPIENT,
      body: "Select stream",
      buttons: [
        { id: "stream:science", title: "Science" },
        { id: "stream:commerce", title: "Commerce" },
        { id: "stream:arts", title: "Arts" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("sendWhatsAppList preserves stable interactive row IDs", async () => {
    captureFetch(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.interactive.type).toBe("list");
      expect(body.interactive.action.sections[0].rows[0]).toEqual({
        id: "class:Class 10",
        title: "Class 10",
      });
      return mockJsonResponse(200, {
        messages: [{ id: "wamid.list" }],
      });
    });

    const result = await sendWhatsAppList({
      to: TEST_RECIPIENT,
      body: "Select class",
      buttonText: "Select Class",
      sections: [
        {
          title: "Class",
          rows: [{ id: "class:Class 10", title: "Class 10" }],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("uploadWhatsAppMedia decodes base64 and posts multipart to /media", async () => {
    const pngBytes = Buffer.from("fake-png-bytes");
    const base64 = pngBytes.toString("base64");

    captureFetch(async (url, init) => {
      expect(String(url)).toContain("/media");
      expect(init?.method).toBe("POST");
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe(`Bearer ${TEST_ACCESS_TOKEN}`);
      expect(init?.body).toBeInstanceOf(FormData);
      const form = init?.body as FormData;
      expect(form.get("messaging_product")).toBe("whatsapp");
      const file = form.get("file");
      expect(file).toBeInstanceOf(Blob);
      return mockJsonResponse(200, { id: "media-qr-001" });
    });

    const result = await uploadWhatsAppMedia({
      mimeType: "image/png",
      filename: "registration-qr.png",
      contentBase64: base64,
    });
    expect(result).toEqual({ success: true, mediaId: "media-qr-001" });
  });

  it("sendWhatsAppImage sends by returned media ID", async () => {
    captureFetch(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({
        to: TEST_RECIPIENT,
        type: "image",
        image: {
          id: "media-qr-001",
          caption: "Your Career Uttsav entry QR code",
        },
      });
      return mockJsonResponse(200, {
        messages: [{ id: "wamid.image" }],
      });
    });

    const result = await sendWhatsAppImage({
      to: TEST_RECIPIENT,
      mediaId: "media-qr-001",
      caption: "Your Career Uttsav entry QR code",
    });
    expect(result).toEqual({ success: true, messageId: "wamid.image" });
  });
});
