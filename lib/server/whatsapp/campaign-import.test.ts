import { describe, expect, it } from "vitest";

import {
  detectMobileColumn,
  parseContactsFromMatrix,
} from "@/lib/server/whatsapp/campaign-import";

describe("campaign contact import", () => {
  it("detects a mobile column by common names", () => {
    expect(detectMobileColumn(["Name", "mobile", "City"])).toBe("mobile");
    expect(detectMobileColumn(["Phone Number", "Email"])).toBe("Phone Number");
  });

  it("normalizes Indian numbers and removes duplicates", () => {
    const result = parseContactsFromMatrix({
      headers: ["mobile", "name"],
      rows: [
        ["9876543210", "A"],
        ["+91 9876543210", "Dup"],
        ["919876543211", "B"],
        ["invalid", "C"],
      ],
      mobileColumn: "mobile",
      optedOutLast10: new Set(),
    });

    expect(result.accepted).toHaveLength(2);
    expect(result.accepted[0]?.waId).toBe("919876543210");
    expect(result.accepted[1]?.waId).toBe("919876543211");
    expect(result.duplicateCount).toBe(1);
    expect(result.invalidCount).toBe(1);
  });

  it("skips opted-out numbers", () => {
    const result = parseContactsFromMatrix({
      headers: ["mobile"],
      rows: [["9876543210"]],
      mobileColumn: "mobile",
      optedOutLast10: new Set(["9876543210"]),
    });
    expect(result.accepted).toHaveLength(0);
    expect(result.skipped[0]?.reason).toBe("On opt-out list");
  });
});