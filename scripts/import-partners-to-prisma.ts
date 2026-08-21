/**
 * Import SPOCs and Partners from explicit JSON snapshots into Prisma/Supabase.
 *
 * Usage:
 *   npx tsx scripts/import-partners-to-prisma.ts <spocs.json> <partners.json> [--apply]
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import {
  buildPartnerImportPlan,
  validatePartnerSources,
} from "../lib/server/partner-prisma-import-map";
import {
  parsePartnerImportArgs,
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

async function loadCatalogIds(prisma: PrismaClient): Promise<{
  eventIds: Set<string>;
  seminarIds: Set<string>;
}> {
  const [events, seminars] = await Promise.all([
    prisma.event.findMany({ select: { id: true } }),
    prisma.seminar.findMany({ select: { id: true } }),
  ]);

  return {
    eventIds: new Set(events.map((event) => event.id)),
    seminarIds: new Set(seminars.map((seminar) => seminar.id)),
  };
}

async function assertDatabaseReadyForImport(
  prisma: PrismaClient,
  plan: ReturnType<typeof buildPartnerImportPlan>
): Promise<void> {
  const [existingSpocIds, existingPartnerIds] = await Promise.all([
    prisma.spoc.findMany({
      where: { id: { in: plan.spocs.map((spoc) => spoc.id) } },
      select: { id: true },
    }),
    prisma.partner.findMany({
      where: { id: { in: plan.partners.map((partner) => partner.id) } },
      select: { id: true },
    }),
  ]);

  if (existingSpocIds.length > 0 || existingPartnerIds.length > 0) {
    throw new Error(
      [
        "Import target IDs already exist in Supabase.",
        existingSpocIds.length > 0
          ? `Existing SPOC ids: ${existingSpocIds.map((row) => row.id).join(", ")}`
          : null,
        existingPartnerIds.length > 0
          ? `Existing partner ids: ${existingPartnerIds.map((row) => row.id).join(", ")}`
          : null,
        "Resolve conflicts or truncate partner tables before re-import.",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }
}

async function applyImportPlan(
  prisma: PrismaClient,
  plan: ReturnType<typeof buildPartnerImportPlan>
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    if (plan.spocs.length > 0) {
      await tx.spoc.createMany({ data: plan.spocs });
    }
    if (plan.partners.length > 0) {
      await tx.partner.createMany({ data: plan.partners });
    }
    if (plan.eventLinks.length > 0) {
      await tx.partnerEventLink.createMany({ data: plan.eventLinks });
    }
    if (plan.eventPartnerships.length > 0) {
      await tx.partnerEventPartnership.createMany({
        data: plan.eventPartnerships,
      });
    }
    if (plan.seminarSlotAssignments.length > 0) {
      await tx.partnerSeminarSlotAssignment.createMany({
        data: plan.seminarSlotAssignments,
      });
    }
  });
}

async function main(): Promise<void> {
  const { spocsPath, partnersPath, apply } = parsePartnerImportArgs(
    process.argv.slice(2)
  );
  const spocs = readSpocSource(path.resolve(spocsPath));
  const partners = readPartnerSource(path.resolve(partnersPath));

  const prisma = createPrismaClient();

  try {
    const catalog = await loadCatalogIds(prisma);
    const validation = validatePartnerSources({
      spocs,
      partners,
      knownEventIds: catalog.eventIds,
      knownSeminarIds: catalog.seminarIds,
    });

    if (!validation.ok) {
      throw new Error(
        ["Partner import validation failed:", ...validation.errors].join("\n")
      );
    }

    const plan = buildPartnerImportPlan({ spocs, partners });

    if (apply) {
      await assertDatabaseReadyForImport(prisma, plan);
    }

    const summary = {
      mode: apply ? "APPLY" : "DRY-RUN",
      spocs: plan.spocs.length,
      partners: plan.partners.length,
      partnerEventLinks: plan.eventLinks.length,
      partnerEventPartnerships: plan.eventPartnerships.length,
      partnerSeminarSlotAssignments: plan.seminarSlotAssignments.length,
      warnings: plan.warnings,
      databasePrecheck: {
        events: catalog.eventIds.size,
        seminars: catalog.seminarIds.size,
        spocs: apply
          ? await prisma.spoc.count()
          : "skipped until --apply (schema may be pending)",
        partners: apply
          ? await prisma.partner.count()
          : "skipped until --apply (schema may be pending)",
        partner_event_links: apply
          ? await prisma.partnerEventLink.count()
          : "skipped until --apply (schema may be pending)",
        partner_event_partnerships: apply
          ? await prisma.partnerEventPartnership.count()
          : "skipped until --apply (schema may be pending)",
        partner_seminar_slot_assignments: apply
          ? await prisma.partnerSeminarSlotAssignment.count()
          : "skipped until --apply (schema may be pending)",
      },
    };

    if (!apply) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    await applyImportPlan(prisma, plan);

    console.log(
      JSON.stringify(
        {
          ...summary,
          applied: true,
          databaseAfter: {
            spocs: await prisma.spoc.count(),
            partners: await prisma.partner.count(),
            partner_event_links: await prisma.partnerEventLink.count(),
            partner_event_partnerships:
              await prisma.partnerEventPartnership.count(),
            partner_seminar_slot_assignments:
              await prisma.partnerSeminarSlotAssignment.count(),
          },
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
