import type {
  PartnerRegistrationEntry,
  Registration,
  RegistrationKind,
  SchoolRegistration,
  StudentAmbassadorRegistration,
  StudentRegistration,
} from "@/types";

export const REGISTRATION_KINDS = [
  "student",
  "school",
  "partner_registration",
  "student_ambassador",
] as const satisfies readonly RegistrationKind[];

export const REGISTRATION_KIND_LABELS: Record<RegistrationKind, string> = {
  student: "Student Registration",
  school: "School Registration",
  partner_registration: "Partner Registration",
  student_ambassador: "Student Ambassador Registration",
};

export const REGISTRATION_KIND_SHORT_LABELS: Record<RegistrationKind, string> = {
  student: "Students",
  school: "Schools",
  partner_registration: "Partners",
  student_ambassador: "Ambassadors",
};

export function isStudentRegistration(
  registration: Registration
): registration is StudentRegistration {
  return registration.kind === "student";
}

export function isSchoolRegistration(
  registration: Registration
): registration is SchoolRegistration {
  return registration.kind === "school";
}

export function isPartnerRegistrationEntry(
  registration: Registration
): registration is PartnerRegistrationEntry {
  return registration.kind === "partner_registration";
}

export function isStudentAmbassadorRegistration(
  registration: Registration
): registration is StudentAmbassadorRegistration {
  return registration.kind === "student_ambassador";
}

export function filterRegistrationsByKind<K extends RegistrationKind>(
  registrations: Registration[],
  kind: K
): Extract<Registration, { kind: K }>[] {
  return registrations.filter(
    (registration): registration is Extract<Registration, { kind: K }> =>
      registration.kind === kind
  );
}

/** Legacy rows saved before `kind` existed — treat as student registration. */
export function migrateLegacyRegistration(
  raw: Record<string, unknown>
): Registration {
  if (
    raw.kind === "student" ||
    raw.kind === "school" ||
    raw.kind === "partner_registration" ||
    raw.kind === "student_ambassador"
  ) {
    return raw as unknown as Registration;
  }

  return {
    id: String(raw.id ?? ""),
    registrationNumber: String(raw.registrationNumber ?? ""),
    kind: "student",
    eventId: String(raw.eventId ?? ""),
    eventTitle: String(raw.eventTitle ?? ""),
    status: (raw.status as StudentRegistration["status"]) ?? "Confirmed",
    paymentStatus:
      (raw.paymentStatus as StudentRegistration["paymentStatus"]) ?? "Waived",
    registeredAt: String(raw.registeredAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
    amount: typeof raw.amount === "number" ? raw.amount : 0,
    checkInTime:
      typeof raw.checkInTime === "string" ? raw.checkInTime : undefined,
    studentName: String(raw.studentName ?? ""),
    email: String(raw.email ?? ""),
    phone: String(raw.phone ?? ""),
    parentPhone:
      typeof raw.parentPhone === "string" ? raw.parentPhone : undefined,
    college: String(raw.college ?? ""),
    classLabel:
      typeof raw.classLabel === "string" ? raw.classLabel : undefined,
    interestedStream:
      typeof raw.interestedStream === "string"
        ? raw.interestedStream
        : undefined,
    board: typeof raw.board === "string" ? raw.board : undefined,
    gender: raw.gender as StudentRegistration["gender"],
    city: String(raw.city ?? ""),
    state: String(raw.state ?? ""),
    seminarInterests: Array.isArray(raw.seminarInterests)
      ? raw.seminarInterests.map(String)
      : undefined,
    course: typeof raw.course === "string" ? raw.course : undefined,
    year: raw.year as StudentRegistration["year"],
  };
}
