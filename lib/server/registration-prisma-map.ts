import { Prisma } from "@/lib/generated/prisma/client";
import {
  RegistrationStatus as PrismaRegistrationStatus,
  type PaymentStatus as PrismaPaymentStatus,
} from "@/lib/generated/prisma/client";
import type {
  PartnerRegistrationEntry,
  Registration,
  RegistrationKind,
  RegistrationStatus,
  SchoolRegistration,
  StudentAmbassadorRegistration,
  StudentRegistration,
} from "@/types";

export type PrismaRegistrationRecord = Prisma.RegistrationGetPayload<{
  include: { registrationSeminars: { orderBy: { id: "asc" } } };
}>;

function optionalString(value: string | null | undefined): string | undefined {
  return value ?? undefined;
}

function decimalToNumber(
  value: Prisma.Decimal | null | undefined
): number | undefined {
  if (value === null || value === undefined) return undefined;
  return Number(value);
}

export function mapApiStatusToPrisma(
  status: RegistrationStatus
): PrismaRegistrationStatus {
  if (status === "Checked In") {
    return PrismaRegistrationStatus.CheckedIn;
  }
  return PrismaRegistrationStatus.Confirmed;
}

export function mapPrismaStatusToApi(
  status: PrismaRegistrationStatus
): RegistrationStatus {
  if (status === PrismaRegistrationStatus.CheckedIn) {
    return "Checked In";
  }
  return "Confirmed";
}

function mapBaseFields(record: PrismaRegistrationRecord) {
  return {
    id: record.id,
    registrationNumber: record.registrationNumber,
    kind: record.kind as RegistrationKind,
    eventId: record.eventId,
    eventTitle: record.eventTitle,
    status: mapPrismaStatusToApi(record.status),
    paymentStatus: record.paymentStatus as PrismaPaymentStatus,
    amount: decimalToNumber(record.amount),
    registeredAt: record.registeredAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    checkInTime: record.checkInTime?.toISOString(),
  };
}

function seminarInterestsFromRecord(
  record: PrismaRegistrationRecord
): string[] | undefined {
  if (record.registrationSeminars.length === 0) return undefined;
  return record.registrationSeminars.map((row) => row.seminarTitle);
}

export function mapPrismaRegistrationToApi(
  record: PrismaRegistrationRecord
): Registration {
  const base = mapBaseFields(record);

  switch (record.kind) {
    case "student": {
      const student: StudentRegistration = {
        ...base,
        kind: "student",
        studentName: record.studentName ?? "",
        email: record.email ?? "",
        phone: record.phone ?? "",
        parentPhone: optionalString(record.parentPhone),
        college: record.college ?? "",
        classLabel: optionalString(record.classLabel),
        interestedStream: optionalString(record.interestedStream),
        board: optionalString(record.board),
        gender: record.gender as StudentRegistration["gender"] | undefined,
        city: record.city ?? "",
        state: record.state ?? "",
        course: optionalString(record.course),
        year: optionalString(record.year) as StudentRegistration["year"],
        seminarInterests: seminarInterestsFromRecord(record),
      };
      return student;
    }
    case "school": {
      const school: SchoolRegistration = {
        ...base,
        kind: "school",
        schoolContactName: record.schoolContactName ?? "",
        schoolName: record.schoolName ?? "",
        schoolCity: record.schoolCity ?? "",
        schoolContactNumber: record.schoolContactNumber ?? "",
        schoolContactEmail: record.schoolContactEmail ?? "",
      };
      return school;
    }
    case "partner_registration": {
      const partner: PartnerRegistrationEntry = {
        ...base,
        kind: "partner_registration",
        partnerRegContactName: record.partnerRegContactName ?? "",
        partnerRegInstitutionName: record.partnerRegInstitutionName ?? "",
        partnerRegCity: record.partnerRegCity ?? "",
        partnerRegContactNumber: record.partnerRegContactNumber ?? "",
        partnerRegContactEmail: record.partnerRegContactEmail ?? "",
      };
      return partner;
    }
    case "student_ambassador": {
      const ambassador: StudentAmbassadorRegistration = {
        ...base,
        kind: "student_ambassador",
        ambassadorName: record.ambassadorName ?? "",
        ambassadorClass: record.ambassadorClass ?? "",
        ambassadorSchoolCollege: record.ambassadorSchoolCollege ?? "",
        ambassadorAge: record.ambassadorAge ?? 0,
        ambassadorPhone: record.ambassadorPhone ?? "",
        ambassadorEmail: record.ambassadorEmail ?? "",
      };
      return ambassador;
    }
    default: {
      const exhaustive: never = record.kind;
      return exhaustive;
    }
  }
}

export function mapPrismaRegistrationsToApi(
  records: PrismaRegistrationRecord[]
): Registration[] {
  return records.map(mapPrismaRegistrationToApi);
}

export function studentNormalizedFields(input: {
  email?: string;
  phone?: string;
}): { emailNormalized: string | null; phoneLast10: string | null } {
  const emailNormalized =
    input.email?.trim().toLowerCase() ?? "";
  const phoneDigits = input.phone?.replace(/\D/g, "") ?? "";
  const phoneLast10 = phoneDigits.slice(-10);

  return {
    emailNormalized: emailNormalized.length > 0 ? emailNormalized : null,
    phoneLast10: phoneLast10.length >= 10 ? phoneLast10 : null,
  };
}

export function isPrismaUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
