import { RegistrationStatus } from "@/lib/generated/prisma/client";
import { describe, expect, it } from "vitest";

import {
  compareExistingRegistration,
  computeRequiredCounterValues,
  reconcileCounters,
  reconcileEventCounters,
  validateFinalSnapshotDuplicates,
  type DbRegistrationRecord,
} from "@/lib/server/registration-reconciliation";
import type { MappedRegistration } from "@/scripts/lib/registration-prisma-import-map";
import type { Registration } from "@/types";

function baseMapped(overrides: Partial<MappedRegistration> = {}): MappedRegistration {
  return {
    id: "reg-1",
    registrationNumber: "CU-BLR-2026-00001",
    kind: "student",
    eventId: "evt-001",
    eventTitle: "Career Uttsav Bengaluru 2026",
    status: RegistrationStatus.Confirmed,
    paymentStatus: "Waived",
    registeredAt: new Date("2026-01-01T10:00:00.000Z"),
    updatedAt: new Date("2026-01-01T10:00:00.000Z"),
    amount: null,
    checkInTime: null,
    studentName: "Student",
    email: "student@example.com",
    phone: "+91 98765 43210",
    parentPhone: null,
    college: "School",
    classLabel: null,
    interestedStream: null,
    board: null,
    gender: null,
    city: "Bengaluru",
    state: "Karnataka",
    course: null,
    year: null,
    emailNormalized: "student@example.com",
    phoneLast10: "9876543210",
    schoolContactName: null,
    schoolName: null,
    schoolCity: null,
    schoolContactNumber: null,
    schoolContactEmail: null,
    partnerRegContactName: null,
    partnerRegInstitutionName: null,
    partnerRegCity: null,
    partnerRegContactNumber: null,
    partnerRegContactEmail: null,
    ambassadorName: null,
    ambassadorClass: null,
    ambassadorSchoolCollege: null,
    ambassadorAge: null,
    ambassadorPhone: null,
    ambassadorEmail: null,
    ...overrides,
  };
}

describe("registration reconciliation", () => {
  it("detects duplicate ids in final snapshot", () => {
    const registrations = [
      { id: "reg-1", registrationNumber: "CU-BLR-2026-00001" },
      { id: "reg-1", registrationNumber: "CU-BLR-2026-00002" },
    ] as Registration[];

    const conflicts = validateFinalSnapshotDuplicates(registrations);
    expect(conflicts.some((conflict) => conflict.code === "duplicate_id")).toBe(
      true
    );
  });

  it("treats matching existing records as equal", () => {
    const mapped = baseMapped();
    const dbRecord: DbRegistrationRecord = {
      registration: baseMapped(),
      seminarTitles: ["Seminar A"],
    };

    expect(
      compareExistingRegistration(mapped, dbRecord, ["Seminar A"])
    ).toEqual([]);
  });

  it("never decreases counter proposals", () => {
    const required = computeRequiredCounterValues([
      {
        id: "reg-1",
        registrationNumber: "CU-BLR-2026-00014",
      } as Registration,
    ]);

    const rows = reconcileCounters(
      required,
      new Map([["CU-BLR-2026-", 15]])
    );

    expect(rows[0]).toMatchObject({
      prefix: "CU-BLR-2026-",
      currentNextValue: 15,
      requiredNextValue: 15,
      proposedNextValue: 15,
      changed: false,
    });
  });

  it("raises counter proposals when snapshot requires a higher next value", () => {
    const required = computeRequiredCounterValues([
      {
        id: "reg-1",
        registrationNumber: "CU-BLR-2026-00020",
      } as Registration,
    ]);

    const rows = reconcileCounters(
      required,
      new Map([["CU-BLR-2026-", 15]])
    );

    expect(rows[0]).toMatchObject({
      proposedNextValue: 21,
      changed: true,
    });
  });

  it("uses final JSON event counters as proposed values", () => {
    const eventCounters = reconcileEventCounters(8429, 0, 8435, 2);
    expect(eventCounters.registrationCount).toMatchObject({
      current: 8429,
      finalJson: 8435,
      proposed: 8435,
      changed: true,
    });
    expect(eventCounters.checkInCount).toMatchObject({
      current: 0,
      finalJson: 2,
      proposed: 2,
      changed: true,
    });
  });
});
