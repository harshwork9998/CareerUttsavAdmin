import type { Event, EventSeminar } from "@/types";

export type EventSeminarComparisonRow = {
  seminarId: string;
  exactMatch: boolean;
  fieldMismatches: string[];
  missingInDb: boolean;
  extraInDb: boolean;
};

export type EventReconciliationRow = {
  eventId: string;
  metadataExactMatch: boolean;
  metadataMismatches: string[];
  jsonRegistrationCount: number;
  prismaRegistrationCount: number;
  registrationCountDiffers: boolean;
  jsonCheckInCount: number;
  prismaCheckInCount: number;
  checkInCountDiffers: boolean;
  createdAtDiffers: boolean;
  updatedAtDiffers: boolean;
  registrationDeadlineDiffers: boolean;
  seminarComparisons: EventSeminarComparisonRow[];
  missingSeminarsInDb: string[];
  extraSeminarsInDb: string[];
};

export type EventReconciliationReport = {
  eventCountJson: number;
  eventCountPrisma: number;
  seminarCountJson: number;
  seminarCountPrisma: number;
  rows: EventReconciliationRow[];
  exactMetadataMatchCount: number;
  metadataMismatchCount: number;
  safeForWriteCutover: boolean;
};

const METADATA_FIELDS = [
  "title",
  "slug",
  "description",
  "shortDescription",
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
  "maxCapacity",
  "bannerImage",
  "isFeatured",
  "tags",
  "createdBy",
] as const;

function timestampInstant(value: string | Date | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function compareSeminarFields(
  jsonSeminar: EventSeminar,
  prismaSeminar: EventSeminar
): string[] {
  const mismatches: string[] = [];
  for (const field of [
    "title",
    "date",
    "startTime",
    "endTime",
    "panelistSlots",
    "hall",
  ] as const) {
    if (jsonSeminar[field] !== prismaSeminar[field]) {
      mismatches.push(field);
    }
  }
  return mismatches;
}

function compareSeminarsById(
  jsonSeminars: EventSeminar[],
  prismaSeminars: EventSeminar[]
): {
  comparisons: EventSeminarComparisonRow[];
  missingInDb: string[];
  extraInDb: string[];
} {
  const jsonById = new Map(jsonSeminars.map((seminar) => [seminar.id, seminar]));
  const prismaById = new Map(prismaSeminars.map((seminar) => [seminar.id, seminar]));

  const comparisons: EventSeminarComparisonRow[] = [];
  const missingInDb: string[] = [];
  const extraInDb: string[] = [];

  for (const [seminarId, jsonSeminar] of jsonById) {
    const prismaSeminar = prismaById.get(seminarId);
    if (!prismaSeminar) {
      missingInDb.push(seminarId);
      comparisons.push({
        seminarId,
        exactMatch: false,
        fieldMismatches: ["missing_in_db"],
        missingInDb: true,
        extraInDb: false,
      });
      continue;
    }
    const fieldMismatches = compareSeminarFields(jsonSeminar, prismaSeminar);
    comparisons.push({
      seminarId,
      exactMatch: fieldMismatches.length === 0,
      fieldMismatches,
      missingInDb: false,
      extraInDb: false,
    });
  }

  for (const seminarId of prismaById.keys()) {
    if (!jsonById.has(seminarId)) {
      extraInDb.push(seminarId);
      comparisons.push({
        seminarId,
        exactMatch: false,
        fieldMismatches: ["extra_in_db"],
        missingInDb: false,
        extraInDb: true,
      });
    }
  }

  return { comparisons, missingInDb, extraInDb };
}

export function reconcileEventJsonToPrisma(input: {
  jsonEvents: Event[];
  prismaEvents: Event[];
}): EventReconciliationReport {
  const prismaById = new Map(input.prismaEvents.map((event) => [event.id, event]));
  const rows: EventReconciliationRow[] = [];

  let exactMetadataMatchCount = 0;

  for (const jsonEvent of input.jsonEvents) {
    const prismaEvent = prismaById.get(jsonEvent.id);
    const metadataMismatches: string[] = [];

    if (!prismaEvent) {
      rows.push({
        eventId: jsonEvent.id,
        metadataExactMatch: false,
        metadataMismatches: ["missing_in_db"],
        jsonRegistrationCount: jsonEvent.registrationCount,
        prismaRegistrationCount: -1,
        registrationCountDiffers: true,
        jsonCheckInCount: jsonEvent.checkInCount,
        prismaCheckInCount: -1,
        checkInCountDiffers: true,
        createdAtDiffers: true,
        updatedAtDiffers: true,
        registrationDeadlineDiffers: true,
        seminarComparisons: [],
        missingSeminarsInDb: (jsonEvent.seminars ?? []).map((s) => s.id),
        extraSeminarsInDb: [],
      });
      continue;
    }

    for (const field of METADATA_FIELDS) {
      const jsonValue = jsonEvent[field];
      const prismaValue = prismaEvent[field];
      if (field === "shortDescription" || field === "bannerImage") {
        if (
          normalizeOptionalString(jsonValue as string | undefined) !==
          normalizeOptionalString(prismaValue as string | undefined)
        ) {
          metadataMismatches.push(field);
        }
        continue;
      }
      if (field === "tags") {
        if (JSON.stringify(jsonValue) !== JSON.stringify(prismaValue)) {
          metadataMismatches.push(field);
        }
        continue;
      }
      if (jsonValue !== prismaValue) {
        metadataMismatches.push(field);
      }
    }

    const registrationCountDiffers =
      jsonEvent.registrationCount !== prismaEvent.registrationCount;
    const checkInCountDiffers = jsonEvent.checkInCount !== prismaEvent.checkInCount;
    const createdAtDiffers =
      timestampInstant(jsonEvent.createdAt) !==
      timestampInstant(prismaEvent.createdAt);
    const updatedAtDiffers =
      timestampInstant(jsonEvent.updatedAt) !==
      timestampInstant(prismaEvent.updatedAt);
    const registrationDeadlineDiffers =
      timestampInstant(jsonEvent.registrationDeadline) !==
      timestampInstant(prismaEvent.registrationDeadline);

    const seminarResult = compareSeminarsById(
      jsonEvent.seminars ?? [],
      prismaEvent.seminars ?? []
    );

    const metadataExactMatch = metadataMismatches.length === 0;
    if (metadataExactMatch) exactMetadataMatchCount += 1;

    rows.push({
      eventId: jsonEvent.id,
      metadataExactMatch,
      metadataMismatches,
      jsonRegistrationCount: jsonEvent.registrationCount,
      prismaRegistrationCount: prismaEvent.registrationCount,
      registrationCountDiffers,
      jsonCheckInCount: jsonEvent.checkInCount,
      prismaCheckInCount: prismaEvent.checkInCount,
      checkInCountDiffers,
      createdAtDiffers,
      updatedAtDiffers,
      registrationDeadlineDiffers,
      seminarComparisons: seminarResult.comparisons,
      missingSeminarsInDb: seminarResult.missingInDb,
      extraSeminarsInDb: seminarResult.extraInDb,
    });
  }

  const seminarCountJson = input.jsonEvents.reduce(
    (count, event) => count + (event.seminars?.length ?? 0),
    0
  );
  const seminarCountPrisma = input.prismaEvents.reduce(
    (count, event) => count + (event.seminars?.length ?? 0),
    0
  );

  const metadataMismatchCount = rows.filter((row) => !row.metadataExactMatch).length;
  const seminarMismatch = rows.some(
    (row) =>
      row.missingSeminarsInDb.length > 0 ||
      row.extraSeminarsInDb.length > 0 ||
      row.seminarComparisons.some((comparison) => !comparison.exactMatch)
  );

  const safeForWriteCutover =
    input.jsonEvents.length === input.prismaEvents.length &&
    metadataMismatchCount === 0 &&
    !seminarMismatch;

  return {
    eventCountJson: input.jsonEvents.length,
    eventCountPrisma: input.prismaEvents.length,
    seminarCountJson,
    seminarCountPrisma,
    rows,
    exactMetadataMatchCount,
    metadataMismatchCount,
    safeForWriteCutover,
  };
}
