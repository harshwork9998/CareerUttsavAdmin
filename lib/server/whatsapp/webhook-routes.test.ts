import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  GET as webhookGet,
  POST as webhookPost,
} from "@/app/api/integrations/whatsapp/webhook/route";
import { computeMetaWebhookSignature } from "@/lib/server/whatsapp/meta-webhook";

const TEST_VERIFY_TOKEN = "route-test-verify-token";
const TEST_APP_SECRET = "route-test-meta-app-secret";

const textMessagePayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      changes: [
        {
          value: {
            messaging_product: "whatsapp",
            messages: [
              {
                from: "919876543210",
                id: "wamid.route-test",
                timestamp: "1504902988",
                type: "text",
                text: { body: "route test" },
              },
            ],
          },
          field: "messages",
        },
      ],
    },
  ],
};

describe("whatsapp webhook route GET", () => {
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

  it("returns the challenge for a valid verification request", async () => {
    const url = new URL("http://localhost/api/integrations/whatsapp/webhook");
    url.searchParams.set("hub.mode", "subscribe");
    url.searchParams.set("hub.verify_token", TEST_VERIFY_TOKEN);
    url.searchParams.set("hub.challenge", "987654321");

    const response = await webhookGet(new Request(url));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("987654321");
  });

  it("rejects an incorrect verify token", async () => {
    const url = new URL("http://localhost/api/integrations/whatsapp/webhook");
    url.searchParams.set("hub.mode", "subscribe");
    url.searchParams.set("hub.verify_token", "wrong-token");
    url.searchParams.set("hub.challenge", "987654321");

    const response = await webhookGet(new Request(url));
    expect(response.status).toBe(403);
  });

  it("rejects missing verification parameters", async () => {
    const response = await webhookGet(
      new Request("http://localhost/api/integrations/whatsapp/webhook")
    );
    expect(response.status).toBe(403);
  });
});

describe("whatsapp webhook route POST", () => {
  const originalAppSecret = process.env.META_APP_SECRET;

  beforeEach(() => {
    process.env.META_APP_SECRET = TEST_APP_SECRET;
  });

  afterEach(() => {
    if (originalAppSecret === undefined) {
      delete process.env.META_APP_SECRET;
    } else {
      process.env.META_APP_SECRET = originalAppSecret;
    }
  });

  it("accepts a correctly signed payload", async () => {
    const rawBody = JSON.stringify(textMessagePayload);
    const response = await webhookPost(
      new Request("http://localhost/api/integrations/whatsapp/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": computeMetaWebhookSignature(
            rawBody,
            TEST_APP_SECRET
          ),
        },
        body: rawBody,
      })
    );
    expect(response.status).toBe(200);
  });

  it("rejects an incorrect signature", async () => {
    const rawBody = JSON.stringify(textMessagePayload);
    const response = await webhookPost(
      new Request("http://localhost/api/integrations/whatsapp/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": computeMetaWebhookSignature(
            rawBody,
            "different-secret"
          ),
        },
        body: rawBody,
      })
    );
    expect(response.status).toBe(403);
  });

  it("rejects a missing signature", async () => {
    const rawBody = JSON.stringify(textMessagePayload);
    const response = await webhookPost(
      new Request("http://localhost/api/integrations/whatsapp/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: rawBody,
      })
    );
    expect(response.status).toBe(403);
  });

  it("handles a text-message webhook", async () => {
    const rawBody = JSON.stringify(textMessagePayload);
    const response = await webhookPost(
      new Request("http://localhost/api/integrations/whatsapp/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": computeMetaWebhookSignature(
            rawBody,
            TEST_APP_SECRET
          ),
        },
        body: rawBody,
      })
    );
    expect(response.status).toBe(200);
  });

  it("handles a status webhook without crashing", async () => {
    const rawBody = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                statuses: [{ id: "wamid.status", status: "read" }],
              },
            },
          ],
        },
      ],
    });
    const response = await webhookPost(
      new Request("http://localhost/api/integrations/whatsapp/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": computeMetaWebhookSignature(
            rawBody,
            TEST_APP_SECRET
          ),
        },
        body: rawBody,
      })
    );
    expect(response.status).toBe(200);
  });

  it("handles unknown webhook shapes safely", async () => {
    const rawBody = JSON.stringify({ object: "page", entry: [] });
    const response = await webhookPost(
      new Request("http://localhost/api/integrations/whatsapp/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": computeMetaWebhookSignature(
            rawBody,
            TEST_APP_SECRET
          ),
        },
        body: rawBody,
      })
    );
    expect(response.status).toBe(200);
  });
});
