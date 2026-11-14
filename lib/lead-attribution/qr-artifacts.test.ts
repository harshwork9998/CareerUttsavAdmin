import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildLeadAttributionTrackingUrl,
  LEAD_ATTRIBUTION_PLACEMENTS,
} from "@/lib/lead-attribution/placements";

describe("lead attribution QR artifacts", () => {
  it("maps each active placement to the homepage ref URL", () => {
    for (const placement of LEAD_ATTRIBUTION_PLACEMENTS) {
      expect(buildLeadAttributionTrackingUrl(placement.trackingCode)).toBe(
        `https://careeruttsav.in/?ref=${placement.trackingCode}`
      );
    }
  });

  it("has matching PNG files when generated locally", () => {
    const outDir = join(process.cwd(), "lead-attribution-qr");
    for (const placement of LEAD_ATTRIBUTION_PLACEMENTS) {
      const file = join(outDir, `${placement.trackingCode}.png`);
      expect(existsSync(file)).toBe(true);
    }
  });
});