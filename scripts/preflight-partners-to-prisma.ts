/**
 * Preflight partner/SPOC JSON snapshots against Prisma catalog constraints.
 *
 * Usage:
 *   npx tsx scripts/preflight-partners-to-prisma.ts <spocs.json> <partners.json>
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import {
  buildPartnerImportPlan,
  detectPortalLoginCollisions,
  validatePartnerSources,
} from "../lib/server/partner-prisma-import-map";
import {
  readPartnerSource,
  readSpocSource,
} from "./lib/partner-import-shared";

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
  const positional = process.argv.slice(2);
  if (positional.length !== 2) {
    console.error(
      "Usage: npx tsx scripts/preflight-partners-to-prisma.ts <spocs.json> <partners.json>"
    );
    process.exit(1);
  }

  const spocs = readSpocSource(path.resolve(positional[0]!));
  const partners = readPartnerSource(path.resolve(positional[1]!));

  const prisma = createPrismaClient();

  try {
    const [events, seminars] = await Promise.all([
      prisma.event.findMany({ select: { id: true } }),
      prisma.seminar.findMany({ select: { id: true } }),
    ]);

    const validation = validatePartnerSources({
      spocs,
      partners,
      knownEventIds: new Set(events.map((event) => event.id)),
      knownSeminarIds: new Set(seminars.map((seminar) => seminar.id)),
    });

    const plan = buildPartnerImportPlan({ spocs, partners });

    console.log(
      JSON.stringify(
        {
          ok: validation.ok,
          errors: validation.ok ? [] : validation.errors,
          portalLoginCollisions: detectPortalLoginCollisions(partners),
          counts: {
            spocs: spocs.length,
            partners: partners.length,
            partnerEventLinks: plan.eventLinks.length,
            partnerEventPartnerships: plan.eventPartnerships.length,
            partnerSeminarSlotAssignments: plan.seminarSlotAssignments.length,
          },
          warnings: plan.warnings,
          catalog: {
            events: events.length,
            seminars: seminars.length,
          },
        },
        null,
        2
      )
    );

    if (!validation.ok) {
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
