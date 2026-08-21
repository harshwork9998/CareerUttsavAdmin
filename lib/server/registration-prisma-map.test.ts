import { Prisma } from "@/lib/generated/prisma/client";
import { RegistrationStatus as PrismaRegistrationStatus } from "@/lib/generated/prisma/client";
import { describe, expect, it } from "vitest";

import {
  mapPrismaRegistrationToApi,
  mapPrismaStatusToApi,
  studentNormalizedFields,
} from "@/lib/server/registration-prisma-map";
import type { PrismaRegistrationRecord } from "@/lib/server/registration-prisma-map";

function baseRecord(
  overrides: Partial<PrismaRegistrationRecord> = {}
): PrismaRegistrationRecord {
  return {
    id: "reg-1",
    registrationNumber: "CU-BLR-2026-00001",
    kind: "student",
    eventId: "evt-001",
    eventTitle: "Career Uttsav Bangalore",
    status: PrismaRegistrationStatus.Confirmed,
    paymentStatus: "Waived",
    registeredAt: new Date("2026-01-01T10:00:00.000Z"),
    updatedAt: new Date("2026-01-01T10:00:00.000Z"),
    amount: new Prisma.Decimal("0.00"),
    checkInTime: null,
    studentName: "Test Student",
    email: "student@example.com",
    phone: "+91 98765 43210",
    parentPhone: null,
    college: "Example School",
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
    registrationSeminars: [
      {
        id: "rsem-1",
        registrationId: "reg-1",
        seminarId: "sem-1",
        seminarTitle: "Engineering Pathways",
      },
    ],
    ...overrides,
  };
}

describe("registration prisma map", () => {
  it("maps CheckedIn to Checked In and decimals to numbers", () => {
    const record = baseRecord({
      status: PrismaRegistrationStatus.CheckedIn,
      amount: new Prisma.Decimal("250.50"),
    });

    const api = mapPrismaRegistrationToApi(record);
    expect(api.status).toBe("Checked In");
    expect(api.amount).toBe(250.5);
    expect(mapPrismaStatusToApi(PrismaRegistrationStatus.CheckedIn)).toBe(
      "Checked In"
    );
  });

  it("maps seminar relations to seminarInterests titles", () => {
    const api = mapPrismaRegistrationToApi(baseRecord());
    expect(api.kind).toBe("student");
    if (api.kind === "student") {
      expect(api.seminarInterests).toEqual(["Engineering Pathways"]);
      expect(api.classLabel).toBeUndefined();
    }
  });

  it("normalizes student email and phone", () => {
    expect(
      studentNormalizedFields({
        email: " Student@Example.COM ",
        phone: "+91 98765 43210",
      })
    ).toEqual({
      emailNormalized: "student@example.com",
      phoneLast10: "9876543210",
    });
  });
});
