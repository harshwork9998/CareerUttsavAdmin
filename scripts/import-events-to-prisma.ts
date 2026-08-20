/**
 * Import evt-001 and nested seminars from a production events-store JSON file into Prisma.
 * Does not modify JSON persistence or Admin APIs.
 *
 * Usage:
 *   npx tsx scripts/import-events-to-prisma.ts <path/to/events-store.json> [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type EventStatus, type Prisma } from "../lib/generated/prisma/client";
import { EVENT_STATUSES } from "../constants";
import type { Event, EventSeminar } from "../types";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

const TARGET_EVENT_ID = "evt-001";

const EVENT_REQUIRED_FIELDS = [
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
] as const satisfies readonly (keyof Event)[];

const SEMINAR_REQUIRED_FIELDS = [
  "id",
  "title",
  "date",
  "startTime",
  "endTime",
  "panelistSlots",
  "hall",
] as const satisfies readonly (keyof EventSeminar)[];

type ParsedArgs = {
  sourcePath: string;
  dryRun: boolean;
};

type MappedEvent = Prisma.EventCreateInput;
type MappedSeminar = Prisma.SeminarCreateWithoutEventInput;

function printUsage(): never {
  console.error(
    [
      "Usage:",
      "  npx tsx scripts/import-events-to-prisma.ts <path/to/events-store.json> [--dry-run]",
      "",
      "Examples:",
      "  npx tsx scripts/import-events-to-prisma.ts /path/to/events-store.json --dry-run",
      "  npx tsx scripts/import-events-to-prisma.ts /path/to/events-store.json",
      "",
      "Notes:",
      "  - Imports only evt-001 and its nested seminars.",
      "  - Does not read data/events-store.json automatically.",
      "  - Use --dry-run to validate without writing to Supabase.",
    ].join("\n")
  );
  process.exit(1);
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional = argv.filter((arg) => arg !== "--dry-run");
  const dryRun = argv.includes("--dry-run");

  if (positional.length !== 1) {
    printUsage();
  }

  const sourcePath = path.resolve(positional[0]!);
  return { sourcePath, dryRun };
}

function readEventsStore(sourcePath: string): Event[] {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }

  const raw = fs.readFileSync(sourcePath, "utf-8");
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Source file is not valid JSON: ${sourcePath}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Source file must contain a JSON array of events: ${sourcePath}`);
  }

  return parsed as Event[];
}

function findTargetEvent(events: Event[]): Event {
  const target = events.find((event) => event.id === TARGET_EVENT_ID);
  if (!target) {
    throw new Error(`Event ${TARGET_EVENT_ID} not found in source file`);
  }
  return target;
}

function parseRequiredDate(value: unknown, fieldName: string): Date {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing or invalid required date field: ${fieldName}`);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ISO date for ${fieldName}: ${value}`);
  }

  return date;
}

function assertRequiredEventFields(event: Event): void {
  for (const field of EVENT_REQUIRED_FIELDS) {
    const value = event[field];
    if (value === undefined || value === null) {
      throw new Error(`Missing required event field: ${field}`);
    }
  }

  if (!EVENT_STATUSES.includes(event.status)) {
    throw new Error(`Invalid event status: ${String(event.status)}`);
  }

  if (!Array.isArray(event.tags)) {
    throw new Error("Event field tags must be an array");
  }

  if (typeof event.isFeatured !== "boolean") {
    throw new Error("Event field isFeatured must be a boolean");
  }

  if (!Number.isInteger(event.hallCount)) {
    throw new Error("Event field hallCount must be an integer");
  }

  if (!Number.isInteger(event.maxCapacity)) {
    throw new Error("Event field maxCapacity must be an integer");
  }

  if (!Number.isInteger(event.registrationCount)) {
    throw new Error("Event field registrationCount must be an integer");
  }

  if (!Number.isInteger(event.checkInCount)) {
    throw new Error("Event field checkInCount must be an integer");
  }

  if (!Array.isArray(event.seminars)) {
    throw new Error("Event field seminars must be an array");
  }
}

function validateSeminars(seminars: EventSeminar[]): void {
  const seenIds = new Set<string>();

  for (const [index, seminar] of seminars.entries()) {
    for (const field of SEMINAR_REQUIRED_FIELDS) {
      const value = seminar[field];
      if (value === undefined || value === null) {
        throw new Error(`Seminar[${index}] missing required field: ${field}`);
      }
    }

    if (seenIds.has(seminar.id)) {
      throw new Error(`Duplicate seminar id in source file: ${seminar.id}`);
    }
    seenIds.add(seminar.id);

    if (!Number.isInteger(seminar.panelistSlots)) {
      throw new Error(`Seminar ${seminar.id}: panelistSlots must be an integer`);
    }

    if (!Number.isInteger(seminar.hall)) {
      throw new Error(`Seminar ${seminar.id}: hall must be an integer`);
    }
  }
}

function mapEvent(event: Event): MappedEvent {
  assertRequiredEventFields(event);
  validateSeminars(event.seminars);

  return {
    id: event.id,
    title: event.title,
    slug: event.slug,
    description: event.description,
    shortDescription: event.shortDescription ?? null,
    status: event.status as EventStatus,
    venue: event.venue,
    address: event.address,
    city: event.city,
    state: event.state,
    pincode: event.pincode,
    startDate: event.startDate,
    endDate: event.endDate,
    startTime: event.startTime,
    endTime: event.endTime,
    hallCount: event.hallCount,
    registrationDeadline: parseRequiredDate(
      event.registrationDeadline,
      "registrationDeadline"
    ),
    maxCapacity: event.maxCapacity,
    registrationCount: event.registrationCount,
    checkInCount: event.checkInCount,
    bannerImage: event.bannerImage ?? null,
    isFeatured: event.isFeatured,
    tags: event.tags,
    createdBy: event.createdBy,
    createdAt: parseRequiredDate(event.createdAt, "createdAt"),
    updatedAt: parseRequiredDate(event.updatedAt, "updatedAt"),
  };
}

function mapSeminars(event: Event): MappedSeminar[] {
  return event.seminars.map((seminar) => ({
    id: seminar.id,
    title: seminar.title,
    date: seminar.date,
    startTime: seminar.startTime,
    endTime: seminar.endTime,
    panelistSlots: seminar.panelistSlots,
    hall: seminar.hall,
  }));
}

function createPrismaClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in .env.local");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
}

async function assertNoDuplicates(
  prisma: PrismaClient,
  seminarIds: string[]
): Promise<void> {
  const existingEvent = await prisma.event.findUnique({
    where: { id: TARGET_EVENT_ID },
    select: { id: true },
  });

  if (existingEvent) {
    throw new Error(`Event ${TARGET_EVENT_ID} already exists in Supabase`);
  }

  if (seminarIds.length === 0) {
    return;
  }

  const existingSeminars = await prisma.seminar.findMany({
    where: { id: { in: seminarIds } },
    select: { id: true },
  });

  if (existingSeminars.length > 0) {
    const ids = existingSeminars.map((seminar) => seminar.id).join(", ");
    throw new Error(`Seminar id(s) already exist in Supabase: ${ids}`);
  }
}

async function importEventAndSeminars(
  prisma: PrismaClient,
  eventData: MappedEvent,
  seminars: MappedSeminar[]
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.event.create({ data: eventData });

    if (seminars.length > 0) {
      await tx.seminar.createMany({
        data: seminars.map((seminar) => ({
          ...seminar,
          eventId: TARGET_EVENT_ID,
        })),
      });
    }
  });
}

function reportDryRun(event: Event, seminars: MappedSeminar[]): void {
  console.log("DRY-RUN PASS");
  console.log(`eventId=${event.id}`);
  console.log(`eventTitle=${event.title}`);
  console.log(`seminarCount=${seminars.length}`);
  console.log(`registrationCount=${event.registrationCount}`);
  console.log(`checkInCount=${event.checkInCount}`);
  console.log("seminars=");

  for (const seminar of seminars) {
    console.log(`  - ${seminar.id}: ${seminar.title}`);
  }

  console.log("No database writes performed.");
}

async function main(): Promise<void> {
  const { sourcePath, dryRun } = parseArgs(process.argv.slice(2));
  const events = readEventsStore(sourcePath);
  const event = findTargetEvent(events);
  const eventData = mapEvent(event);
  const seminars = mapSeminars(event);
  const prisma = createPrismaClient();

  try {
    await assertNoDuplicates(
      prisma,
      seminars.map((seminar) => seminar.id)
    );

    if (dryRun) {
      reportDryRun(event, seminars);
      return;
    }

    await importEventAndSeminars(prisma, eventData, seminars);
    console.log("IMPORT PASS");
    console.log(`eventId=${event.id}`);
    console.log(`seminarCount=${seminars.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
