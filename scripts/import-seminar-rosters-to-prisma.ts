/**
 * Import seminar session rosters from explicit JSON snapshot into Prisma/Supabase.
 *
 * Usage:
 *   npx tsx scripts/import-seminar-rosters-to-prisma.ts --source <rosters.json> [--apply]
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import {
  buildSeminarRosterImportPlan,
  type SeminarCatalogEntry,
  validateSeminarRosterSources,
} from "../lib/server/seminar-roster-prisma-import-map";
import {
  parseSeminarRosterImportArgs,
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

async function applyImportPlan(
  prisma: PrismaClient,
  plan: ReturnType<typeof buildSeminarRosterImportPlan>,
  expectedExistingCount: number
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const currentCount = await tx.seminarSessionRoster.count();
    if (currentCount !== expectedExistingCount) {
      throw new Error(
        `Seminar roster count changed during import (${expectedExistingCount} -> ${currentCount})`
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
  const { sourcePath, apply } = parseSeminarRosterImportArgs(
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

    const plan = buildSeminarRosterImportPlan(rosters);
    const beforeCount = await prisma.seminarSessionRoster.count();

    const report = {
      mode: apply ? "APPLY" : "DRY-RUN",
      source: resolvedSource,
      ok: preflight.ok,
      counts: preflight.counts,
      errors: preflight.errors,
      warnings: preflight.warnings,
      databaseBefore: {
        seminar_session_rosters: beforeCount,
      },
      databaseAfter: apply ? undefined : { seminar_session_rosters: beforeCount },
      importRows: plan.length,
      noDatabaseWrites: !apply,
    };

    console.log(JSON.stringify(report, null, 2));

    if (!preflight.ok) {
      throw new Error(
        `Import refused: ${preflight.errors.length} preflight error(s)`
      );
    }

    if (!apply) {
      console.log("DRY-RUN PASS");
      return;
    }

    await applyImportPlan(prisma, plan, beforeCount);
    const afterCount = await prisma.seminarSessionRoster.count();

    console.log(
      JSON.stringify(
        {
          databaseAfter: {
            seminar_session_rosters: afterCount,
          },
        },
        null,
        2
      )
    );
    console.log("IMPORT APPLY PASS");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
