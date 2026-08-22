import { Prisma } from "@/lib/generated/prisma/client";
import type { SeminarSessionRoster, SeminarSpeaker } from "@/types";

import {
  mapOptionalSeminarRosterTextField,
  rosterSessionKey,
} from "@/lib/server/seminar-roster-prisma-import-map";

export type PrismaSeminarSessionRosterRecord = {
  eventId: string;
  seminarId: string;
  moderator: Prisma.JsonValue | null;
  panelists: Prisma.JsonValue;
  topicBrief: string | null;
  notes: string | null;
  updatedAt: Date;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

export function deepCanonicalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepCanonicalizeValue(item));
  }
  if (isPlainObject(value)) {
    const canonical: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort((left, right) =>
      left.localeCompare(right)
    )) {
      canonical[key] = deepCanonicalizeValue(value[key]);
    }
    return canonical;
  }
  return value;
}

export function deepCanonicalizeStableJson(value: unknown): string {
  return JSON.stringify(deepCanonicalizeValue(value));
}

function deepCanonicalValuesEqual(left: unknown, right: unknown): boolean {
  return (
    deepCanonicalizeStableJson(left) === deepCanonicalizeStableJson(right)
  );
}

function readSpeaker(
  value: Prisma.JsonValue | null | undefined
): SeminarSpeaker | null {
  if (value === null || value === undefined) {
    return null;
  }
  return value as unknown as SeminarSpeaker;
}

function readSpeakers(value: Prisma.JsonValue): SeminarSpeaker[] {
  return Array.isArray(value) ? (value as unknown as SeminarSpeaker[]) : [];
}

function isPrismaRosterRecord(
  roster: SeminarSessionRoster | PrismaSeminarSessionRosterRecord
): roster is PrismaSeminarSessionRosterRecord {
  return "updatedAt" in roster && roster.updatedAt instanceof Date;
}

function toApiRoster(
  roster: SeminarSessionRoster | PrismaSeminarSessionRosterRecord
): SeminarSessionRoster {
  return isPrismaRosterRecord(roster)
    ? mapPrismaSeminarRosterToApi(roster)
    : roster;
}

export function mapPrismaSeminarRosterToApi(
  record: PrismaSeminarSessionRosterRecord
): SeminarSessionRoster {
  const moderator = readSpeaker(record.moderator);
  const panelists = readSpeakers(record.panelists);

  return {
    eventId: record.eventId,
    seminarId: record.seminarId,
    moderator,
    panelists,
    topicBrief: record.topicBrief ?? undefined,
    notes: record.notes ?? undefined,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export type CanonicalSeminarRosterSnapshot = {
  eventId: string;
  seminarId: string;
  moderator: unknown;
  panelists: unknown;
  topicBrief: string | null;
  notes: string | null;
  updatedAt: number;
};

export function canonicalizeSeminarRosterForComparison(
  roster: SeminarSessionRoster | PrismaSeminarSessionRosterRecord
): CanonicalSeminarRosterSnapshot {
  const apiShape = toApiRoster(roster);

  return {
    eventId: apiShape.eventId,
    seminarId: apiShape.seminarId,
    moderator: deepCanonicalizeValue(apiShape.moderator ?? null),
    panelists: deepCanonicalizeValue(apiShape.panelists ?? []),
    topicBrief: mapOptionalSeminarRosterTextField(apiShape.topicBrief),
    notes: mapOptionalSeminarRosterTextField(apiShape.notes),
    updatedAt: new Date(apiShape.updatedAt).getTime(),
  };
}

export type SeminarRosterComparisonRow = {
  rosterKey: string;
  exactMatch: boolean;
  fieldMismatches: string[];
  panelistOrderMismatch: boolean;
  partnerIdMismatches: string[];
};

function partnerIdsFromRoster(
  roster: SeminarSessionRoster | PrismaSeminarSessionRosterRecord
): string[] {
  const apiShape = toApiRoster(roster);
  const ids: string[] = [];
  if (apiShape.moderator?.partnerId) ids.push(apiShape.moderator.partnerId);
  for (const panelist of apiShape.panelists) {
    if (panelist.partnerId) ids.push(panelist.partnerId);
  }
  return ids.sort();
}

function panelistOrderSignature(
  roster: SeminarSessionRoster | PrismaSeminarSessionRosterRecord
): string {
  const apiShape = toApiRoster(roster);
  return JSON.stringify(
    apiShape.panelists.map((panelist) => ({
      id: panelist.id,
      seatIndex: panelist.seatIndex ?? null,
      partnerId: panelist.partnerId ?? null,
    }))
  );
}

export function compareSeminarRosters(
  expected: SeminarSessionRoster,
  actual: PrismaSeminarSessionRosterRecord
): SeminarRosterComparisonRow {
  const expectedCanonical = canonicalizeSeminarRosterForComparison(expected);
  const actualCanonical = canonicalizeSeminarRosterForComparison(actual);
  const fieldMismatches: string[] = [];

  for (const field of [
    "eventId",
    "seminarId",
    "moderator",
    "panelists",
    "topicBrief",
    "notes",
    "updatedAt",
  ] as const) {
    if (
      !deepCanonicalValuesEqual(
        expectedCanonical[field],
        actualCanonical[field]
      )
    ) {
      fieldMismatches.push(field);
    }
  }

  const panelistOrderMismatch =
    panelistOrderSignature(expected) !== panelistOrderSignature(actual);

  const expectedPartnerIds = partnerIdsFromRoster(expected);
  const actualPartnerIds = partnerIdsFromRoster(actual);
  const partnerIdMismatches =
    JSON.stringify(expectedPartnerIds) !== JSON.stringify(actualPartnerIds)
      ? [
          `expected=${expectedPartnerIds.join(",")} actual=${actualPartnerIds.join(",")}`,
        ]
      : [];

  return {
    rosterKey: rosterSessionKey(expected.eventId, expected.seminarId),
    exactMatch:
      fieldMismatches.length === 0 &&
      !panelistOrderMismatch &&
      partnerIdMismatches.length === 0,
    fieldMismatches,
    panelistOrderMismatch,
    partnerIdMismatches,
  };
}
