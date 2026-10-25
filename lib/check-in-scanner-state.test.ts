import { describe, expect, it } from "vitest";

import {
  classifyCheckInError,
  resultFromCheckInView,
  scannerReadyAfterScanNext,
  shouldPauseScannerAfterDecode,
} from "@/lib/check-in-scanner-state";

describe("check-in scanner state", () => {
  it("pauses after decode", () => {
    expect(shouldPauseScannerAfterDecode()).toBe(true);
  });

  it("resets scanner on Scan Next", () => {
    expect(scannerReadyAfterScanNext()).toEqual({
      phase: "scanning",
      lastPayload: null,
      result: null,
    });
  });

  it("classifies API errors", () => {
    const notFound = new Error("missing") as Error & { status: number; code: string };
    notFound.status = 404;
    notFound.code = "invalid_registration";
    expect(classifyCheckInError(notFound)).toBe("not_found");

    const mismatch = new Error("wrong event") as Error & { code: string };
    mismatch.code = "event_mismatch";
    expect(classifyCheckInError(mismatch)).toBe("event_mismatch");
  });

  it("maps check-in view to success or duplicate", () => {
    expect(
      resultFromCheckInView({
        id: "reg-1",
        registrationNumber: "CU-BLR-2026-00001",
        studentName: "A",
        status: "Checked In",
        eventId: "evt-001",
        eventTitle: "Event",
        alreadyCheckedIn: false,
      }).kind
    ).toBe("success");

    expect(
      resultFromCheckInView({
        id: "reg-1",
        registrationNumber: "CU-BLR-2026-00001",
        studentName: "A",
        status: "Checked In",
        eventId: "evt-001",
        eventTitle: "Event",
        alreadyCheckedIn: true,
      }).kind
    ).toBe("duplicate");
  });
});
