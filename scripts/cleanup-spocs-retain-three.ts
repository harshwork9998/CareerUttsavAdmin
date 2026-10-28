/**
 * One-time SPOC retention cleanup — keeps exactly three Relationship Owners.
 *
 * Usage:
 *   npx tsx scripts/cleanup-spocs-retain-three.ts --dry-run
 *   npx tsx scripts/cleanup-spocs-retain-three.ts --execute
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import {
  buildSpocCleanupDiagnosticReport,
  executeSpocRetentionCleanup,
} from "../lib/server/spoc-retention-cleanup";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

function createPrismaClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in .env.local");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
}

function printReport(
  report: Awaited<ReturnType<typeof buildSpocCleanupDiagnosticReport>>
): void {
  console.log("\n=== SPOC dependency notes ===");
  for (const note of report.dependencyNotes) {
    console.log(`- ${note}`);
  }

  console.log("\n=== Retained SPOCs (keep-list) ===");
  for (const row of report.retained) {
    console.log(
      `${row.id}\t${row.name}\t${row.organization}\tpartners=${row.partnerReferenceCount}\tadminUsers=${row.adminUserReferenceCount}`
    );
  }

  if (report.missingRetainedIds.length > 0) {
    console.log("\n=== Missing retained SPOC ids (not in database) ===");
    for (const id of report.missingRetainedIds) {
      console.log(id);
    }
  }

  if (report.retainedNameMismatches.length > 0) {
    console.log("\n=== Retained SPOC name mismatches ===");
    for (const row of report.retainedNameMismatches) {
      console.log(
        `${row.id}\texpected=${row.expectedName}\tfound=${row.actualName}`
      );
    }
  }

  if (report.plannedOrganizationUpdates.length > 0) {
    console.log("\n=== Planned organisation updates on execute ===");
    for (const row of report.plannedOrganizationUpdates) {
      console.log(`${row.id}\t${row.from}\t=>\t${row.to}`);
    }
  }

  console.log("\n=== Proposed for deletion ===");
  for (const row of report.proposedForDeletion) {
    console.log(
      `${row.id}\t${row.name}\t${row.organization}\tpartners=${row.partnerReferenceCount}\tadminUsers=${row.adminUserReferenceCount}`
    );
  }
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const execute = args.has("--execute");

  if (!dryRun && !execute) {
    console.error(
      "Usage: npx tsx scripts/cleanup-spocs-retain-three.ts --dry-run | --execute"
    );
    process.exit(1);
  }

  if (dryRun && execute) {
    console.error("Use only one of --dry-run or --execute");
    process.exit(1);
  }

  const prisma = createPrismaClient();

  try {
    const initialReport = await buildSpocCleanupDiagnosticReport(prisma);
    printReport(initialReport);

    const result = await executeSpocRetentionCleanup(prisma, { dryRun });

    console.log("\n=== Cleanup result ===");
    console.log(JSON.stringify(result, null, 2));

    if (result.errors.length > 0) {
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
