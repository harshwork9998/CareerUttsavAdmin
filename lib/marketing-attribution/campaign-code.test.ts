import { describe, expect, it } from "vitest";

import {
  campaignTrackingCodeKey,
  normalizeCampaignTrackingCodeInput,
  suggestCampaignTrackingCode,
  validateCampaignTrackingCode,
} from "@/lib/marketing-attribution/campaign-code";

describe("campaign tracking codes", () => {
  it("normalizes case and whitespace", () => {
    expect(normalizeCampaignTrackingCodeInput(" auto26 ")).toBe("AUTO26");
    expect(campaignTrackingCodeKey("AuTo26")).toBe("auto26");
  });

  it("accepts valid codes", () => {
    expect(validateCampaignTrackingCode("AUTO26")).toBeNull();
    expect(validateCampaignTrackingCode("BTL-26")).toBeNull();
  });

  it("rejects invalid codes", () => {
    expect(validateCampaignTrackingCode("a")).not.toBeNull();
    expect(validateCampaignTrackingCode("bad code!")).not.toBeNull();
    expect(validateCampaignTrackingCode("")).not.toBeNull();
  });

  it("suggests codes from campaign names", () => {
    expect(suggestCampaignTrackingCode("Bengaluru Auto Campaign", 2026)).toBe(
      "BENAUTO26"
    );
    expect(suggestCampaignTrackingCode("BTL Campaign", 2026)).toMatch(/BTL/);
  });
});