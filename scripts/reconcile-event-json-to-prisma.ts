/**
 * Compare production Event JSON snapshot against Prisma Event catalog.
 *
 * Usage:
 *   npx tsx scripts/reconcile-event-json-to-prisma.ts --source <events-store.json>
 */
import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { reconcileEventJsonToPrisma } from "../lib/server/event-reconciliation";
import { listPrismaEvents } from "../lib/server/event-prisma-store";
import type { Event } from "../types";

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
      "Usage: npx tsx scripts/reconcile-event-json-to-prisma.ts --source <events-store.json>"
    );
    process.exit(1);
  }
  if (!sourcePath) {
    console.error(
      "Usage: npx tsx scripts/reconcile-event-json-to-prisma.ts --source <events-store.json>"
    );
    process.exit(1);
  }
  return { sourcePath: path.resolve(sourcePath) };
}

function readEventsSource(sourcePath: string): Event[] {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }
  const raw = fs.readFileSync(sourcePath, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Source must be a JSON array: ${sourcePath}`);
  }
  return parsed as Event[];
}

async function main(): Promise<void> {
  const { sourcePath } = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in .env.local");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const jsonEvents = readEventsSource(sourcePath);
    const prismaEvents = await listPrismaEvents();
    const report = reconcileEventJsonToPrisma({ jsonEvents, prismaEvents });

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

    if (!report.safeForWriteCutover) {
      process.exitCode = 1;
    } else {
      console.log("DRY-RUN PASS");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
