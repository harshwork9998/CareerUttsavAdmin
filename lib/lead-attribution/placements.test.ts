import { describe, expect, it } from "vitest";

import {
  LEAD_ATTRIBUTION_PLACEMENTS,
  normalizeLeadAttributionTrackingCode,
} from "@/lib/lead-attribution/placements";
import {
  matchLeadAttributionWhatsAppIntro,
  resolveActiveLeadAttribution,
} from "@/lib/lead-attribution/resolve";

describe("lead attribution placements", () => {
  it("defines the three overhead marketing placements", () => {
    expect(LEAD_ATTRIBUTION_PLACEMENTS.map((p) => p.trackingCode).sort()).toEqual(
      ["AUTO-IN26", "AUTO-OUT26", "CABS26"].sort()
    );
    const sources = new Set(LEAD_ATTRIBUTION_PLACEMENTS.map((p) => p.leadSource));
    expect(sources).toEqual(new Set(["Overhead Marketing"]));
  });

  it("normalizes tracking codes case-insensitively", () => {
    expect(normalizeLeadAttributionTrackingCode(" auto-in26 ")).toBe("AUTO-IN26");
    expect(resolveActiveLeadAttribution("auto-in26")?.leadSubSource).toBe(
      "Auto (Inside)"
    );
  });

  it("rejects unknown or inactive codes without throwing", () => {
    expect(resolveActiveLeadAttribution("UNKNOWN99")).toBeNull();
    expect(resolveActiveLeadAttribution("")).toBeNull();
  });

  it("matches WhatsApp intro messages exactly", () => {
    const intro = LEAD_ATTRIBUTION_PLACEMENTS[1]!.whatsappIntroMessage;
    const match = matchLeadAttributionWhatsAppIntro(intro);
    expect(match?.trackingCode).toBe("AUTO-OUT26");
    expect(matchLeadAttributionWhatsAppIntro("Hi")).toBeNull();
    expect(matchLeadAttributionWhatsAppIntro(intro + " ")?.trackingCode).toBe(
      "AUTO-OUT26"
    );
  });

  it("uses unique WhatsApp prefills", () => {
    const intros = LEAD_ATTRIBUTION_PLACEMENTS.map((p) => p.whatsappIntroMessage);
    expect(new Set(intros).size).toBe(intros.length);
  });
});