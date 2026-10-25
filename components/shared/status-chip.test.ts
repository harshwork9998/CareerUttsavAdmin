import { describe, expect, it } from "vitest";

import { getVariantForStatus } from "@/components/shared/status-chip";

describe("StatusChip registration statuses", () => {
  it("maps Confirmed and Checked In to success styling", () => {
    expect(getVariantForStatus("Confirmed")).toBe("success");
    expect(getVariantForStatus("Checked In")).toBe("success");
  });
});
