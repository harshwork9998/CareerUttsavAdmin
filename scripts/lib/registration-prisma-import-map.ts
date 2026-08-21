/**
 * Prisma mapping helpers shared by registration migration scripts.
 */
import { Prisma, RegistrationStatus } from "../../lib/generated/prisma/client";
import type { Gender, PaymentStatus, RegistrationKind } from "../../lib/generated/prisma/client";
import {
  normalizeRegistrationEmail,
  normalizeRegistrationPhone,
} from "../../lib/registration-duplicates";
import { normalizeSeminarInterests } from "../../lib/registration-validation";
import type {
  Registration,
  StudentAmbassadorRegistration,
  StudentRegistration,
} from "../../types";
import { isNonEmptyString, nullableString } from "./registration-import-shared";

export type MappedRegistration = Prisma.RegistrationCreateManyInput;
export type MappedRegistrationSeminar = Prisma.RegistrationSeminarCreateManyInput;

export function parseDate(value: string, fieldName: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${fieldName} for registration`);
  }
  return date;
}

export function mapRegistrationStatus(status: string): RegistrationStatus {
  if (status === "Checked In") {
    return RegistrationStatus.CheckedIn;
  }
  if (status === "Confirmed") {
    return RegistrationStatus.Confirmed;
  }
  throw new Error(`Unsupported registration status: ${status}`);
}

export function mapPaymentStatus(status: string): PaymentStatus {
  if (status === "Paid" || status === "Pending" || status === "Waived") {
    return status;
  }
  throw new Error(`Unsupported payment status: ${status}`);
}

function mapGender(value: string | undefined): Gender | null {
  if (!isNonEmptyString(value)) return null;
  if (value === "Male" || value === "Female" || value === "Other") {
    return value;
  }
  throw new Error(`Unsupported gender: ${value}`);
}

export function buildSeminarRows(
  student: StudentRegistration,
  seminarTitleToId: Map<string, string>
): MappedRegistrationSeminar[] {
  const interests = student.seminarInterests ?? [];
  if (interests.length === 0) return [];

  const canonicalTitles = normalizeSeminarInterests(interests);
  const rows: MappedRegistrationSeminar[] = [];

  for (const [index, canonicalTitle] of canonicalTitles.entries()) {
    const originalTitle =
      interests
        .map((title) => title.trim())
        .find(
          (title) =>
            title.length > 0 &&
            normalizeSeminarInterests([title])[0] === canonicalTitle
        ) ?? canonicalTitle;

    rows.push({
      id: `rsem-${student.id}-${index + 1}`,
      registrationId: student.id,
      seminarId: seminarTitleToId.get(originalTitle) ?? null,
      seminarTitle: originalTitle,
    });
  }

  return rows;
}

export function mapStudentRegistration(
  registration: StudentRegistration
): MappedRegistration {
  const emailNormalized = normalizeRegistrationEmail(registration.email);
  const phoneLast10 = normalizeRegistrationPhone(registration.phone);

  return {
    id: registration.id,
    registrationNumber: registration.registrationNumber,
    kind: "student",
    eventId: registration.eventId,
    eventTitle: registration.eventTitle,
    status: mapRegistrationStatus(registration.status),
    paymentStatus: mapPaymentStatus(registration.paymentStatus),
    registeredAt: parseDate(registration.registeredAt, "registeredAt"),
    updatedAt: parseDate(registration.updatedAt, "updatedAt"),
    amount:
      registration.amount === undefined || registration.amount === null
        ? null
        : new Prisma.Decimal(registration.amount),
    checkInTime: registration.checkInTime
      ? parseDate(registration.checkInTime, "checkInTime")
      : null,
    studentName: nullableString(registration.studentName),
    email: nullableString(registration.email),
    phone: nullableString(registration.phone),
    parentPhone: nullableString(registration.parentPhone),
    college: nullableString(registration.college),
    classLabel: nullableString(registration.classLabel),
    interestedStream: nullableString(registration.interestedStream),
    board: nullableString(registration.board),
    gender: mapGender(registration.gender),
    city: nullableString(registration.city),
    state: nullableString(registration.state),
    course: nullableString(registration.course),
    year: nullableString(registration.year),
    emailNormalized: emailNormalized.length > 0 ? emailNormalized : null,
    phoneLast10: phoneLast10.length >= 10 ? phoneLast10 : null,
  };
}

export function mapRegistration(registration: Registration): MappedRegistration {
  if (registration.kind === "student") {
    return mapStudentRegistration(registration);
  }

  const base = {
    id: registration.id,
    registrationNumber: registration.registrationNumber,
    kind: registration.kind as RegistrationKind,
    eventId: registration.eventId,
    eventTitle: registration.eventTitle,
    status: mapRegistrationStatus(registration.status),
    paymentStatus: mapPaymentStatus(registration.paymentStatus),
    registeredAt: parseDate(registration.registeredAt, "registeredAt"),
    updatedAt: parseDate(registration.updatedAt, "updatedAt"),
    amount:
      registration.amount === undefined || registration.amount === null
        ? null
        : new Prisma.Decimal(registration.amount),
    checkInTime: registration.checkInTime
      ? parseDate(registration.checkInTime, "checkInTime")
      : null,
    emailNormalized: null,
    phoneLast10: null,
  };

  if (registration.kind === "school") {
    return {
      ...base,
      schoolContactName: nullableString(registration.schoolContactName),
      schoolName: nullableString(registration.schoolName),
      schoolCity: nullableString(registration.schoolCity),
      schoolContactNumber: nullableString(registration.schoolContactNumber),
      schoolContactEmail: nullableString(registration.schoolContactEmail),
    };
  }

  if (registration.kind === "partner_registration") {
    return {
      ...base,
      partnerRegContactName: nullableString(registration.partnerRegContactName),
      partnerRegInstitutionName: nullableString(
        registration.partnerRegInstitutionName
      ),
      partnerRegCity: nullableString(registration.partnerRegCity),
      partnerRegContactNumber: nullableString(
        registration.partnerRegContactNumber
      ),
      partnerRegContactEmail: nullableString(registration.partnerRegContactEmail),
    };
  }

  const ambassador = registration as StudentAmbassadorRegistration;
  return {
    ...base,
    ambassadorName: nullableString(ambassador.ambassadorName),
    ambassadorClass: nullableString(ambassador.ambassadorClass),
    ambassadorSchoolCollege: nullableString(ambassador.ambassadorSchoolCollege),
    ambassadorAge:
      typeof ambassador.ambassadorAge === "number"
        ? ambassador.ambassadorAge
        : null,
    ambassadorPhone: nullableString(ambassador.ambassadorPhone),
    ambassadorEmail: nullableString(ambassador.ambassadorEmail),
  };
}

export function seminarTitlesFromJson(
  registration: Registration
): string[] {
  if (registration.kind !== "student") return [];
  const interests = registration.seminarInterests ?? [];
  if (interests.length === 0) return [];
  return buildSeminarRows(registration, new Map()).map((row) => row.seminarTitle);
}
