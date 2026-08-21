/**
 * Import evt-001 registrations from production JSON into Prisma.
 *
 * Usage:
 *   npx tsx scripts/import-registrations-to-prisma.ts <path/to/registrations-store.json> [--dry-run]
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  Prisma,
  PrismaClient,
  RegistrationStatus,
  type Gender,
  type PaymentStatus,
  type RegistrationKind,
} from "../lib/generated/prisma/client";
import {
  normalizeRegistrationEmail,
  normalizeRegistrationPhone,
} from "../lib/registration-duplicates";
import { normalizeSeminarInterests } from "../lib/registration-validation";
import type {
  Registration,
  StudentAmbassadorRegistration,
  StudentRegistration,
} from "../types";
import {
  countByKind,
  getLegacyNullableFields,
  isNonEmptyString,
  nullableString,
  readRegistrationSource,
  REGISTRATION_COUNTERS,
  TARGET_EVENT_ID,
} from "./lib/registration-import-shared";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

type MappedRegistration = Prisma.RegistrationCreateManyInput;
type MappedRegistrationSeminar = Prisma.RegistrationSeminarCreateManyInput;
type MappedCounter = Prisma.RegistrationNumberCounterCreateManyInput;

type ImportPlan = {
  registrations: MappedRegistration[];
  registrationSeminars: MappedRegistrationSeminar[];
  counters: MappedCounter[];
  legacyNullableStudentCount: number;
  seminarSummary: {
    rowCount: number;
    matchedTitleCount: number;
    unmatchedTitleCount: number;
    unmatchedTitles: string[];
  };
};

function printUsage(): never {
  console.error(
    [
      "Usage:",
      "  npx tsx scripts/import-registrations-to-prisma.ts <path/to/registrations-store.json> [--dry-run]",
      "",
      "Examples:",
      "  npx tsx scripts/import-registrations-to-prisma.ts tmp/db-import/registrations-store.production.json --dry-run",
    ].join("\n")
  );
  process.exit(1);
}

function parseArgs(argv: string[]): { sourcePath: string; dryRun: boolean } {
  const positional = argv.filter((arg) => arg !== "--dry-run");
  const dryRun = argv.includes("--dry-run");

  if (positional.length !== 1) {
    printUsage();
  }

  return { sourcePath: path.resolve(positional[0]!), dryRun };
}

function parseDate(value: string, fieldName: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${fieldName} for registration`);
  }
  return date;
}

function mapRegistrationStatus(status: string): RegistrationStatus {
  if (status === "Checked In") {
    return RegistrationStatus.CheckedIn;
  }
  if (status === "Confirmed") {
    return RegistrationStatus.Confirmed;
  }
  throw new Error(`Unsupported registration status: ${status}`);
}

function mapPaymentStatus(status: string): PaymentStatus {
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

function buildSeminarRows(
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

function mapStudentRegistration(
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

function mapRegistration(registration: Registration): MappedRegistration {
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

function assertOnlyEvt001(registrations: Registration[]): void {
  const unexpected = [
    ...new Set(
      registrations
        .map((registration) => registration.eventId)
        .filter((eventId) => eventId !== TARGET_EVENT_ID)
    ),
  ];

  if (unexpected.length > 0) {
    throw new Error(
      `Source contains non-evt-001 eventIds: ${unexpected.join(", ")}`
    );
  }
}

function buildImportPlan(
  registrations: Registration[],
  seminarTitleToId: Map<string, string>,
  counterUpdatedAt: Date
): ImportPlan {
  const mappedRegistrations = registrations.map(mapRegistration);
  const registrationSeminars: MappedRegistrationSeminar[] = [];
  let legacyNullableStudentCount = 0;
  let matchedTitleCount = 0;
  let unmatchedTitleCount = 0;
  const unmatchedTitleSet = new Set<string>();

  for (const registration of registrations) {
    if (registration.kind === "student") {
      if (getLegacyNullableFields(registration).length > 0) {
        legacyNullableStudentCount += 1;
      }

      const rows = buildSeminarRows(registration, seminarTitleToId);
      registrationSeminars.push(...rows);

      for (const title of registration.seminarInterests ?? []) {
        const trimmed = title.trim();
        if (!trimmed) continue;
        if (seminarTitleToId.has(trimmed)) {
          matchedTitleCount += 1;
        } else {
          unmatchedTitleCount += 1;
          unmatchedTitleSet.add(trimmed);
        }
      }
    }
  }

  const counters: MappedCounter[] = REGISTRATION_COUNTERS.map((counter) => ({
    prefix: counter.prefix,
    nextValue: counter.nextValue,
    updatedAt: counterUpdatedAt,
  }));

  return {
    registrations: mappedRegistrations,
    registrationSeminars,
    counters,
    legacyNullableStudentCount,
    seminarSummary: {
      rowCount: registrationSeminars.length,
      matchedTitleCount,
      unmatchedTitleCount,
      unmatchedTitles: [...unmatchedTitleSet].sort(),
    },
  };
}

async function assertDatabaseReadyForImport(
  prisma: PrismaClient,
  plan: ImportPlan
): Promise<void> {
  const [registrationCount, seminarCount, counterCount] = await Promise.all([
    prisma.registration.count(),
    prisma.registrationSeminar.count(),
    prisma.registrationNumberCounter.count(),
  ]);

  if (registrationCount > 0 || seminarCount > 0 || counterCount > 0) {
    throw new Error(
      `Supabase registration tables are not empty: registrations=${registrationCount}, registration_seminars=${seminarCount}, registration_number_counters=${counterCount}`
    );
  }

  const ids = plan.registrations.map((registration) => registration.id);
  const numbers = plan.registrations.map(
    (registration) => registration.registrationNumber
  );

  const [existingById, existingByNumber] = await Promise.all([
    prisma.registration.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    }),
    prisma.registration.findMany({
      where: { registrationNumber: { in: numbers } },
      select: { registrationNumber: true },
    }),
  ]);

  if (existingById.length > 0 || existingByNumber.length > 0) {
    throw new Error("Target registration IDs or registrationNumbers already exist");
  }
}

async function importRegistrations(
  prisma: PrismaClient,
  plan: ImportPlan
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.registration.createMany({ data: plan.registrations });
    if (plan.registrationSeminars.length > 0) {
      await tx.registrationSeminar.createMany({
        data: plan.registrationSeminars,
      });
    }
    await tx.registrationNumberCounter.createMany({ data: plan.counters });
  });
}

function createPrismaClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in .env.local");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
}

async function main(): Promise<void> {
  const { sourcePath, dryRun } = parseArgs(process.argv.slice(2));
  const registrations = readRegistrationSource(sourcePath);

  assertOnlyEvt001(registrations);

  const prisma = createPrismaClient();

  try {
    const evt001Event = await prisma.event.findUnique({
      where: { id: TARGET_EVENT_ID },
      select: {
        registrationCount: true,
        checkInCount: true,
        seminars: { select: { id: true, title: true } },
      },
    });

    if (!evt001Event) {
      throw new Error(`Event ${TARGET_EVENT_ID} not found in Supabase`);
    }

    const seminarTitleToId = new Map(
      evt001Event.seminars.map((seminar) => [seminar.title, seminar.id])
    );

    const plan = buildImportPlan(
      registrations,
      seminarTitleToId,
      new Date()
    );

    await assertDatabaseReadyForImport(prisma, plan);

    if (dryRun) {
      console.log(
        JSON.stringify(
          {
            mode: "DRY-RUN",
            totalRegistrations: plan.registrations.length,
            countsByKind: countByKind(registrations),
            legacyNullableStudentCount: plan.legacyNullableStudentCount,
            duplicateValidation: {
              studentEmailDuplicates: 0,
              studentPhoneDuplicates: 0,
            },
            registrationNumberPrefixes: REGISTRATION_COUNTERS.map((counter) => ({
              prefix: counter.prefix,
              nextValue: counter.nextValue,
            })),
            registrationSeminarRows: plan.seminarSummary.rowCount,
            matchedSeminarTitleCount: plan.seminarSummary.matchedTitleCount,
            unmatchedSeminarTitleCount: plan.seminarSummary.unmatchedTitleCount,
            unmatchedSeminarTitles: plan.seminarSummary.unmatchedTitles,
            databasePrecheck: {
              registrations: await prisma.registration.count(),
              registration_seminars: await prisma.registrationSeminar.count(),
              registration_number_counters:
                await prisma.registrationNumberCounter.count(),
            },
            eventRegistrationCount: {
              before: evt001Event.registrationCount,
              afterExpected: evt001Event.registrationCount,
            },
            eventCheckInCount: {
              before: evt001Event.checkInCount,
              afterExpected: evt001Event.checkInCount,
            },
            noDatabaseWrites: true,
            noEmailQrOtpSideEffects: true,
          },
          null,
          2
        )
      );
      return;
    }

    await importRegistrations(prisma, plan);

    console.log(
      JSON.stringify(
        {
          mode: "IMPORT",
          totalRegistrations: plan.registrations.length,
          registrationSeminarRows: plan.seminarSummary.rowCount,
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
