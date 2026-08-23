/**
 * Compare Admin users JSON snapshot against Prisma admin_users.
 *
 * Usage:
 *   npx tsx scripts/reconcile-users-json-to-prisma.ts --source <users-store.json>
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { mapPrismaAdminUserToApi } from "../lib/server/admin-user-prisma-map";
import { reconcileAdminUsersJsonToPrisma } from "../lib/server/admin-user-reconciliation";
import { readUserAuthSource } from "./lib/user-import-shared";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

function parseArgs(argv: string[]): { sourcePath: string } {
  let sourcePath: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === "--source") {
      sourcePath = argv[index + 1];
      index += 1;
      continue;
    }
    console.error(
      "Usage: npx tsx scripts/reconcile-users-json-to-prisma.ts --source <users-store.json>"
    );
    process.exit(1);
  }
  if (!sourcePath) {
    console.error(
      "Usage: npx tsx scripts/reconcile-users-json-to-prisma.ts --source <users-store.json>"
    );
    process.exit(1);
  }
  return { sourcePath: path.resolve(sourcePath) };
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
  const { sourcePath } = parseArgs(process.argv.slice(2));
  const records = readUserAuthSource(sourcePath);
  const jsonUsers = records.map((record) => ({
    ...record.user,
    email: record.user.email.trim().toLowerCase(),
  }));
  const sourcePasswordsByUserId = new Map(
    records.map((record) => [record.user.id, record.password])
  );

  const prisma = createPrismaClient();

  try {
    const prismaRecords = await prisma.adminUser.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const prismaUsers = prismaRecords.map((record) =>
      mapPrismaAdminUserToApi(record)
    );
    const prismaPasswordHashesByUserId = new Map(
      prismaRecords.map((record) => [record.id, record.passwordHash])
    );

    const report = reconcileAdminUsersJsonToPrisma({
      jsonUsers,
      sourcePasswordsByUserId,
      prismaUsers,
      prismaPasswordHashesByUserId,
    });

    console.log(
      JSON.stringify(
        {
          mode: "DRY-RUN",
          source: sourcePath,
          noDatabaseWrites: true,
          ...report,
        },
        null,
        2
      )
    );

    if (!report.safeForCutover) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
