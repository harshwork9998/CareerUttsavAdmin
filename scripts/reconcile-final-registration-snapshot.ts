/**
 * Final production registration delta reconciliation against Supabase.
 *
 * Usage:
 *   npx tsx scripts/reconcile-final-registration-snapshot.ts \
 *     <path/to/registrations-store.json> \
 *     <path/to/events-store.json> \
 *     [--dry-run]
 *
 * Example:
 *   npx tsx scripts/reconcile-final-registration-snapshot.ts \
 *     tmp/db-import/registrations-store.final.json \
 *     tmp/db-import/events-store.final.json \
 *     --dry-run
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../lib/generated/prisma/client";
import { buildReconciliationPlan } from "../lib/server/registration-reconciliation-plan";
import {
  assertOnlyEvt001,
  type DbRegistrationRecord,
} from "../lib/server/registration-reconciliation";
import {
  countByKind,
  readEventSource,
  readRegistrationSource,
  TARGET_EVENT_ID,
} from "./lib/registration-import-shared";
import {
  type MappedRegistration,
} from "./lib/registration-prisma-import-map";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

type ParsedArgs = {
  registrationsPath: string;
  eventsPath: string;
  dryRun: boolean;
};

function printUsage(): never {
  console.error(
    [
      "Usage:",
      "  npx tsx scripts/reconcile-final-registration-snapshot.ts \\",
      "    <path/to/registrations-store.json> \\",
      "    <path/to/events-store.json> \\",
      "    [--dry-run]",
      "",
      "Examples:",
      "  npx tsx scripts/reconcile-final-registration-snapshot.ts \\",
      "    tmp/db-import/registrations-store.final.json \\",
      "    tmp/db-import/events-store.final.json \\",
      "    --dry-run",
      "",
      "Notes:",
      "  - Never reads data/*.json automatically.",
      "  - --dry-run performs zero database writes.",
    ].join("\n")
  );
  process.exit(1);
}

function parseArgs(argv: string[]): ParsedArgs {
  const dryRun = argv.includes("--dry-run");
  const positional = argv.filter((arg) => arg !== "--dry-run");

  if (positional.length !== 2) {
    printUsage();
  }

  return {
    registrationsPath: path.resolve(positional[0]!),
    eventsPath: path.resolve(positional[1]!),
    dryRun,
  };
}

function createPrismaClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in .env.local");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
}

function mapDbRegistration(
  record: Prisma.RegistrationGetPayload<{
    include: { registrationSeminars: { orderBy: { id: "asc" } } };
  }>
): DbRegistrationRecord {
  const mapped: MappedRegistration = {
    id: record.id,
    registrationNumber: record.registrationNumber,
    kind: record.kind,
    eventId: record.eventId,
    eventTitle: record.eventTitle,
    status: record.status,
    paymentStatus: record.paymentStatus,
    registeredAt: record.registeredAt,
    updatedAt: record.updatedAt,
    amount: record.amount,
    checkInTime: record.checkInTime,
    studentName: record.studentName,
    email: record.email,
    phone: record.phone,
    parentPhone: record.parentPhone,
    college: record.college,
    classLabel: record.classLabel,
    interestedStream: record.interestedStream,
    board: record.board,
    gender: record.gender,
    city: record.city,
    state: record.state,
    course: record.course,
    year: record.year,
    emailNormalized: record.emailNormalized,
    phoneLast10: record.phoneLast10,
    schoolContactName: record.schoolContactName,
    schoolName: record.schoolName,
    schoolCity: record.schoolCity,
    schoolContactNumber: record.schoolContactNumber,
    schoolContactEmail: record.schoolContactEmail,
    partnerRegContactName: record.partnerRegContactName,
    partnerRegInstitutionName: record.partnerRegInstitutionName,
    partnerRegCity: record.partnerRegCity,
    partnerRegContactNumber: record.partnerRegContactNumber,
    partnerRegContactEmail: record.partnerRegContactEmail,
    ambassadorName: record.ambassadorName,
    ambassadorClass: record.ambassadorClass,
    ambassadorSchoolCollege: record.ambassadorSchoolCollege,
    ambassadorAge: record.ambassadorAge,
    ambassadorPhone: record.ambassadorPhone,
    ambassadorEmail: record.ambassadorEmail,
  };

  return {
    registration: mapped,
    seminarTitles: record.registrationSeminars.map((row) => row.seminarTitle),
  };
}

async function loadDatabaseState(prisma: PrismaClient) {
  const [registrations, counters, event] = await Promise.all([
    prisma.registration.findMany({
      include: {
        registrationSeminars: { orderBy: { id: "asc" } },
      },
    }),
    prisma.registrationNumberCounter.findMany(),
    prisma.event.findUnique({
      where: { id: TARGET_EVENT_ID },
      select: {
        id: true,
        registrationCount: true,
        checkInCount: true,
        seminars: { select: { id: true, title: true } },
      },
    }),
  ]);

  if (!event) {
    throw new Error(`Event ${TARGET_EVENT_ID} not found in Supabase`);
  }

  const dbRecordsById = new Map<string, DbRegistrationRecord>();
  const dbRecordsByNumber = new Map<string, DbRegistrationRecord>();
  const dbRegistrationIds = new Set<string>();

  for (const record of registrations) {
    const mapped = mapDbRegistration(record);
    dbRecordsById.set(record.id, mapped);
    dbRecordsByNumber.set(record.registrationNumber, mapped);
    dbRegistrationIds.add(record.id);
  }

  const currentCounters = new Map(
    counters.map((counter) => [counter.prefix, counter.nextValue])
  );

  const seminarTitleToId = new Map(
    event.seminars.map((seminar) => [seminar.title, seminar.id])
  );

  return {
    dbRecordsById,
    dbRecordsByNumber,
    dbRegistrationIds,
    currentCounters,
    seminarTitleToId,
    currentEventRegistrationCount: event.registrationCount,
    currentEventCheckInCount: event.checkInCount,
  };
}

async function applyReconciliation(
  prisma: PrismaClient,
  plan: ReturnType<typeof buildReconciliationPlan>,
  expectedExistingCount: number
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const currentCount = await tx.registration.count();
    if (currentCount !== expectedExistingCount) {
      throw new Error(
        `Database registration count changed during reconciliation (${expectedExistingCount} -> ${currentCount})`
      );
    }

    const existingIds = new Set(
      (
        await tx.registration.findMany({
          where: { id: { in: plan.exactMatches } },
          select: { id: true, registrationNumber: true },
        })
      ).map((row) => `${row.id}:${row.registrationNumber}`)
    );

    if (existingIds.size !== plan.exactMatches.length) {
      throw new Error(
        "Existing registration identity check failed inside transaction"
      );
    }

    if (plan.newRegistrations.length > 0) {
      await tx.registration.createMany({ data: plan.newRegistrations });
    }

    if (plan.newRegistrationSeminars.length > 0) {
      await tx.registrationSeminar.createMany({
        data: plan.newRegistrationSeminars,
      });
    }

    const now = new Date();
    for (const counter of plan.counterRows) {
      if (!counter.changed) continue;

      if (counter.currentNextValue === null) {
        await tx.registrationNumberCounter.create({
          data: {
            prefix: counter.prefix,
            nextValue: counter.proposedNextValue,
            updatedAt: now,
          },
        });
        continue;
      }

      if (counter.proposedNextValue < counter.currentNextValue) {
        throw new Error(
          `Counter would decrease for prefix ${counter.prefix}`
        );
      }

      const updated = await tx.registrationNumberCounter.updateMany({
        where: {
          prefix: counter.prefix,
          nextValue: counter.currentNextValue,
        },
        data: {
          nextValue: counter.proposedNextValue,
          updatedAt: now,
        },
      });

      if (updated.count !== 1) {
        throw new Error(
          `Counter reconciliation failed for prefix ${counter.prefix}`
        );
      }
    }

    await tx.event.update({
      where: { id: TARGET_EVENT_ID },
      data: {
        registrationCount: plan.eventCounters.registrationCount.proposed,
        checkInCount: plan.eventCounters.checkInCount.proposed,
        updatedAt: now,
      },
    });
  });
}

async function main(): Promise<void> {
  const { registrationsPath, eventsPath, dryRun } = parseArgs(
    process.argv.slice(2)
  );

  const finalRegistrations = readRegistrationSource(registrationsPath);
  const finalEvents = readEventSource(eventsPath);

  assertOnlyEvt001(finalRegistrations);

  const evt001 = finalEvents.find((event) => event.id === TARGET_EVENT_ID);
  if (!evt001) {
    throw new Error(`Event ${TARGET_EVENT_ID} not found in final events JSON`);
  }

  const prisma = createPrismaClient();

  try {
    const dbState = await loadDatabaseState(prisma);

    const plan = buildReconciliationPlan({
      finalRegistrations,
      dbRecordsById: dbState.dbRecordsById,
      dbRecordsByNumber: dbState.dbRecordsByNumber,
      dbRegistrationIds: dbState.dbRegistrationIds,
      seminarTitleToId: dbState.seminarTitleToId,
      currentCounters: dbState.currentCounters,
      currentEventRegistrationCount: dbState.currentEventRegistrationCount,
      currentEventCheckInCount: dbState.currentEventCheckInCount,
      finalEventRegistrationCount: evt001.registrationCount,
      finalEventCheckInCount: evt001.checkInCount,
    });

    const report = {
      mode: dryRun ? "DRY-RUN" : "APPLY",
      registrationsSource: registrationsPath,
      eventsSource: eventsPath,
      totalFinalRegistrations: finalRegistrations.length,
      countsByKind: countByKind(finalRegistrations),
      existingMatchCount: plan.exactMatches.length,
      newRegistrationCount: plan.newRegistrationIds.length,
      conflictCount: plan.conflicts.length,
      conflicts: plan.conflicts.map((conflict) => ({
        code: conflict.code,
        registrationId: conflict.registrationId,
        fields: conflict.fields,
      })),
      newRegistrationIds: plan.newRegistrationIds,
      newRegistrationSeminarRows: plan.newRegistrationSeminars.length,
      counterReconciliation: plan.counterRows,
      eventCounterReconciliation: plan.eventCounters,
      databasePrecheck: {
        registrations: dbState.dbRegistrationIds.size,
        registration_seminars: await prisma.registrationSeminar.count(),
        registration_number_counters: dbState.currentCounters.size,
      },
      noDatabaseWrites: dryRun,
      noEmailQrOtpSideEffects: true,
    };

    console.log(JSON.stringify(report, null, 2));

    if (plan.conflicts.length > 0) {
      throw new Error(
        `Reconciliation stopped with ${plan.conflicts.length} conflict(s)`
      );
    }

    if (dryRun) {
      console.log("DRY-RUN PASS");
      return;
    }

    await applyReconciliation(
      prisma,
      plan,
      dbState.dbRegistrationIds.size
    );
    console.log("RECONCILIATION APPLY PASS");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
