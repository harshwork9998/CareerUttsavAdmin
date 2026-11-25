import { afterEach, describe, expect, it, vi } from "vitest";

import { validateWhatsAppLocationAction } from "@/lib/server/whatsapp/meta-action-mapper";
import { dispatchWhatsAppBotActionToMeta } from "@/lib/server/whatsapp/meta-action-mapper";
import { setMetaClientFetchForTests } from "@/lib/server/whatsapp/meta-client";
import {
  WHATSAPP_EVENT_VENUE_ADDRESS,
  WHATSAPP_EVENT_VENUE_CONFIG,
  WHATSAPP_EVENT_VENUE_LATITUDE,
  WHATSAPP_EVENT_VENUE_LONGITUDE,
  WHATSAPP_EVENT_VENUE_NAME,
  buildWhatsAppEventVenueLocationAction,
  isWhatsAppEventVenueLocationEnabled,
} from "@/lib/server/whatsapp/whatsapp-event-venue-location";
import {
  buildWhatsAppRegistrationPassFollowUpActions,
  buildWhatsAppRegistrationSuccessActions,
} from "@/lib/server/whatsapp/whatsapp-registration-bot-actions";

describe("whatsapp event venue location", () => {
  afterEach(() => {
    delete process.env.WHATSAPP_EVENT_VENUE_OPERATOR_CONFIRMED;
  });

  it("keeps operator confirmation off by default", () => {
    delete process.env.WHATSAPP_EVENT_VENUE_OPERATOR_CONFIRMED;
    expect(WHATSAPP_EVENT_VENUE_CONFIG.operatorConfirmed).toBe(false);
    expect(isWhatsAppEventVenueLocationEnabled()).toBe(false);
    expect(buildWhatsAppRegistrationPassFollowUpActions().map((a) => a.type)).toEqual([
      "TEXT",
    ]);
  });

  it("uses the canonical venue name and address", () => {
    process.env.WHATSAPP_EVENT_VENUE_OPERATOR_CONFIRMED = "true";
    const action = buildWhatsAppEventVenueLocationAction();
    expect(action).toMatchObject({
      type: "LOCATION",
      latitude: WHATSAPP_EVENT_VENUE_LATITUDE,
      longitude: WHATSAPP_EVENT_VENUE_LONGITUDE,
      name: WHATSAPP_EVENT_VENUE_NAME,
      address: WHATSAPP_EVENT_VENUE_ADDRESS,
    });
    expect(WHATSAPP_EVENT_VENUE_ADDRESS).toContain("Gate No. 9");
  });

  it("validates native location actions before send", () => {
    const action = buildWhatsAppEventVenueLocationAction();
    expect(validateWhatsAppLocationAction(action)).toEqual({ ok: true });
  });

  it("orders QR media before location follow-up messages", () => {
    process.env.WHATSAPP_EVENT_VENUE_OPERATOR_CONFIRMED = "true";
    const actions = buildWhatsAppRegistrationSuccessActions({
      registrationNumber: "CU-BLR-2026-00042",
      qrPngBase64: Buffer.from("qr").toString("base64"),
    });
    const types = actions.map((action) => action.type);
    const mediaIndex = types.indexOf("MEDIA");
    const locationIndex = types.indexOf("LOCATION");
    expect(mediaIndex).toBeGreaterThanOrEqual(0);
    expect(locationIndex).toBe(mediaIndex + 1);
    expect(buildWhatsAppRegistrationPassFollowUpActions().map((a) => a.type)).toEqual([
      "LOCATION",
      "TEXT",
      "TEXT",
    ]);
  });

  afterEach(() => {
    setMetaClientFetchForTests(null);
    vi.restoreAllMocks();
  });

  it("maps location to the Meta Cloud API location payload", async () => {
    process.env.WHATSAPP_EVENT_VENUE_OPERATOR_CONFIRMED = "true";
    process.env.WHATSAPP_ACCESS_TOKEN = "test-access-token-local-only";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789012345";
    process.env.WHATSAPP_GRAPH_API_VERSION = "v22.0";

    const fetchMock = vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.type).toBe("location");
      expect(body.location).toEqual({
        latitude: WHATSAPP_EVENT_VENUE_LATITUDE,
        longitude: WHATSAPP_EVENT_VENUE_LONGITUDE,
        name: WHATSAPP_EVENT_VENUE_NAME,
        address: WHATSAPP_EVENT_VENUE_ADDRESS,
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({ messages: [{ id: "wamid.location" }] }),
      } as Response;
    });
    setMetaClientFetchForTests(fetchMock as typeof fetch);

  const action = buildWhatsAppEventVenueLocationAction();
    const result = await dispatchWhatsAppBotActionToMeta("919876543210", action);
    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});