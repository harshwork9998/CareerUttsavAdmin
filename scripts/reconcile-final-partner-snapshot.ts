/**
 * Final production partner/SPOC delta reconciliation against Supabase.
 *
 * Usage:
 *   npx tsx scripts/reconcile-final-partner-snapshot.ts \
 *     <path/to/spocs-store.json> \
 *     <path/to/partners-store.json> \
 *     [--dry-run]
 *
 * Example:
 *   npx tsx scripts/reconcile-final-partner-snapshot.ts \
 *     tmp/db-import/spocs-store.final.json \
 *     tmp/db-import/partners-store.final.json \
 *     --dry-run
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import {
  buildPartnerReconciliationPlan,
  summarizePartnerReconciliationPlan,
} from "../lib/server/partner-reconciliation-plan";
import {
  mapPartnerEventLinks,
  mapPartnerEventPartnerships,
  mapPartnerSeminarSlotAssignments,
  mapPartnerSourceToPrisma,
  mapSpocSourceToPrisma,
  validatePartnerSources,
} from "../lib/server/partner-prisma-import-map";
import type { PrismaPartnerRecord } from "../lib/server/partner-prisma-map";
import type { Partner } from "../types";
import {
  readPartnerSource,
  readSpocSource,
} from "./lib/partner-import-shared";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

type ParsedArgs = {
  spocsPath: string;
  partnersPath: string;
  dryRun: boolean;
};

type DbCounts = {
  spocs: number;
  partners: number;
  eventLinks: number;
  partnerships: number;
  seminarSlotAssignments: number;
};

function printUsage(): never {
  console.error(
    [
      "Usage:",
      "  npx tsx scripts/reconcile-final-partner-snapshot.ts \\",
      "    <path/to/spocs-store.json> \\",
      "    <path/to/partners-store.json> \\",
      "    [--dry-run]",
      "",
      "Examples:",
      "  npx tsx scripts/reconcile-final-partner-snapshot.ts \\",
      "    tmp/db-import/spocs-store.final.json \\",
      "    tmp/db-import/partners-store.final.json \\",
      "    --dry-run",
      "",
      "Notes:",
      "  - Never reads data/*.json automatically.",
      "  - --dry-run performs zero database writes.",
      "  - Omit --dry-run to APPLY reconciliation in a single transaction.",
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
    spocsPath: path.resolve(positional[0]!),
    partnersPath: path.resolve(positional[1]!),
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

async function loadDatabaseState(prisma: PrismaClient) {
  const [spocs, partners] = await Promise.all([
    prisma.spoc.findMany(),
    prisma.partner.findMany({
      include: {
        eventLinks: true,
        eventPartnerships: {
          include: {
            seminarSlotAssignments: true,
          },
        },
      },
    }),
  ]);

  const dbSpocsById = new Map(spocs.map((spoc) => [spoc.id, spoc]));
  const dbPartnersById = new Map<string, PrismaPartnerRecord>(
    partners.map((partner) => [partner.id, partner])
  );

  return {
    dbSpocsById,
    dbPartnersById,
  };
}

async function loadDbCounts(prisma: PrismaClient): Promise<DbCounts> {
  const [
    spocs,
    partners,
    eventLinks,
    partnerships,
    seminarSlotAssignments,
  ] = await Promise.all([
    prisma.spoc.count(),
    prisma.partner.count(),
    prisma.partnerEventLink.count(),
    prisma.partnerEventPartnership.count(),
    prisma.partnerSeminarSlotAssignment.count(),
  ]);

  return {
    spocs,
    partners,
    eventLinks,
    partnerships,
    seminarSlotAssignments,
  };
}

async function applyPartnerReconciliation(
  prisma: PrismaClient,
  input: {
    jsonSpocs: ReturnType<typeof readSpocSource>;
    jsonPartners: Partner[];
    partnersNeedingUpdate: string[];
    spocsNeedingUpdate: string[];
    expectedCounts: DbCounts;
  }
): Promise<void> {
  const partnersById = new Map(
    input.jsonPartners.map((partner) => [partner.id, partner])
  );
  const spocsById = new Map(input.jsonSpocs.map((spoc) => [spoc.id, spoc]));

  await prisma.$transaction(async (tx) => {
    const currentCounts = await Promise.all([
      tx.spoc.count(),
      tx.partner.count(),
      tx.partnerEventLink.count(),
      tx.partnerEventPartnership.count(),
      tx.partnerSeminarSlotAssignment.count(),
    ]);

    if (
      currentCounts[0] !== input.expectedCounts.spocs ||
      currentCounts[1] !== input.expectedCounts.partners ||
      currentCounts[2] !== input.expectedCounts.eventLinks ||
      currentCounts[3] !== input.expectedCounts.partnerships ||
      currentCounts[4] !== input.expectedCounts.seminarSlotAssignments
    ) {
      throw new Error(
        "Partner/SPOC table counts changed during reconciliation transaction"
      );
    }

    for (const spocId of input.spocsNeedingUpdate) {
      const jsonSpoc = spocsById.get(spocId);
      if (!jsonSpoc) {
        throw new Error(`Missing SPOC source for ${spocId}`);
      }

      const mapped = mapSpocSourceToPrisma(jsonSpoc);
      await tx.spoc.update({
        where: { id: spocId },
        data: {
          name: mapped.name,
          organization: mapped.organization,
          phone: mapped.phone,
          email: mapped.email,
          emailNormalized: mapped.emailNormalized,
          updatedAt: mapped.updatedAt,
        },
      });
    }

    for (const partnerId of input.partnersNeedingUpdate) {
      const jsonPartner = partnersById.get(partnerId);
      if (!jsonPartner) {
        throw new Error(`Missing partner source for ${partnerId}`);
      }

      const mapped = mapPartnerSourceToPrisma(jsonPartner);
      await tx.partner.update({
        where: { id: partnerId },
        data: {
          name: mapped.name,
          city: mapped.city,
          state: mapped.state,
          stage: mapped.stage,
          primaryContact: mapped.primaryContact,
          secondaryContact: mapped.secondaryContact,
          relationshipOrganization: mapped.relationshipOrganization,
          relationshipManagerName: mapped.relationshipManagerName,
          relationshipManagerPhone: mapped.relationshipManagerPhone,
          relationshipManagerEmail: mapped.relationshipManagerEmail,
          relationshipSpocId: mapped.relationshipSpocId,
          stageRemarks: mapped.stageRemarks,
          meetings: mapped.meetings,
          contactedAt: mapped.contactedAt,
          contactedNotes: mapped.contactedNotes,
          meetingAt: mapped.meetingAt,
          meetingNotes: mapped.meetingNotes,
          notProceedingAt: mapped.notProceedingAt,
          notProceedingReason: mapped.notProceedingReason,
          sponsorshipTier: mapped.sponsorshipTier,
          sponsorshipNotes: mapped.sponsorshipNotes,
          legacyDeliverables: mapped.legacyDeliverables,
          deliverablesConfirmedAt: mapped.deliverablesConfirmedAt,
          seminarSlotsConfirmedAt: mapped.seminarSlotsConfirmedAt,
          totalAmount: mapped.totalAmount,
          discountAmount: mapped.discountAmount,
          netAmount: mapped.netAmount,
          commercialsConfirmedAt: mapped.commercialsConfirmedAt,
          portalLogin: mapped.portalLogin,
          portalLoginNormalized: mapped.portalLoginNormalized,
          portalInviteEmail: mapped.portalInviteEmail,
          portalInviteEmailNormalized: mapped.portalInviteEmailNormalized,
          portalPasswordHash: mapped.portalPasswordHash,
          portalAuthVersion: mapped.portalAuthVersion,
          portalPasswordChangedAt: mapped.portalPasswordChangedAt,
          portalPasswordPromptSkippedAt: mapped.portalPasswordPromptSkippedAt,
          portalInviteSentAt: mapped.portalInviteSentAt,
          portalDocuments: mapped.portalDocuments,
          portalFasciaName: mapped.portalFasciaName,
          portalWebsiteUrl: mapped.portalWebsiteUrl,
          portalSmsContent: mapped.portalSmsContent,
          portalSeminarSpeakers: mapped.portalSeminarSpeakers,
          portalRepresentatives: mapped.portalRepresentatives,
          updatedAt: mapped.updatedAt,
        },
      });

      await tx.partnerEventLink.deleteMany({ where: { partnerId } });
      await tx.partnerEventPartnership.deleteMany({ where: { partnerId } });

      const eventLinks = mapPartnerEventLinks(jsonPartner);
      const eventPartnerships = mapPartnerEventPartnerships(jsonPartner);
      const seminarSlotAssignments =
        mapPartnerSeminarSlotAssignments(jsonPartner);

      if (eventLinks.length > 0) {
        await tx.partnerEventLink.createMany({ data: eventLinks });
      }
      if (eventPartnerships.length > 0) {
        await tx.partnerEventPartnership.createMany({ data: eventPartnerships });
      }
      if (seminarSlotAssignments.length > 0) {
        await tx.partnerSeminarSlotAssignment.createMany({
          data: seminarSlotAssignments,
        });
      }
    }
  });
}

async function verifyReconciliation(
  prisma: PrismaClient,
  jsonSpocs: ReturnType<typeof readSpocSource>,
  jsonPartners: Partner[]
) {
  const dbState = await loadDatabaseState(prisma);
  const plan = buildPartnerReconciliationPlan({
    jsonSpocs,
    jsonPartners,
    dbSpocsById: dbState.dbSpocsById,
    dbPartnersById: dbState.dbPartnersById,
  });
  const counts = await loadDbCounts(prisma);
  const summary = summarizePartnerReconciliationPlan(plan);

  return {
    counts,
    summary,
    partnerRows: plan.partnerRows,
    spocRows: plan.spocRows,
    conflicts: plan.conflicts,
  };
}

function buildReport(input: {
  mode: "DRY-RUN" | "APPLY";
  spocsPath: string;
  partnersPath: string;
  plan: ReturnType<typeof buildPartnerReconciliationPlan>;
  dbCounts: DbCounts;
  verification?: Awaited<ReturnType<typeof verifyReconciliation>>;
}) {
  const summary = summarizePartnerReconciliationPlan(input.plan);

  return {
    mode: input.mode,
    spocsSource: input.spocsPath,
    partnersSource: input.partnersPath,
    totalJsonSpocs: input.plan.importPlan.spocs.length,
    totalJsonPartners: input.plan.importPlan.partners.length,
    importWarnings: input.plan.importPlan.warnings,
    databasePrecheck: input.dbCounts,
    conflictCount: input.plan.conflicts.length,
    conflicts: input.plan.conflicts.map((conflict) => ({
      code: conflict.code,
      entityId: conflict.entityId,
      fields: conflict.fields,
      message: conflict.message,
    })),
    spocsNeedingUpdate: input.plan.spocsNeedingUpdate,
    partnersNeedingUpdate: input.plan.partnersNeedingUpdate,
    spocReport: input.plan.spocRows.map((row) => ({
      id: row.id,
      exactMatch: row.exactMatch,
      fieldMismatches: row.fieldMismatches,
    })),
    partnerReport: input.plan.partnerRows.map((row) => ({
      id: row.id,
      exactMatch: row.exactMatch,
      fieldMismatches: row.fieldMismatches,
      authMismatches: row.authMismatches,
      relationalMismatches: row.relationalMismatches,
    })),
    summary,
    verification: input.verification
      ? {
          counts: input.verification.counts,
          exactSpocMatches: input.verification.summary.exactSpocMatches,
          exactPartnerMatches: input.verification.summary.exactPartnerMatches,
          authMismatchCount: input.verification.summary.authMismatchCount,
          relationalMismatchCount:
            input.verification.summary.relationalMismatchCount,
          remainingConflicts: input.verification.conflicts.length,
        }
      : undefined,
    noDatabaseWrites: input.mode === "DRY-RUN",
    noEmailOrPortalSideEffects: true,
    authFieldsPreservedExactly: true,
  };
}

async function main(): Promise<void> {
  const { spocsPath, partnersPath, dryRun } = parseArgs(process.argv.slice(2));

  const jsonSpocs = readSpocSource(spocsPath);
  const jsonPartners = readPartnerSource(partnersPath);
  const prisma = createPrismaClient();

  try {
    const catalog = await loadCatalogIds(prisma);
    const validation = validatePartnerSources({
      spocs: jsonSpocs,
      partners: jsonPartners,
      knownEventIds: catalog.eventIds,
      knownSeminarIds: catalog.seminarIds,
    });

    if (!validation.ok) {
      throw new Error(
        `Final partner snapshot validation failed:\n${validation.errors.join("\n")}`
      );
    }

    const dbState = await loadDatabaseState(prisma);
    const dbCounts = await loadDbCounts(prisma);
    const plan = buildPartnerReconciliationPlan({
      jsonSpocs,
      jsonPartners,
      dbSpocsById: dbState.dbSpocsById,
      dbPartnersById: dbState.dbPartnersById,
    });

    const report = buildReport({
      mode: dryRun ? "DRY-RUN" : "APPLY",
      spocsPath,
      partnersPath,
      plan,
      dbCounts,
    });

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

    if (
      plan.spocsNeedingUpdate.length === 0 &&
      plan.partnersNeedingUpdate.length === 0
    ) {
      console.log("RECONCILIATION APPLY PASS (already exact)");
      return;
    }

    await applyPartnerReconciliation(prisma, {
      jsonSpocs,
      jsonPartners,
      partnersNeedingUpdate: plan.partnersNeedingUpdate,
      spocsNeedingUpdate: plan.spocsNeedingUpdate,
      expectedCounts: dbCounts,
    });

    const verification = await verifyReconciliation(
      prisma,
      jsonSpocs,
      jsonPartners
    );

    const applyReport = buildReport({
      mode: "APPLY",
      spocsPath,
      partnersPath,
      plan,
      dbCounts,
      verification,
    });

    console.log(JSON.stringify({ postApplyVerification: applyReport.verification }, null, 2));

    if (
      verification.conflicts.length > 0 ||
      verification.summary.exactPartnerMatches !== jsonPartners.length ||
      verification.summary.exactSpocMatches !== jsonSpocs.length ||
      verification.summary.authMismatchCount > 0 ||
      verification.summary.relationalMismatchCount > 0
    ) {
      throw new Error("Post-apply verification failed");
    }

    console.log("RECONCILIATION APPLY PASS");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
