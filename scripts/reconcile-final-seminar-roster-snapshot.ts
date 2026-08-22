/**
 * Final seminar roster snapshot reconciliation against Supabase.
 *
 * Usage:
 *   npx tsx scripts/reconcile-final-seminar-roster-snapshot.ts --source <rosters.json> [--dry-run]
 *   npx tsx scripts/reconcile-final-seminar-roster-snapshot.ts --source <rosters.json> --apply
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import {
  buildSeminarRosterImportPlan,
  rosterSessionKey,
  type SeminarCatalogEntry,
  validateSeminarRosterSources,
} from "../lib/server/seminar-roster-prisma-import-map";
import {
  compareSeminarRosters,
  type PrismaSeminarSessionRosterRecord,
} from "../lib/server/seminar-roster-reconciliation";
import {
  parseSeminarRosterReconcileArgs,
  readSeminarRosterSource,
} from "./lib/seminar-roster-import-shared";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

function createPrismaClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in .env.local");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
}

async function loadCatalog(prisma: PrismaClient): Promise<{
  knownEventIds: Set<string>;
  seminarCatalog: Map<string, SeminarCatalogEntry>;
  knownPartnerIds: Set<string>;
}> {
  const [events, seminars, partners] = await Promise.all([
    prisma.event.findMany({ select: { id: true } }),
    prisma.seminar.findMany({
      select: { id: true, eventId: true, panelistSlots: true },
    }),
    prisma.partner.findMany({ select: { id: true } }),
  ]);

  return {
    knownEventIds: new Set(events.map((event) => event.id)),
    seminarCatalog: new Map(
      seminars.map((seminar) => [
        seminar.id,
        {
          id: seminar.id,
          eventId: seminar.eventId,
          panelistSlots: seminar.panelistSlots,
        },
      ])
    ),
    knownPartnerIds: new Set(partners.map((partner) => partner.id)),
  };
}

async function applyReconciliation(
  prisma: PrismaClient,
  plan: ReturnType<typeof buildSeminarRosterImportPlan>,
  expectedExistingCount: number
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const currentCount = await tx.seminarSessionRoster.count();
    if (currentCount !== expectedExistingCount) {
      throw new Error(
        `Seminar roster count changed during reconciliation (${expectedExistingCount} -> ${currentCount})`
      );
    }

    for (const row of plan) {
      await tx.seminarSessionRoster.upsert({
        where: {
          eventId_seminarId: {
            eventId: row.eventId,
            seminarId: row.seminarId,
          },
        },
        create: row,
        update: {
          moderator: row.moderator,
          panelists: row.panelists,
          topicBrief: row.topicBrief,
          notes: row.notes,
          updatedAt: row.updatedAt,
        },
      });
    }
  });
}

async function main(): Promise<void> {
  const { sourcePath, dryRun } = parseSeminarRosterReconcileArgs(
    process.argv.slice(2)
  );
  const resolvedSource = path.resolve(sourcePath);
  const rosters = readSeminarRosterSource(resolvedSource);
  const prisma = createPrismaClient();

  try {
    const catalog = await loadCatalog(prisma);
    const preflight = validateSeminarRosterSources({
      rosters,
      knownEventIds: catalog.knownEventIds,
      seminarCatalog: catalog.seminarCatalog,
      knownPartnerIds: catalog.knownPartnerIds,
    });

    if (!preflight.ok) {
      throw new Error(
        `Reconciliation stopped: ${preflight.errors.length} preflight error(s)`
      );
    }

    const dbRows = await prisma.seminarSessionRoster.findMany();
    const dbByKey = new Map<string, PrismaSeminarSessionRosterRecord>(
      dbRows.map((row) => [rosterSessionKey(row.eventId, row.seminarId), row])
    );

    const jsonKeys = new Set(
      rosters.map((roster) => rosterSessionKey(roster.eventId, roster.seminarId))
    );
    const dbKeys = new Set(dbByKey.keys());

    const missingFromDb = [...jsonKeys].filter((key) => !dbKeys.has(key));
    const extraInDb = [...dbKeys].filter((key) => !jsonKeys.has(key));

    const comparisonRows = rosters.map((roster) => {
      const key = rosterSessionKey(roster.eventId, roster.seminarId);
      const dbRow = dbByKey.get(key);
      if (!dbRow) {
        return {
          rosterKey: key,
          exactMatch: false,
          fieldMismatches: ["missing_from_database"],
          panelistOrderMismatch: false,
          partnerIdMismatches: [],
        };
      }
      return compareSeminarRosters(roster, dbRow);
    });

    const exactMatches = comparisonRows
      .filter((row) => row.exactMatch)
      .map((row) => row.rosterKey);
    const rostersNeedingUpdate = comparisonRows
      .filter((row) => !row.exactMatch)
      .map((row) => row.rosterKey);

    const report = {
      mode: dryRun ? "DRY-RUN" : "APPLY",
      source: resolvedSource,
      counts: preflight.counts,
      databasePrecheck: {
        seminar_session_rosters: dbRows.length,
      },
      exactMatchCount: exactMatches.length,
      exactMatches,
      rostersNeedingUpdate,
      missingFromDb,
      extraInDb,
      comparisonRows,
      noDatabaseWrites: dryRun,
    };

    console.log(JSON.stringify(report, null, 2));

    if (extraInDb.length > 0) {
      throw new Error(
        `Reconciliation stopped: ${extraInDb.length} unexpected database roster row(s)`
      );
    }

    if (dryRun) {
      console.log("DRY-RUN PASS");
      return;
    }

    if (rostersNeedingUpdate.length === 0) {
      console.log("RECONCILIATION APPLY PASS (already exact)");
      return;
    }

    const plan = buildSeminarRosterImportPlan(
      rosters.filter((roster) =>
        rostersNeedingUpdate.includes(
          rosterSessionKey(roster.eventId, roster.seminarId)
        )
      )
    );

    await applyReconciliation(prisma, plan, dbRows.length);

    const verificationRows = await prisma.seminarSessionRoster.findMany();
    const verification = rosters.map((roster) => {
      const key = rosterSessionKey(roster.eventId, roster.seminarId);
      const dbRow = verificationRows.find(
        (row) => rosterSessionKey(row.eventId, row.seminarId) === key
      );
      if (!dbRow) {
        return {
          rosterKey: key,
          exactMatch: false,
          fieldMismatches: ["missing_after_apply"],
          panelistOrderMismatch: false,
          partnerIdMismatches: [],
        };
      }
      return compareSeminarRosters(roster, dbRow);
    });

    console.log(
      JSON.stringify(
        {
          postApplyVerification: {
            exactMatchCount: verification.filter((row) => row.exactMatch).length,
            remainingMismatches: verification.filter((row) => !row.exactMatch),
          },
        },
        null,
        2
      )
    );

    if (verification.some((row) => !row.exactMatch)) {
      throw new Error("Post-apply verification failed");
    }

    console.log("RECONCILIATION APPLY PASS");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
