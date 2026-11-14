import { afterEach, describe, expect, it } from "vitest";

import { buildCampaignTrackingUrl } from "@/lib/marketing-attribution/tracking-url";

describe("buildCampaignTrackingUrl", () => {
  afterEach(() => {
    delete process.env.MARKETING_TRACKING_SITE_URL;
  });

  it("builds ref URLs without PII", () => {
    process.env.MARKETING_TRACKING_SITE_URL = "https://careeruttsav.in";
    expect(buildCampaignTrackingUrl("AUTO26")).toBe(
      "https://careeruttsav.in/?ref=AUTO26"
    );
    expect(buildCampaignTrackingUrl("AUTO26")).not.toMatch(/@/);
  });
});