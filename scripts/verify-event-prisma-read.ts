/**
 * Read-only verification for Prisma event serialization against imported data.
 * Does not write to Supabase.
 *
 * Usage: npx tsx scripts/verify-event-prisma-read.ts
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import {
  mapPrismaEventToApi,
  type PrismaEventRecord,
} from "../lib/server/event-prisma-map";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

async function readPrismaEventFacts(prisma: PrismaClient) {
  const [eventCount, seminarCount, registrationCount, evt001] =
    await Promise.all([
      prisma.event.count(),
      prisma.seminar.count(),
      prisma.registration.count(),
      prisma.event.findUnique({
        where: { id: "evt-001" },
        select: {
          id: true,
          registrationCount: true,
          checkInCount: true,
          _count: { select: { seminars: true } },
        },
      }),
    ]);

  return {
    eventCount,
    seminarCount,
    registrationCount,
    evt001: evt001
      ? {
          id: evt001.id,
          registrationCount: evt001.registrationCount,
          checkInCount: evt001.checkInCount,
          seminarCount: evt001._count.seminars,
        }
      : null,
  };
}

async function getPrismaEventById(
  prisma: PrismaClient,
  id: string
): Promise<PrismaEventRecord | null> {
  return prisma.event.findUnique({
    where: { id },
    include: { seminars: { orderBy: { id: "asc" } } },
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in .env.local");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const facts = await readPrismaEventFacts(prisma);
    const evt001Record = await getPrismaEventById(prisma, "evt-001");
    const evt001 = evt001Record ? mapPrismaEventToApi(evt001Record) : null;

    console.log("READ-ONLY PRISMA EVENT VERIFICATION");
    console.log(`events=${facts.eventCount}`);
    console.log(`seminars=${facts.seminarCount}`);
    console.log(`registrations=${facts.registrationCount}`);

    if (!facts.evt001) {
      throw new Error("evt-001 not found in Supabase");
    }

    console.log(`evt-001.registrationCount=${facts.evt001.registrationCount}`);
    console.log(`evt-001.checkInCount=${facts.evt001.checkInCount}`);
    console.log(`evt-001.seminarCount=${facts.evt001.seminarCount}`);

    if (!evt001) {
      throw new Error("evt-001 API serialization failed");
    }

    const requiredFields = [
      "id",
      "title",
      "slug",
      "description",
      "status",
      "venue",
      "address",
      "city",
      "state",
      "pincode",
      "startDate",
      "endDate",
      "startTime",
      "endTime",
      "hallCount",
      "registrationDeadline",
      "maxCapacity",
      "registrationCount",
      "checkInCount",
      "isFeatured",
      "tags",
      "createdBy",
      "createdAt",
      "updatedAt",
      "seminars",
    ] as const;

    for (const field of requiredFields) {
      if (evt001[field] === undefined) {
        throw new Error(`Missing serialized field: ${field}`);
      }
    }

    if (evt001.seminars.length !== 4) {
      throw new Error(`Expected 4 seminars, got ${evt001.seminars.length}`);
    }

    for (const seminar of evt001.seminars) {
      for (const field of [
        "id",
        "title",
        "date",
        "startTime",
        "endTime",
        "panelistSlots",
        "hall",
      ] as const) {
        if (seminar[field] === undefined) {
          throw new Error(`Seminar missing field: ${field}`);
        }
      }
      if (!Number.isInteger(seminar.hall)) {
        throw new Error(`Seminar hall must be integer, got ${seminar.hall}`);
      }
    }

    if (facts.evt001.registrationCount !== 8429) {
      throw new Error(
        `Unexpected registrationCount: ${facts.evt001.registrationCount}`
      );
    }
    if (facts.evt001.checkInCount !== 0) {
      throw new Error(`Unexpected checkInCount: ${facts.evt001.checkInCount}`);
    }
    if (facts.registrationCount !== 24) {
      throw new Error(
        `Unexpected registration row count: ${facts.registrationCount}`
      );
    }

    console.log("VERIFY PASS");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("VERIFY FAIL");
  console.error(error);
  process.exit(1);
});
