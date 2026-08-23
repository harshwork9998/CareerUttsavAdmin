/**
 * Import Admin users from explicit JSON snapshot into Prisma/Supabase.
 *
 * Usage:
 *   npx tsx scripts/import-users-to-prisma.ts --source <users-store.json> [--apply]
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { importPrismaAdminUsers } from "../lib/server/admin-user-prisma-store";
import {
  buildUserPreflightReport,
  readUserAuthSource,
  recordsToImportRows,
} from "./lib/user-import-shared";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

function parseArgs(argv: string[]): { sourcePath: string; apply: boolean } {
  let sourcePath: string | undefined;
  let apply = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === "--source") {
      sourcePath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    console.error(
      "Usage: npx tsx scripts/import-users-to-prisma.ts --source <users-store.json> [--apply]"
    );
    process.exit(1);
  }
  if (!sourcePath) {
    console.error(
      "Usage: npx tsx scripts/import-users-to-prisma.ts --source <users-store.json> [--apply]"
    );
    process.exit(1);
  }
  return { sourcePath: path.resolve(sourcePath), apply };
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
  const { sourcePath, apply } = parseArgs(process.argv.slice(2));
  const records = readUserAuthSource(sourcePath);
  const preflight = buildUserPreflightReport(sourcePath, records);
  const rows = recordsToImportRows(records);

  const prisma = createPrismaClient();

  try {
    const existingCount = await prisma.adminUser.count();
    if (existingCount > 0) {
      throw new Error(
        `admin_users table is not empty (${existingCount} rows). Refuse import.`
      );
    }

    const plan = {
      mode: apply ? "APPLY" : "DRY-RUN",
      source: sourcePath,
      totalUsers: rows.length,
      preflight,
      noDatabaseWrites: !apply,
    };

    if (!apply) {
      console.log(JSON.stringify(plan, null, 2));
      return;
    }

    if (!preflight.safeToImport) {
      throw new Error("Preflight failed — resolve issues before --apply");
    }

    await importPrismaAdminUsers(rows);
    const afterCount = await prisma.adminUser.count();

    console.log(
      JSON.stringify(
        {
          ...plan,
          importedUsers: afterCount,
          success: true,
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
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
