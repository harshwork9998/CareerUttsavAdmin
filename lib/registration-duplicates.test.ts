import { describe, expect, it } from "vitest";

import {
  findStudentRegistrationByEmail,
  findStudentRegistrationByPhone,
  findStudentRegistrationDuplicate,
  resolveStudentRegistrationDuplicateResolution,
} from "@/lib/registration-duplicates";
import type { StudentRegistration } from "@/types";

const eventId = "evt-001";

function studentRegistration(
  overrides: Partial<StudentRegistration> & Pick<StudentRegistration, "id">
): StudentRegistration {
  return {
    id: overrides.id,
    kind: "student",
    registrationNumber: overrides.registrationNumber ?? "CU-BLR-2026-00001",
    eventId: overrides.eventId ?? eventId,
    eventTitle: "Career Uttsav",
    status: "Confirmed",
    paymentStatus: "Waived",
    amount: 0,
    registeredAt: "2026-08-23T10:00:00.000Z",
    updatedAt: "2026-08-23T10:00:00.000Z",
    studentName: overrides.studentName ?? "Aarav Sharma",
    email: overrides.email ?? "aarav@example.com",
    phone: overrides.phone ?? "9876543210",
    college: "School",
    classLabel: "Class 10",
    interestedStream: "Science",
    board: "CBSE",
    gender: "Male",
    city: "Bangalore",
    state: "Karnataka",
    seminarInterests: [],
  };
}

describe("registration duplicate resolution", () => {
  const phoneRegistration = studentRegistration({
    id: "reg-phone",
    email: "phone@example.com",
    phone: "9876543210",
    registrationNumber: "CU-BLR-2026-00001",
  });
  const emailRegistration = studentRegistration({
    id: "reg-email",
    email: "shared@example.com",
    phone: "9000000000",
    registrationNumber: "CU-BLR-2026-00002",
  });

  it("resolves same registration when phone and email match one record", () => {
    const resolution = resolveStudentRegistrationDuplicateResolution(
      phoneRegistration,
      phoneRegistration
    );
    expect(resolution).toEqual({
      outcome: "both",
      registration: phoneRegistration,
    });
  });

  it("resolves phone-only matches", () => {
    const resolution = resolveStudentRegistrationDuplicateResolution(
      phoneRegistration,
      null
    );
    expect(resolution).toEqual({
      outcome: "phone",
      registration: phoneRegistration,
    });
  });

  it("resolves email-only matches", () => {
    const resolution = resolveStudentRegistrationDuplicateResolution(
      null,
      emailRegistration
    );
    expect(resolution).toEqual({
      outcome: "email",
      registration: emailRegistration,
    });
  });

  it("resolves conflicting phone and email matches deterministically", () => {
    const resolution = resolveStudentRegistrationDuplicateResolution(
      phoneRegistration,
      emailRegistration
    );
    expect(resolution).toEqual({ outcome: "conflict" });
  });

  it("looks up phone and email separately without OR ordering", () => {
    const registrations = [phoneRegistration, emailRegistration];
    const phoneMatch = findStudentRegistrationByPhone(registrations, {
      eventId,
      phone: "9876543210",
    });
    const emailMatch = findStudentRegistrationByEmail(registrations, {
      eventId,
      email: "shared@example.com",
    });
    expect(phoneMatch?.id).toBe("reg-phone");
    expect(emailMatch?.id).toBe("reg-email");
  });

  it("returns phone registration for legacy duplicate lookup on conflict", () => {
    const duplicate = findStudentRegistrationDuplicate(
      [phoneRegistration, emailRegistration],
      {
        eventId,
        phone: "9876543210",
        email: "shared@example.com",
      }
    );
    expect(duplicate?.id).toBe("reg-phone");
  });
});
