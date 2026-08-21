/**
 * Read-only production registration import preflight.
 *
 * Usage:
 *   npx tsx scripts/preflight-registrations-to-prisma.ts <path/to/registrations-store.json>
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { REGISTRATION_STATUSES } from "../constants";
import {
  normalizeRegistrationEmail,
  normalizeRegistrationPhone,
} from "../lib/registration-duplicates";
import {
  normalizeSeminarInterests,
  REGISTRATION_BOARD_OPTIONS,
  REGISTRATION_GENDER_OPTIONS,
  REGISTRATION_STREAM_OPTIONS,
} from "../lib/registration-validation";
import type {
  Registration,
  RegistrationKind,
  StudentRegistration,
} from "../types";
import {
  AMBASSADOR_REQUIRED,
  getLegacyNullableFields,
  isNonEmptyString,
  parseRegistrationNumberParts,
  PARTNER_REQUIRED,
  readRegistrationSource,
  SCHOOL_REQUIRED,
  SHARED_REQUIRED,
  STUDENT_CORE_REQUIRED,
  TARGET_EVENT_ID,
} from "./lib/registration-import-shared";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

const PAYMENT_STATUSES = ["Paid", "Pending", "Waived"] as const;
const KINDS: RegistrationKind[] = [
  "student",
  "school",
  "partner_registration",
  "student_ambassador",
];

type StopReason = {
  code: string;
  message: string;
  details?: unknown;
};

type PreflightReport = {
  sourceFile: string;
  totalRegistrations: number;
  countsByKind: Record<RegistrationKind, number>;
  countsByEventId: Record<string, number>;
  distinctEventIds: string[];
  idValidation: {
    missingIds: string[];
    duplicateIds: string[];
    missingRegistrationNumbers: string[];
    duplicateRegistrationNumbers: string[];
    malformedRegistrationNumbers: Array<{ id: string; registrationNumber: string }>;
  };
  prefixAnalysis: Array<{
    prefix: string;
    recordCount: number;
    minSuffix: number;
    maxSuffix: number;
    proposedNextValue: number;
  }>;
  studentEmailDuplicates: Array<{
    normalizedEmail: string;
    registrationIds: string[];
    registrationNumbers: string[];
  }>;
  studentPhoneDuplicates: Array<{
    phoneLast10: string;
    registrationIds: string[];
    registrationNumbers: string[];
  }>;
  requiredFieldProblems: Array<{ id: string; problems: string[] }>;
  legacyNullableStudents: Array<{ id: string; fields: string[] }>;
  enumTypeProblems: Array<{ id: string; problems: string[] }>;
  seminarInterestSummary: {
    studentsWithSeminarInterests: number;
    proposedRegistrationSeminarRows: number;
    matchedTitleCount: number;
    unmatchedTitleCount: number;
    unmatchedTitles: string[];
    duplicateTitleWithinRegistration: Array<{
      registrationId: string;
      registrationNumber: string;
      duplicateTitles: string[];
    }>;
  };
  evt001JsonRowCount: number;
  storedRegistrationCount: number | null;
  databasePrecheck: {
    registrations: number;
    registration_seminars: number;
    registration_number_counters: number;
  };
  stopReasons: StopReason[];
};

function printUsage(): never {
  console.error(
    [
      "Usage:",
      "  npx tsx scripts/preflight-registrations-to-prisma.ts <path/to/registrations-store.json>",
    ].join("\n")
  );
  process.exit(1);
}

function validateIds(registrations: Registration[]): PreflightReport["idValidation"] {
  const seenIds = new Map<string, number>();
  const seenNumbers = new Map<string, number>();
  const missingIds: string[] = [];
  const duplicateIds: string[] = [];
  const missingRegistrationNumbers: string[] = [];
  const duplicateRegistrationNumbers: string[] = [];
  const malformedRegistrationNumbers: Array<{
    id: string;
    registrationNumber: string;
  }> = [];

  registrations.forEach((registration, index) => {
    const fallbackId = `index:${index}`;

    if (!isNonEmptyString(registration.id)) {
      missingIds.push(fallbackId);
    } else {
      seenIds.set(registration.id, (seenIds.get(registration.id) ?? 0) + 1);
    }

    if (!isNonEmptyString(registration.registrationNumber)) {
      missingRegistrationNumbers.push(registration.id || fallbackId);
    } else {
      seenNumbers.set(
        registration.registrationNumber,
        (seenNumbers.get(registration.registrationNumber) ?? 0) + 1
      );
      if (!parseRegistrationNumberParts(registration.registrationNumber)) {
        malformedRegistrationNumbers.push({
          id: registration.id || fallbackId,
          registrationNumber: registration.registrationNumber,
        });
      }
    }
  });

  for (const [id, count] of seenIds) {
    if (count > 1) duplicateIds.push(id);
  }
  for (const [number, count] of seenNumbers) {
    if (count > 1) duplicateRegistrationNumbers.push(number);
  }

  return {
    missingIds,
    duplicateIds,
    missingRegistrationNumbers,
    duplicateRegistrationNumbers,
    malformedRegistrationNumbers,
  };
}

function analyzePrefixes(registrations: Registration[]): PreflightReport["prefixAnalysis"] {
  const groups = new Map<string, number[]>();

  for (const registration of registrations) {
    if (!isNonEmptyString(registration.registrationNumber)) continue;
    const parts = parseRegistrationNumberParts(registration.registrationNumber);
    if (!parts) continue;
    const list = groups.get(parts.prefix) ?? [];
    list.push(parts.suffix);
    groups.set(parts.prefix, list);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([prefix, suffixes]) => {
      const minSuffix = Math.min(...suffixes);
      const maxSuffix = Math.max(...suffixes);
      return {
        prefix,
        recordCount: suffixes.length,
        minSuffix,
        maxSuffix,
        proposedNextValue: maxSuffix + 1,
      };
    });
}

function findStudentEmailDuplicates(
  students: StudentRegistration[]
): PreflightReport["studentEmailDuplicates"] {
  const groups = new Map<string, { ids: string[]; numbers: string[] }>();

  for (const student of students) {
    if (student.eventId !== TARGET_EVENT_ID) continue;

    const key = normalizeRegistrationEmail(student.email);
    if (key.length === 0) continue;

    const group = groups.get(key) ?? { ids: [], numbers: [] };
    group.ids.push(student.id);
    group.numbers.push(student.registrationNumber);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .filter(([, group]) => group.ids.length > 1)
    .map(([normalizedEmail, group]) => ({
      normalizedEmail,
      registrationIds: group.ids,
      registrationNumbers: group.numbers,
    }));
}

function findStudentPhoneDuplicates(
  students: StudentRegistration[]
): PreflightReport["studentPhoneDuplicates"] {
  const groups = new Map<string, { ids: string[]; numbers: string[] }>();

  for (const student of students) {
    if (student.eventId !== TARGET_EVENT_ID) continue;

    const key = normalizeRegistrationPhone(student.phone);
    if (key.length < 10) continue;

    const group = groups.get(key) ?? { ids: [], numbers: [] };
    group.ids.push(student.id);
    group.numbers.push(student.registrationNumber);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .filter(([, group]) => group.ids.length > 1)
    .map(([phoneLast10, group]) => ({
      phoneLast10,
      registrationIds: group.ids,
      registrationNumbers: group.numbers,
    }));
}

function validateRequiredFields(registrations: Registration[]): {
  requiredFieldProblems: PreflightReport["requiredFieldProblems"];
  legacyNullableStudents: PreflightReport["legacyNullableStudents"];
} {
  const requiredFieldProblems: PreflightReport["requiredFieldProblems"] = [];
  const legacyNullableStudents: PreflightReport["legacyNullableStudents"] = [];

  for (const registration of registrations) {
    const recordProblems: string[] = [];
    const raw = registration as unknown as Record<string, unknown>;

    for (const field of SHARED_REQUIRED) {
      if (!isNonEmptyString(String(raw[field] ?? ""))) {
        recordProblems.push(`missing shared field: ${field}`);
      }
    }

    if (registration.kind === "student") {
      for (const field of STUDENT_CORE_REQUIRED) {
        if (!isNonEmptyString(String(raw[field] ?? ""))) {
          recordProblems.push(`missing student field: ${field}`);
        }
      }

      const legacyFields = getLegacyNullableFields(registration);
      if (legacyFields.length > 0) {
        legacyNullableStudents.push({
          id: registration.id,
          fields: legacyFields.map((field) => `LEGACY NULLABLE FIELD: ${field}`),
        });
      }
    } else if (registration.kind === "school") {
      for (const field of SCHOOL_REQUIRED) {
        if (!isNonEmptyString(String(raw[field] ?? ""))) {
          recordProblems.push(`missing school field: ${field}`);
        }
      }
    } else if (registration.kind === "partner_registration") {
      for (const field of PARTNER_REQUIRED) {
        if (!isNonEmptyString(String(raw[field] ?? ""))) {
          recordProblems.push(`missing partner_registration field: ${field}`);
        }
      }
    } else if (registration.kind === "student_ambassador") {
      for (const field of AMBASSADOR_REQUIRED) {
        const value = raw[field];
        if (field === "ambassadorAge") {
          if (typeof value !== "number" || !Number.isInteger(value)) {
            recordProblems.push("missing student_ambassador field: ambassadorAge");
          } else if (value < 10 || value > 25) {
            recordProblems.push(
              `invalid student_ambassador field: ambassadorAge (${value})`
            );
          }
        } else if (!isNonEmptyString(String(value ?? ""))) {
          recordProblems.push(`missing student_ambassador field: ${field}`);
        }
      }
    }

    if (recordProblems.length > 0) {
      requiredFieldProblems.push({ id: registration.id, problems: recordProblems });
    }
  }

  return { requiredFieldProblems, legacyNullableStudents };
}

function validateEnumsAndTypes(
  registrations: Registration[]
): PreflightReport["enumTypeProblems"] {
  const problems: PreflightReport["enumTypeProblems"] = [];

  for (const registration of registrations) {
    const recordProblems: string[] = [];

    if (!KINDS.includes(registration.kind)) {
      recordProblems.push(`invalid kind: ${String(registration.kind)}`);
    }

    if (
      !(REGISTRATION_STATUSES as readonly string[]).includes(registration.status)
    ) {
      recordProblems.push(`invalid status: ${String(registration.status)}`);
    }

    if (
      !(PAYMENT_STATUSES as readonly string[]).includes(registration.paymentStatus)
    ) {
      recordProblems.push(
        `invalid paymentStatus: ${String(registration.paymentStatus)}`
      );
    }

    if (registration.kind === "student" && registration.gender) {
      if (
        !(REGISTRATION_GENDER_OPTIONS as readonly string[]).includes(
          registration.gender
        )
      ) {
        recordProblems.push(`invalid gender: ${String(registration.gender)}`);
      }
    }

    if (registration.kind === "student") {
      if (
        registration.interestedStream &&
        !(REGISTRATION_STREAM_OPTIONS as readonly string[]).includes(
          registration.interestedStream
        )
      ) {
        recordProblems.push(
          `invalid interestedStream: ${registration.interestedStream}`
        );
      }
      if (
        registration.board &&
        !(REGISTRATION_BOARD_OPTIONS as readonly string[]).includes(
          registration.board
        )
      ) {
        recordProblems.push(`invalid board: ${registration.board}`);
      }
    }

    for (const field of ["registeredAt", "updatedAt"] as const) {
      const value = registration[field];
      if (!isNonEmptyString(value) || Number.isNaN(new Date(value).getTime())) {
        recordProblems.push(`invalid ${field}`);
      }
    }

    if (registration.checkInTime) {
      if (Number.isNaN(new Date(registration.checkInTime).getTime())) {
        recordProblems.push("invalid checkInTime");
      }
    }

    if (
      registration.amount !== undefined &&
      registration.amount !== null &&
      typeof registration.amount !== "number"
    ) {
      recordProblems.push("invalid amount");
    }

    if (recordProblems.length > 0) {
      problems.push({ id: registration.id, problems: recordProblems });
    }
  }

  return problems;
}

function analyzeSeminarInterests(
  registrations: Registration[],
  seminarTitles: Set<string>
): PreflightReport["seminarInterestSummary"] {
  const students = registrations.filter(
    (registration): registration is StudentRegistration =>
      registration.kind === "student" && registration.eventId === TARGET_EVENT_ID
  );

  let studentsWithSeminarInterests = 0;
  let proposedRegistrationSeminarRows = 0;
  let matchedTitleCount = 0;
  let unmatchedTitleCount = 0;
  const unmatchedTitleSet = new Set<string>();
  const duplicateTitleWithinRegistration: PreflightReport["seminarInterestSummary"]["duplicateTitleWithinRegistration"] =
    [];

  for (const student of students) {
    const interests = student.seminarInterests ?? [];
    if (interests.length === 0) continue;

    studentsWithSeminarInterests += 1;

    const normalized = normalizeSeminarInterests(interests);
    proposedRegistrationSeminarRows += normalized.length;

    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const title of interests.map((value: string) => value.trim()).filter(Boolean)) {
      const canonical = normalizeSeminarInterests([title])[0];
      if (!canonical) continue;
      if (seen.has(canonical)) duplicates.push(canonical);
      seen.add(canonical);
    }
    if (duplicates.length > 0) {
      duplicateTitleWithinRegistration.push({
        registrationId: student.id,
        registrationNumber: student.registrationNumber,
        duplicateTitles: [...new Set(duplicates)],
      });
    }

    for (const title of interests) {
      const trimmed = title.trim();
      if (!trimmed) continue;
      if (seminarTitles.has(trimmed)) {
        matchedTitleCount += 1;
      } else {
        unmatchedTitleCount += 1;
        unmatchedTitleSet.add(trimmed);
      }
    }
  }

  return {
    studentsWithSeminarInterests,
    proposedRegistrationSeminarRows,
    matchedTitleCount,
    unmatchedTitleCount,
    unmatchedTitles: [...unmatchedTitleSet].sort(),
    duplicateTitleWithinRegistration,
  };
}

function buildStopReasons(report: Omit<PreflightReport, "stopReasons">): StopReason[] {
  const stops: StopReason[] = [];

  const unexpectedEventIds = report.distinctEventIds.filter(
    (eventId) => eventId !== TARGET_EVENT_ID
  );
  if (unexpectedEventIds.length > 0) {
    stops.push({
      code: "unexpected_event_ids",
      message: "Non-evt-001 eventIds found in source file",
      details: {
        unexpectedEventIds,
        countsByEventId: report.countsByEventId,
      },
    });
  }

  const id = report.idValidation;
  if (
    id.missingIds.length > 0 ||
    id.duplicateIds.length > 0 ||
    id.missingRegistrationNumbers.length > 0 ||
    id.duplicateRegistrationNumbers.length > 0 ||
    id.malformedRegistrationNumbers.length > 0
  ) {
    stops.push({
      code: "id_or_registration_number_validation",
      message: "ID or registration-number validation failed",
      details: id,
    });
  }

  if (report.studentEmailDuplicates.length > 0) {
    stops.push({
      code: "student_email_duplicates",
      message: "Duplicate student emails found within evt-001",
      details: report.studentEmailDuplicates,
    });
  }

  if (report.studentPhoneDuplicates.length > 0) {
    stops.push({
      code: "student_phone_duplicates",
      message: "Duplicate student phones found within evt-001",
      details: report.studentPhoneDuplicates,
    });
  }

  if (report.requiredFieldProblems.length > 0) {
    stops.push({
      code: "required_field_validation",
      message: "Required field validation failed",
      details: report.requiredFieldProblems,
    });
  }

  if (report.enumTypeProblems.length > 0) {
    stops.push({
      code: "enum_type_validation",
      message: "Enum/type validation failed",
      details: report.enumTypeProblems,
    });
  }

  if (
    report.databasePrecheck.registrations > 0 ||
    report.databasePrecheck.registration_seminars > 0 ||
    report.databasePrecheck.registration_number_counters > 0
  ) {
    stops.push({
      code: "database_not_empty",
      message: "Supabase registration tables are not empty",
      details: report.databasePrecheck,
    });
  }

  return stops;
}

async function main(): Promise<void> {
  const sourceArg = process.argv[2];
  if (!sourceArg) printUsage();

  const sourcePath = path.resolve(sourceArg);
  const registrations = readRegistrationSource(sourcePath);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  try {
    const evt001Event = await prisma.event.findUnique({
      where: { id: TARGET_EVENT_ID },
      select: { registrationCount: true, seminars: { select: { title: true } } },
    });

    const seminarTitles = new Set(
      evt001Event?.seminars.map((seminar) => seminar.title) ?? []
    );

    const studentsEvt001 = registrations.filter(
      (registration): registration is StudentRegistration =>
        registration.kind === "student" &&
        registration.eventId === TARGET_EVENT_ID
    );

    const countsByKind = {
      student: 0,
      school: 0,
      partner_registration: 0,
      student_ambassador: 0,
    } satisfies Record<RegistrationKind, number>;

    for (const registration of registrations) {
      if (registration.kind in countsByKind) {
        countsByKind[registration.kind as RegistrationKind] += 1;
      }
    }

    const countsByEventId: Record<string, number> = {};
    for (const registration of registrations) {
      countsByEventId[registration.eventId] =
        (countsByEventId[registration.eventId] ?? 0) + 1;
    }

    const fieldValidation = validateRequiredFields(registrations);

    const reportBase = {
      sourceFile: sourcePath,
      totalRegistrations: registrations.length,
      countsByKind,
      countsByEventId,
      distinctEventIds: Object.keys(countsByEventId).sort(),
      idValidation: validateIds(registrations),
      prefixAnalysis: analyzePrefixes(registrations),
      studentEmailDuplicates: findStudentEmailDuplicates(studentsEvt001),
      studentPhoneDuplicates: findStudentPhoneDuplicates(studentsEvt001),
      requiredFieldProblems: fieldValidation.requiredFieldProblems,
      legacyNullableStudents: fieldValidation.legacyNullableStudents,
      enumTypeProblems: validateEnumsAndTypes(registrations),
      seminarInterestSummary: analyzeSeminarInterests(registrations, seminarTitles),
      evt001JsonRowCount: countsByEventId[TARGET_EVENT_ID] ?? 0,
      storedRegistrationCount: evt001Event?.registrationCount ?? null,
      databasePrecheck: {
        registrations: await prisma.registration.count(),
        registration_seminars: await prisma.registrationSeminar.count(),
        registration_number_counters:
          await prisma.registrationNumberCounter.count(),
      },
    };

    const report: PreflightReport = {
      ...reportBase,
      stopReasons: buildStopReasons(reportBase),
    };

    console.log(JSON.stringify(report, null, 2));

    if (report.stopReasons.length > 0) {
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
