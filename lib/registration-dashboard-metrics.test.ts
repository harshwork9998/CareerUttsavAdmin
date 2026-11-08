import { describe, expect, it } from "vitest";

import {
  studentCheckInCount,
  studentRegistrationsForEvent,
} from "@/lib/registration-dashboard-metrics";
import type { Registration } from "@/types";

function registration(kind: Registration["kind"], checkedIn = false): Registration {
  return {
    id: `reg-${kind}`,
    eventId: "evt-001",
    kind,
    status: checkedIn ? "Checked In" : "Confirmed",
    registrationNumber: "CU-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as unknown as Registration;
}

describe("event dashboard registration metrics", () => {
  it("counts only student registrations", () => {
    const rows = [
      registration("student"),
      registration("student"),
      registration("partner_registration"),
      registration("school"),
      registration("student_ambassador"),
    ];
    expect(studentRegistrationsForEvent(rows)).toHaveLength(2);
  });

  it("counts check-ins for students only", () => {
    const rows = [
      registration("student", true),
      registration("student", false),
      registration("partner_registration", true),
    ];
    expect(studentCheckInCount(rows)).toBe(1);
  });
});
