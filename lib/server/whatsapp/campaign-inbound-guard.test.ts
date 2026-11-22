import { describe, expect, it } from "vitest";

import { isGenericCampaignAcknowledgement } from "@/lib/server/whatsapp/campaign-inbound-guard";

describe("campaign inbound guard", () => {
  it("detects generic acknowledgements", () => {
    expect(isGenericCampaignAcknowledgement("thanks")).toBe(true);
    expect(isGenericCampaignAcknowledgement("OK")).toBe(true);
    expect(isGenericCampaignAcknowledgement("register")).toBe(false);
  });
});