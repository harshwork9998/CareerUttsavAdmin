/**
 * Preflight seminar roster JSON snapshot against Prisma catalog constraints.
 *
 * Usage:
 *   npx tsx scripts/preflight-seminar-rosters-to-prisma.ts --source <rosters.json>
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import {
  type SeminarCatalogEntry,
  validateSeminarRosterSources,
} from "../lib/server/seminar-roster-prisma-import-map";
import {
  parseSeminarRosterPreflightArgs,
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

async function main(): Promise<void> {
  const { sourcePath } = parseSeminarRosterPreflightArgs(process.argv.slice(2));
  const resolvedSource = path.resolve(sourcePath);
  const rosters = readSeminarRosterSource(resolvedSource);

  const prisma = createPrismaClient();

  try {
    const [events, seminars, partners] = await Promise.all([
      prisma.event.findMany({ select: { id: true } }),
      prisma.seminar.findMany({
        select: { id: true, eventId: true, panelistSlots: true },
      }),
      prisma.partner.findMany({ select: { id: true } }),
    ]);

    const seminarCatalog = new Map<string, SeminarCatalogEntry>(
      seminars.map((seminar) => [
        seminar.id,
        {
          id: seminar.id,
          eventId: seminar.eventId,
          panelistSlots: seminar.panelistSlots,
        },
      ])
    );

    const result = validateSeminarRosterSources({
      rosters,
      knownEventIds: new Set(events.map((event) => event.id)),
      seminarCatalog,
      knownPartnerIds: new Set(partners.map((partner) => partner.id)),
    });

    console.log(
      JSON.stringify(
        {
          mode: "PREFLIGHT",
          source: resolvedSource,
          ok: result.ok,
          counts: result.counts,
          errors: result.errors,
          warnings: result.warnings,
          catalog: {
            events: events.length,
            seminars: seminars.length,
            partners: partners.length,
          },
          noDatabaseWrites: true,
        },
        null,
        2
      )
    );

    if (!result.ok) {
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
