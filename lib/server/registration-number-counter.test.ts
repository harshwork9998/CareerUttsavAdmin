import { describe, expect, it } from "vitest";

import {
  formatRegistrationNumber,
  registrationCounterPrefix,
} from "@/lib/server/registration-number-counter";

describe("registration number counter helpers", () => {
  it("uses Bangalore prefixes for new registrations", () => {
    expect(registrationCounterPrefix("student")).toBe("CU-BLR-2026-");
    expect(registrationCounterPrefix("school")).toBe("CU-SCH-BLR-2026-");
    expect(registrationCounterPrefix("partner_registration")).toBe(
      "CU-PTR-BLR-2026-"
    );
    expect(registrationCounterPrefix("student_ambassador")).toBe(
      "CU-AMB-BLR-2026-"
    );
  });

  it("formats five-digit sequence values", () => {
    expect(formatRegistrationNumber("CU-BLR-2026-", 15)).toBe(
      "CU-BLR-2026-00015"
    );
  });
});
