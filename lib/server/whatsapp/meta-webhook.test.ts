import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  computeMetaWebhookSignature,
  extractNormalizedWhatsAppMessages,
  handleMetaWebhookVerification,
  maskWaId,
  parseMetaWebhookPayload,
  safeLogIncomingWhatsAppMessage,
  verifyMetaWebhookSignature,
} from "@/lib/server/whatsapp/meta-webhook";

const TEST_VERIFY_TOKEN = "test-verify-token-local-only";
const TEST_APP_SECRET = "test-meta-app-secret-local-only";

const textMessagePayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "WABA_ID",
      changes: [
        {
          value: {
            messaging_product: "whatsapp",
            messages: [
              {
                from: "16315551181",
                id: "wamid.HBgLMTYzMTU1NTExODEVAgARGBI5QTNDQjJBNDMwODlFMDFDRDJDAA==",
                timestamp: "1504902988",
                type: "text",
                text: { body: "hello there" },
              },
            ],
          },
          field: "messages",
        },
      ],
    },
  ],
};

const statusPayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      changes: [
        {
          value: {
            messaging_product: "whatsapp",
            statuses: [
              {
                id: "wamid.HBgLMTYzMTU1NTExODEVAgARGBI5QTNDQjJBNDMwODlFMDFDRDJDAA==",
                status: "delivered",
                timestamp: "1504902988",
                recipient_id: "16315551181",
              },
            ],
          },
          field: "messages",
        },
      ],
    },
  ],
};

describe("meta webhook verification", () => {
  const originalVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  beforeEach(() => {
    process.env.WHATSAPP_VERIFY_TOKEN = TEST_VERIFY_TOKEN;
  });

  afterEach(() => {
    if (originalVerifyToken === undefined) {
      delete process.env.WHATSAPP_VERIFY_TOKEN;
    } else {
      process.env.WHATSAPP_VERIFY_TOKEN = originalVerifyToken;
    }
  });

  it("accepts a valid subscribe challenge", () => {
    const result = handleMetaWebhookVerification({
      mode: "subscribe",
      verifyToken: TEST_VERIFY_TOKEN,
      challenge: "1234567890",
    });
    expect(result).toEqual({ ok: true, challenge: "1234567890" });
  });

  it("rejects an incorrect verify token", () => {
    const result = handleMetaWebhookVerification({
      mode: "subscribe",
      verifyToken: "wrong-token",
      challenge: "1234567890",
    });
    expect(result).toEqual({ ok: false });
  });

  it("rejects missing parameters", () => {
    expect(
      handleMetaWebhookVerification({
        mode: null,
        verifyToken: TEST_VERIFY_TOKEN,
        challenge: "1234567890",
      })
    ).toEqual({ ok: false });
    expect(
      handleMetaWebhookVerification({
        mode: "subscribe",
        verifyToken: null,
        challenge: "1234567890",
      })
    ).toEqual({ ok: false });
    expect(
      handleMetaWebhookVerification({
        mode: "subscribe",
        verifyToken: TEST_VERIFY_TOKEN,
        challenge: null,
      })
    ).toEqual({ ok: false });
  });
});

describe("meta webhook signature verification", () => {
  it("accepts a correctly signed payload", () => {
    const rawBody = JSON.stringify(textMessagePayload);
    const signature = computeMetaWebhookSignature(rawBody, TEST_APP_SECRET);
    expect(verifyMetaWebhookSignature(rawBody, signature, TEST_APP_SECRET)).toBe(
      true
    );
  });

  it("rejects an incorrect signature", () => {
    const rawBody = JSON.stringify(textMessagePayload);
    const badSignature = computeMetaWebhookSignature(rawBody, "different-secret");
    expect(
      verifyMetaWebhookSignature(rawBody, badSignature, TEST_APP_SECRET)
    ).toBe(false);
  });

  it("rejects a missing signature", () => {
    const rawBody = JSON.stringify(textMessagePayload);
    expect(verifyMetaWebhookSignature(rawBody, null, TEST_APP_SECRET)).toBe(
      false
    );
  });

  it("does not expose secrets in verification failures", () => {
    const rawBody = JSON.stringify(textMessagePayload);
    const signature = computeMetaWebhookSignature(rawBody, TEST_APP_SECRET);
    const result = verifyMetaWebhookSignature(
      rawBody,
      signature,
      "another-secret"
    );
    expect(result).toBe(false);
    expect(String(result)).not.toContain(TEST_APP_SECRET);
    expect(String(result)).not.toContain("another-secret");
  });
});

describe("meta webhook payload handling", () => {
  it("normalizes a text message webhook", () => {
    const payload = parseMetaWebhookPayload(JSON.stringify(textMessagePayload));
    expect(payload).not.toBeNull();
    const messages = extractNormalizedWhatsAppMessages(payload!);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      messageId: expect.stringContaining("wamid."),
      waId: "16315551181",
      type: "text",
      textBody: "hello there",
    });
  });

  it("handles a status webhook without crashing", () => {
    const payload = parseMetaWebhookPayload(JSON.stringify(statusPayload));
    expect(payload).not.toBeNull();
    const messages = extractNormalizedWhatsAppMessages(payload!);
    expect(messages).toHaveLength(0);
  });

  it("handles unknown webhook shapes safely", () => {
    const payload = parseMetaWebhookPayload(
      JSON.stringify({ object: "unknown", entry: [{ changes: [{}] }] })
    );
    expect(payload).not.toBeNull();
    expect(extractNormalizedWhatsAppMessages(payload!)).toEqual([]);
  });

  it("masks sender identifiers for safe logging", () => {
    expect(maskWaId("16315551181")).toBe("****1181");
  });
});

describe("safeLogIncomingWhatsAppMessage", () => {
  it("logs only non-sensitive fields", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const payload = parseMetaWebhookPayload(JSON.stringify(textMessagePayload))!;
    const message = extractNormalizedWhatsAppMessages(payload)[0]!;
    safeLogIncomingWhatsAppMessage(message);

    expect(infoSpy).toHaveBeenCalledOnce();
    const logArgs = infoSpy.mock.calls[0]!;
    expect(logArgs[1]).toMatchObject({
      messageId: expect.any(String),
      messageType: "text",
      sender: "****1181",
      hasTextBody: true,
    });
    expect(JSON.stringify(logArgs)).not.toContain("hello there");
    expect(JSON.stringify(logArgs)).not.toContain("16315551181");

    infoSpy.mockRestore();
  });
});

describe("computeMetaWebhookSignature", () => {
  it("matches Meta HMAC SHA-256 format", () => {
    const rawBody = '{"hello":"world"}';
    const expected = `sha256=${createHmac("sha256", TEST_APP_SECRET)
      .update(rawBody)
      .digest("hex")}`;
    expect(computeMetaWebhookSignature(rawBody, TEST_APP_SECRET)).toBe(expected);
  });
});
