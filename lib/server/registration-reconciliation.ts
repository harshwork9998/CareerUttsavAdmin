import { Prisma } from "@/lib/generated/prisma/client";
import type { Registration, RegistrationKind } from "@/types";
import {
  normalizeRegistrationEmail,
  normalizeRegistrationPhone,
} from "@/lib/registration-duplicates";
import {
  parseRegistrationNumberParts,
  TARGET_EVENT_ID,
} from "@/scripts/lib/registration-import-shared";
import type { MappedRegistration } from "@/scripts/lib/registration-prisma-import-map";

export type ReconciliationConflict = {
  code: string;
  registrationId?: string;
  fields?: string[];
  message: string;
};

export type DbRegistrationRecord = {
  registration: MappedRegistration;
  seminarTitles: string[];
};

export type CounterReconciliationRow = {
  prefix: string;
  currentNextValue: number | null;
  requiredNextValue: number;
  proposedNextValue: number;
  changed: boolean;
};

export type EventCounterReconciliation = {
  registrationCount: {
    current: number;
    finalJson: number;
    proposed: number;
    changed: boolean;
  };
  checkInCount: {
    current: number;
    finalJson: number;
    proposed: number;
    changed: boolean;
  };
};

export type ReconciliationPlan = {
  exactMatches: string[];
  newRegistrationIds: string[];
  conflicts: ReconciliationConflict[];
  newRegistrations: MappedRegistration[];
  newRegistrationSeminars: Prisma.RegistrationSeminarCreateManyInput[];
  counterRows: CounterReconciliationRow[];
  eventCounters: EventCounterReconciliation;
};

function normalizeNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return String(value);
}

function normalizeAmount(
  value: Prisma.Decimal | null | undefined
): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

function normalizeDate(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
}

const COMPARABLE_FIELDS = [
  "registrationNumber",
  "kind",
  "eventId",
  "eventTitle",
  "status",
  "paymentStatus",
  "amount",
  "checkInTime",
  "studentName",
  "email",
  "phone",
  "parentPhone",
  "college",
  "classLabel",
  "interestedStream",
  "board",
  "gender",
  "city",
  "state",
  "course",
  "year",
  "emailNormalized",
  "phoneLast10",
  "schoolContactName",
  "schoolName",
  "schoolCity",
  "schoolContactNumber",
  "schoolContactEmail",
  "partnerRegContactName",
  "partnerRegInstitutionName",
  "partnerRegCity",
  "partnerRegContactNumber",
  "partnerRegContactEmail",
  "ambassadorName",
  "ambassadorClass",
  "ambassadorSchoolCollege",
  "ambassadorAge",
  "ambassadorPhone",
  "ambassadorEmail",
] as const;

function comparableValue(
  record: MappedRegistration,
  field: (typeof COMPARABLE_FIELDS)[number]
): string | number | null {
  const value = record[field];
  if (field === "amount") {
    return normalizeAmount(value as Prisma.Decimal | null | undefined);
  }
  if (field === "ambassadorAge") {
    return typeof value === "number" ? value : null;
  }
  if (typeof value === "string" || value === null || value === undefined) {
    return normalizeNullableString(value);
  }
  return value as string | number | null;
}

export function compareExistingRegistration(
  jsonMapped: MappedRegistration,
  dbRecord: DbRegistrationRecord,
  jsonSeminarTitles: string[]
): string[] {
  const mismatches: string[] = [];

  for (const field of COMPARABLE_FIELDS) {
    const jsonValue = comparableValue(jsonMapped, field);
    const dbValue = comparableValue(dbRecord.registration, field);
    if (jsonValue !== dbValue) {
      mismatches.push(field);
    }
  }

  if (
    normalizeDate(jsonMapped.registeredAt) !==
    normalizeDate(dbRecord.registration.registeredAt)
  ) {
    mismatches.push("registeredAt");
  }
  if (
    normalizeDate(jsonMapped.updatedAt) !==
    normalizeDate(dbRecord.registration.updatedAt)
  ) {
    mismatches.push("updatedAt");
  }

  const jsonTitles = jsonSeminarTitles.join("\u0000");
  const dbTitles = dbRecord.seminarTitles.join("\u0000");
  if (jsonTitles !== dbTitles) {
    mismatches.push("seminarInterests");
  }

  return mismatches;
}

export function validateFinalSnapshotDuplicates(
  registrations: Registration[]
): ReconciliationConflict[] {
  const conflicts: ReconciliationConflict[] = [];
  const idCounts = new Map<string, number>();
  const numberCounts = new Map<string, number>();

  for (const registration of registrations) {
    idCounts.set(registration.id, (idCounts.get(registration.id) ?? 0) + 1);
    numberCounts.set(
      registration.registrationNumber,
      (numberCounts.get(registration.registrationNumber) ?? 0) + 1
    );
  }

  for (const [id, count] of idCounts) {
    if (count > 1) {
      conflicts.push({
        code: "duplicate_id",
        registrationId: id,
        message: `Duplicate registration id in final snapshot: ${id}`,
      });
    }
  }

  for (const [registrationNumber, count] of numberCounts) {
    if (count > 1) {
      conflicts.push({
        code: "duplicate_registration_number",
        message: `Duplicate registration number in final snapshot: ${registrationNumber}`,
      });
    }
  }

  const students = registrations.filter(
    (registration) =>
      registration.kind === "student" && registration.eventId === TARGET_EVENT_ID
  );

  const emailMap = new Map<string, string[]>();
  const phoneMap = new Map<string, string[]>();

  for (const student of students) {
    const email = normalizeRegistrationEmail(
      (student as { email?: string }).email
    );
    if (email.length > 0) {
      const ids = emailMap.get(email) ?? [];
      ids.push(student.id);
      emailMap.set(email, ids);
    }

    const phone = normalizeRegistrationPhone(
      (student as { phone?: string }).phone
    );
    if (phone.length >= 10) {
      const ids = phoneMap.get(phone) ?? [];
      ids.push(student.id);
      phoneMap.set(phone, ids);
    }
  }

  for (const [email, ids] of emailMap) {
    if (ids.length > 1) {
      conflicts.push({
        code: "duplicate_student_email",
        message: `Duplicate normalized student email in final snapshot: ${email}`,
        registrationId: ids.join(","),
      });
    }
  }

  for (const [phone, ids] of phoneMap) {
    if (ids.length > 1) {
      conflicts.push({
        code: "duplicate_student_phone",
        message: `Duplicate phoneLast10 in final snapshot: ${phone}`,
        registrationId: ids.join(","),
      });
    }
  }

  return conflicts;
}

export function computeRequiredCounterValues(
  registrations: Registration[]
): Map<string, number> {
  const maxSuffixByPrefix = new Map<string, number>();

  for (const registration of registrations) {
    const parts = parseRegistrationNumberParts(registration.registrationNumber);
    if (!parts) continue;
    const current = maxSuffixByPrefix.get(parts.prefix) ?? 0;
    maxSuffixByPrefix.set(parts.prefix, Math.max(current, parts.suffix));
  }

  const required = new Map<string, number>();
  for (const [prefix, maxSuffix] of maxSuffixByPrefix) {
    required.set(prefix, maxSuffix + 1);
  }
  return required;
}

export function reconcileCounters(
  requiredByPrefix: Map<string, number>,
  currentByPrefix: Map<string, number>
): CounterReconciliationRow[] {
  const prefixes = new Set([
    ...requiredByPrefix.keys(),
    ...currentByPrefix.keys(),
  ]);

  const rows: CounterReconciliationRow[] = [];

  for (const prefix of [...prefixes].sort()) {
    const requiredNextValue = requiredByPrefix.get(prefix) ?? 1;
    const currentNextValue = currentByPrefix.get(prefix) ?? null;
    const proposedNextValue = Math.max(
      currentNextValue ?? 0,
      requiredNextValue
    );
    rows.push({
      prefix,
      currentNextValue,
      requiredNextValue,
      proposedNextValue,
      changed: currentNextValue === null || proposedNextValue > currentNextValue,
    });
  }

  return rows;
}

export function reconcileEventCounters(
  currentRegistrationCount: number,
  currentCheckInCount: number,
  finalRegistrationCount: number,
  finalCheckInCount: number
): EventCounterReconciliation {
  return {
    registrationCount: {
      current: currentRegistrationCount,
      finalJson: finalRegistrationCount,
      proposed: finalRegistrationCount,
      changed: currentRegistrationCount !== finalRegistrationCount,
    },
    checkInCount: {
      current: currentCheckInCount,
      finalJson: finalCheckInCount,
      proposed: finalCheckInCount,
      changed: currentCheckInCount !== finalCheckInCount,
    },
  };
}

export function assertOnlyEvt001(registrations: Registration[]): void {
  const unexpected = [
    ...new Set(
      registrations
        .map((registration) => registration.eventId)
        .filter((eventId) => eventId !== TARGET_EVENT_ID)
    ),
  ];

  if (unexpected.length > 0) {
    throw new Error(
      `Final snapshot contains non-evt-001 eventIds: ${unexpected.join(", ")}`
    );
  }
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
    if (registration.kind in counts) {
      counts[registration.kind] += 1;
    }
  }

  return counts;
}
