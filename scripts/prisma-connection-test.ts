/**
 * Read-only Prisma / Postgres connectivity check.
 * Does not create tables, write rows, or run migrations.
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in .env.local");
  }

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const rows = await prisma.$queryRaw<
      Array<{ ok: number; current_database: string; current_user: string }>
    >`SELECT 1 AS ok, current_database(), current_user`;

    const row = rows[0];
    console.log("Connection test PASS");
    console.log(`ok=${row?.ok}`);
    console.log(`current_database=${row?.current_database}`);
    console.log(`current_user=${row?.current_user}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Connection test FAIL");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
