import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  REGISTRATION_BOARD_OPTIONS,
  REGISTRATION_CLASS_OPTIONS,
  REGISTRATION_STREAM_OPTIONS,
  WHATSAPP_GENDER_OPTIONS,
} from "@/lib/server/whatsapp/registration-options";
import {
  boardInteractiveId,
  classInteractiveId,
  genderInteractiveId,
  seminarInteractiveId,
  streamInteractiveId,
} from "@/lib/server/whatsapp/registration-interactive-ids";
import {
  dispatchWhatsAppBotActionToMeta,
  validateWhatsAppButtonAction,
  validateWhatsAppListAction,
} from "@/lib/server/whatsapp/meta-action-mapper";
import type { WhatsAppBotAction } from "@/lib/server/whatsapp/registration-conversation";
import {
  setMetaClientFetchForTests,
} from "@/lib/server/whatsapp/meta-client";

const TEST_RECIPIENT = "919876543210";

function mockJsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("meta action mapper validation", () => {
  it("rejects more than three button options", () => {
    const action: WhatsAppBotAction = {
      type: "BUTTONS",
      body: "Too many",
      buttons: [
        { id: "a", title: "A" },
        { id: "b", title: "B" },
        { id: "c", title: "C" },
        { id: "d", title: "D" },
      ],
    };
    const result = validateWhatsAppButtonAction(action);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorCode).toBe("META_BUTTONS_LIMIT_EXCEEDED");
  });

  it("validates class list rows with stable interactive IDs", () => {
    const action: WhatsAppBotAction = {
      type: "LIST",
      body: "Please select your class.",
      buttonText: "Select Class",
      sections: [
        {
          title: "Class",
          rows: REGISTRATION_CLASS_OPTIONS.map((classLabel) => ({
            id: classInteractiveId(classLabel),
            title: classLabel,
          })),
        },
      ],
    };
    expect(validateWhatsAppListAction(action)).toEqual({ ok: true });
    if (action.type !== "LIST") return;
    expect(action.sections[0].rows[0].id).toBe("class:Class 9");
  });

  it("validates board list rows with stable interactive IDs", () => {
    const action: WhatsAppBotAction = {
      type: "LIST",
      body: "Please select your board.",
      buttonText: "Select Board",
      sections: [
        {
          title: "Board",
          rows: REGISTRATION_BOARD_OPTIONS.map((board) => ({
            id: boardInteractiveId(board),
            title: board,
          })),
        },
      ],
    };
    expect(validateWhatsAppListAction(action)).toEqual({ ok: true });
    if (action.type !== "LIST") return;
    expect(action.sections[0].rows[0].id).toBe("board:CBSE");
  });

  it("uses seminar IDs for seminar list rows", () => {
    const action: WhatsAppBotAction = {
      type: "LIST",
      body: "Choose a seminar interest.",
      buttonText: "Select Seminar",
      sections: [
        {
          title: "Seminars",
          rows: [
            { id: seminarInteractiveId("sem-001"), title: "AI Careers" },
            { id: seminarInteractiveId("sem-002"), title: "Design Thinking" },
          ],
        },
      ],
    };
    expect(validateWhatsAppListAction(action)).toEqual({ ok: true });
    if (action.type !== "LIST") return;
    expect(action.sections[0].rows[0].id).toBe("seminar:sem-001");
  });
});

describe("meta action mapper dispatch", () => {
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

  it("dispatches gender buttons without creating a list", async () => {
    const fetchMock = vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.interactive.type).toBe("button");
      expect(body.interactive.action.buttons).toHaveLength(
        WHATSAPP_GENDER_OPTIONS.length
      );
      return mockJsonResponse(200, {
        messages: [{ id: "wamid.gender" }],
      });
    });
    setMetaClientFetchForTests(fetchMock as typeof fetch);

    const result = await dispatchWhatsAppBotActionToMeta(TEST_RECIPIENT, {
      type: "BUTTONS",
      body: "Please select your gender.",
      buttons: WHATSAPP_GENDER_OPTIONS.map((gender) => ({
        id: genderInteractiveId(gender),
        title: gender,
      })),
    });

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("dispatches stream buttons with three options", async () => {
    const fetchMock = vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.interactive.action.buttons).toHaveLength(
        REGISTRATION_STREAM_OPTIONS.length
      );
      return mockJsonResponse(200, {
        messages: [{ id: "wamid.stream" }],
      });
    });
    setMetaClientFetchForTests(fetchMock as typeof fetch);

    const result = await dispatchWhatsAppBotActionToMeta(TEST_RECIPIENT, {
      type: "BUTTONS",
      body: "Please select your stream / interest.",
      buttons: REGISTRATION_STREAM_OPTIONS.map((stream) => ({
        id: streamInteractiveId(stream),
        title: stream,
      })),
    });

    expect(result.success).toBe(true);
  });

  it("uploads QR media then sends the image message", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url, init) => {
      calls.push(String(url));
      if (String(url).endsWith("/media")) {
        return mockJsonResponse(200, { id: "media-qr-001" });
      }
      const body = JSON.parse(String(init?.body));
      expect(body.type).toBe("image");
      expect(body.image.id).toBe("media-qr-001");
      return mockJsonResponse(200, {
        messages: [{ id: "wamid.qr-image" }],
      });
    });
    setMetaClientFetchForTests(fetchMock as typeof fetch);

    const qrBase64 = Buffer.from("same-qr-png").toString("base64");
    const result = await dispatchWhatsAppBotActionToMeta(TEST_RECIPIENT, {
      type: "MEDIA",
      mimeType: "image/png",
      filename: "registration-qr.png",
      contentBase64: qrBase64,
      caption: "Your Career Uttsav entry QR code",
    });

    expect(result.success).toBe(true);
    expect(result.mediaId).toBe("media-qr-001");
    expect(calls.some((url) => url.endsWith("/media"))).toBe(true);
    expect(calls.some((url) => url.endsWith("/messages"))).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not dispatch invalid button actions to Meta", async () => {
    const fetchMock = vi.fn();
    setMetaClientFetchForTests(fetchMock as typeof fetch);

    const result = await dispatchWhatsAppBotActionToMeta(TEST_RECIPIENT, {
      type: "BUTTONS",
      body: "Too many",
      buttons: [
        { id: "1", title: "One" },
        { id: "2", title: "Two" },
        { id: "3", title: "Three" },
        { id: "4", title: "Four" },
      ],
    });

    expect(result).toMatchObject({
      success: false,
      errorCode: "META_BUTTONS_LIMIT_EXCEEDED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
