import { describe, expect, it } from "vitest";

import { validateCampaignPdfBuffer } from "@/lib/server/whatsapp/campaign-header-document";

describe("validateCampaignPdfBuffer", () => {
  it("accepts a minimal pdf", () => {
    const buffer = Buffer.from("%PDF-1.4\n%fake\n");
    expect(validateCampaignPdfBuffer(buffer, "notice.pdf")).toBeNull();
  });

  it("rejects non-pdf bytes", () => {
    const buffer = Buffer.from("not-a-pdf");
    expect(validateCampaignPdfBuffer(buffer, "notice.pdf")).toContain("Only PDF");
  });
});