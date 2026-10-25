import { describe, expect, it } from "vitest";

import {
  CHECK_IN_SAME_PAYLOAD_DEBOUNCE_MS,
  countEventCheckIns,
  eventCheckInStats,
  normalizeCheckInQrPayload,
  shouldIgnoreDuplicatePayload,
} from "@/lib/check-in-scanner-utils";

describe("check-in scanner utils", () => {
  it("trims QR payload whitespace", () => {
    expect(normalizeCheckInQrPayload("  CU-BLR-2026-00042  ")).toBe(
      "CU-BLR-2026-00042"
    );
  });

  it("debounces the same payload within the window", () => {
    const now = 10_000;
    expect(
      shouldIgnoreDuplicatePayload("CU-BLR-2026-00001", now - 100, "CU-BLR-2026-00001", now)
    ).toBe(true);
    expect(
      shouldIgnoreDuplicatePayload(
        "CU-BLR-2026-00001",
        now - CHECK_IN_SAME_PAYLOAD_DEBOUNCE_MS - 1,
        "CU-BLR-2026-00001",
        now
      )
    ).toBe(false);
    expect(
      shouldIgnoreDuplicatePayload("CU-BLR-2026-00001", now, "CU-BLR-2026-00002", now)
    ).toBe(false);
  });

  it("counts checked-in registrations by status only", () => {
    const registrations = [
      { status: "Confirmed" },
      { status: "Checked In" },
      { status: "Checked In" },
      { status: "Confirmed" },
    ];
    expect(countEventCheckIns(registrations)).toBe(2);
    expect(eventCheckInStats(registrations)).toEqual({
      total: 4,
      checkedIn: 2,
      remaining: 2,
    });
  });

  it("does not increase checked-in count on duplicate status rows", () => {
    const before = countEventCheckIns([{ status: "Checked In" }]);
    const after = countEventCheckIns([
      { status: "Checked In" },
      { status: "Checked In" },
    ]);
    expect(after).toBe(before + 1);
  });
});
