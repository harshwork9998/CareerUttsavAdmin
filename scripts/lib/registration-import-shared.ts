/**
 * Shared helpers for registration migration scripts.
 */
import fs from "node:fs";
import type { Registration, RegistrationKind } from "../../types";

export const TARGET_EVENT_ID = "evt-001";

export const LEGACY_NULLABLE_STUDENT_FIELDS = [
  "classLabel",
  "interestedStream",
  "board",
  "gender",
] as const;

export const STUDENT_CORE_REQUIRED = [
  "studentName",
  "email",
  "phone",
] as const;

export const SHARED_REQUIRED = [
  "id",
  "registrationNumber",
  "kind",
  "eventId",
  "eventTitle",
  "status",
  "paymentStatus",
  "registeredAt",
  "updatedAt",
] as const;

export const SCHOOL_REQUIRED = [
  "schoolContactName",
  "schoolName",
  "schoolCity",
  "schoolContactNumber",
  "schoolContactEmail",
] as const;

export const PARTNER_REQUIRED = [
  "partnerRegContactName",
  "partnerRegInstitutionName",
  "partnerRegCity",
  "partnerRegContactNumber",
  "partnerRegContactEmail",
] as const;

export const AMBASSADOR_REQUIRED = [
  "ambassadorName",
  "ambassadorClass",
  "ambassadorSchoolCollege",
  "ambassadorAge",
  "ambassadorPhone",
  "ambassadorEmail",
] as const;

export const REGISTRATION_COUNTERS = [
  { prefix: "CU-BLR-2026-", nextValue: 15 },
  { prefix: "CU-HYD-2026-", nextValue: 7 },
  { prefix: "CU-SCH-BLR-2026-", nextValue: 3 },
  { prefix: "CU-PTR-BLR-2026-", nextValue: 3 },
  { prefix: "CU-AMB-BLR-2026-", nextValue: 1 },
] as const;

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function nullableString(value: unknown): string | null {
  return isNonEmptyString(value) ? value.trim() : null;
}

export function parseRegistrationNumberParts(registrationNumber: string):
  | { prefix: string; suffix: number }
  | null {
  const match = registrationNumber.match(/^(.+?)(\d{5})$/);
  if (!match) return null;
  const prefix = match[1]!;
  const suffix = Number(match[2]);
  if (!prefix.startsWith("CU-") || Number.isNaN(suffix)) return null;
  return { prefix, suffix };
}

export function readRegistrationSource(sourcePath: string): Registration[] {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }

  const raw = fs.readFileSync(sourcePath, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Source file must contain a JSON array of registrations");
  }

  return parsed as Registration[];
}

export function isLegacyNullableStudentField(
  field: string
): field is (typeof LEGACY_NULLABLE_STUDENT_FIELDS)[number] {
  return (LEGACY_NULLABLE_STUDENT_FIELDS as readonly string[]).includes(field);
}

export function getLegacyNullableFields(
  registration: Registration
): string[] {
  if (registration.kind !== "student") return [];

  const raw = registration as unknown as Record<string, unknown>;
  return LEGACY_NULLABLE_STUDENT_FIELDS.filter(
    (field) => !isNonEmptyString(String(raw[field] ?? ""))
  );
}

export function countByKind(
  registrations: Registration[]
): Record<RegistrationKind, number> {
  const counts = {
    student: 0,
    school: 0,
    partner_registration: 0,
    student_ambassador: 0,
  } satisfies Record<RegistrationKind, number>;

  for (const registration of registrations) {
    const kind = registration.kind as RegistrationKind;
    if (kind in counts) {
      counts[kind] += 1;
    }
  }

  return counts;
}
