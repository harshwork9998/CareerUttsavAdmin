import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  assertWhatsAppCampaignLiveSendAllowed,
  isWhatsAppCampaignLiveSendEnabled,
} from "@/lib/server/whatsapp/campaign-live-send";

describe("campaign live send gate", () => {
  beforeEach(() => {
    delete process.env.WHATSAPP_CAMPAIGN_DRY_RUN;
    delete process.env.WHATSAPP_CAMPAIGN_ALLOW_LIVE_SEND;
  });

  afterEach(() => {
    delete process.env.WHATSAPP_CAMPAIGN_DRY_RUN;
    delete process.env.WHATSAPP_CAMPAIGN_ALLOW_LIVE_SEND;
  });

  it("blocks live sends unless explicitly enabled", () => {
    expect(isWhatsAppCampaignLiveSendEnabled()).toBe(false);
    expect(() => assertWhatsAppCampaignLiveSendAllowed()).toThrow();
  });

  it("allows dry-run without live approval", () => {
    process.env.WHATSAPP_CAMPAIGN_DRY_RUN = "true";
    expect(() => assertWhatsAppCampaignLiveSendAllowed()).not.toThrow();
  });

  it("allows live sends when dry-run is off and approval is set", () => {
    process.env.WHATSAPP_CAMPAIGN_ALLOW_LIVE_SEND = "true";
    expect(isWhatsAppCampaignLiveSendEnabled()).toBe(true);
    expect(() => assertWhatsAppCampaignLiveSendAllowed()).not.toThrow();
  });
});