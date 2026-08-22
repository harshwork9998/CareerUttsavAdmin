import { Prisma } from "@/lib/generated/prisma/client";
import type { SeminarSessionRoster, SeminarSpeaker } from "@/types";

export type SeminarCatalogEntry = {
  id: string;
  eventId: string;
  panelistSlots: number;
};

export type SeminarRosterPreflightIssue = {
  code: string;
  rosterKey?: string;
  message: string;
};

export type SeminarRosterCounts = {
  rosters: number;
  uniqueEvents: number;
  uniqueSeminars: number;
  moderators: number;
  panelists: number;
  totalSpeakers: number;
  partnerLinkedSpeakers: number;
};

export type SeminarRosterPreflightResult = {
  ok: boolean;
  errors: SeminarRosterPreflightIssue[];
  warnings: SeminarRosterPreflightIssue[];
  counts: SeminarRosterCounts;
};

export type MappedSeminarSessionRoster = Prisma.SeminarSessionRosterCreateManyInput;

const VALID_SPEAKER_STATUSES = new Set(["Confirmed", "Invited", "Tentative"]);

export function rosterSessionKey(eventId: string, seminarId: string): string {
  return `${eventId}:${seminarId}`;
}

export function parseRequiredDate(value: string, fieldName: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${fieldName}: ${value}`);
  }
  return date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSpeaker(value: unknown): value is SeminarSpeaker {
  return isRecord(value) && typeof value.id === "string";
}

export function countSeminarRosters(
  rosters: SeminarSessionRoster[]
): SeminarRosterCounts {
  const eventIds = new Set<string>();
  const seminarIds = new Set<string>();
  let moderators = 0;
  let panelists = 0;
  let partnerLinkedSpeakers = 0;

  for (const roster of rosters) {
    eventIds.add(roster.eventId);
    seminarIds.add(roster.seminarId);
    if (roster.moderator) {
      moderators += 1;
      if (roster.moderator.partnerId) partnerLinkedSpeakers += 1;
    }
    panelists += roster.panelists.length;
    for (const panelist of roster.panelists) {
      if (panelist.partnerId) partnerLinkedSpeakers += 1;
    }
  }

  return {
    rosters: rosters.length,
    uniqueEvents: eventIds.size,
    uniqueSeminars: seminarIds.size,
    moderators,
    panelists,
    totalSpeakers: moderators + panelists,
    partnerLinkedSpeakers,
  };
}

function validateSpeaker(
  speaker: SeminarSpeaker,
  label: string
): { errors: SeminarRosterPreflightIssue[]; warnings: SeminarRosterPreflightIssue[] } {
  const errors: SeminarRosterPreflightIssue[] = [];
  const warnings: SeminarRosterPreflightIssue[] = [];

  if (!speaker.id?.trim()) {
    errors.push({
      code: "speaker_missing_id",
      message: `${label} is missing a speaker id`,
    });
  }

  if (!speaker.status || !VALID_SPEAKER_STATUSES.has(speaker.status)) {
    errors.push({
      code: "speaker_invalid_status",
      message: `${label} has invalid status: ${String(speaker.status)}`,
    });
  }

  if (typeof speaker.name !== "string") {
    errors.push({
      code: "speaker_missing_name",
      message: `${label} is missing name`,
    });
  } else if (!speaker.name.trim()) {
    warnings.push({
      code: "speaker_empty_name",
      message: `${label} has an empty name`,
    });
  }

  if (typeof speaker.organization !== "string") {
    errors.push({
      code: "speaker_missing_organization",
      message: `${label} is missing organization`,
    });
  }

  return { errors, warnings };
}

export function validateSeminarRosterSources(input: {
  rosters: SeminarSessionRoster[];
  knownEventIds: Set<string>;
  seminarCatalog: Map<string, SeminarCatalogEntry>;
  knownPartnerIds: Set<string>;
}): SeminarRosterPreflightResult {
  const errors: SeminarRosterPreflightIssue[] = [];
  const warnings: SeminarRosterPreflightIssue[] = [];
  const sessionKeys = new Set<string>();

  for (const roster of input.rosters) {
    const key = rosterSessionKey(roster.eventId, roster.seminarId);

    if (!roster.eventId?.trim() || !roster.seminarId?.trim()) {
      errors.push({
        code: "roster_missing_session_ids",
        rosterKey: key,
        message: "Roster is missing eventId or seminarId",
      });
      continue;
    }

    if (sessionKeys.has(key)) {
      errors.push({
        code: "duplicate_session",
        rosterKey: key,
        message: `Duplicate roster for session ${key}`,
      });
    }
    sessionKeys.add(key);

    if (!input.knownEventIds.has(roster.eventId)) {
      errors.push({
        code: "orphan_event",
        rosterKey: key,
        message: `Roster references missing event ${roster.eventId}`,
      });
    }

    const seminar = input.seminarCatalog.get(roster.seminarId);
    if (!seminar) {
      errors.push({
        code: "orphan_seminar",
        rosterKey: key,
        message: `Roster references missing seminar ${roster.seminarId}`,
      });
    } else if (seminar.eventId !== roster.eventId) {
      errors.push({
        code: "seminar_event_mismatch",
        rosterKey: key,
        message: `Seminar ${roster.seminarId} belongs to event ${seminar.eventId}, not ${roster.eventId}`,
      });
    }

    try {
      parseRequiredDate(roster.updatedAt, "updatedAt");
    } catch (error) {
      errors.push({
        code: "invalid_updated_at",
        rosterKey: key,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    if (!Array.isArray(roster.panelists)) {
      errors.push({
        code: "invalid_panelists",
        rosterKey: key,
        message: "panelists must be an array",
      });
      continue;
    }

    if (roster.moderator !== null && roster.moderator !== undefined) {
      if (!isSpeaker(roster.moderator)) {
        errors.push({
          code: "invalid_moderator",
          rosterKey: key,
          message: "moderator must be a speaker object or null",
        });
      } else {
        const result = validateSpeaker(roster.moderator, `${key} moderator`);
        errors.push(...result.errors);
        warnings.push(...result.warnings);
        if (roster.moderator.partnerId && !input.knownPartnerIds.has(roster.moderator.partnerId)) {
          errors.push({
            code: "orphan_partner",
            rosterKey: key,
            message: `Moderator references missing partner ${roster.moderator.partnerId}`,
          });
        }
      }
    }

    const speakerIds = new Set<string>();
    const seatIndexes = new Set<number>();

    roster.panelists.forEach((panelist, index) => {
      if (!isSpeaker(panelist)) {
        errors.push({
          code: "invalid_panelist",
          rosterKey: key,
          message: `Panelist at index ${index} is not a valid speaker object`,
        });
        return;
      }

      const result = validateSpeaker(panelist, `${key} panelist[${index}]`);
      errors.push(...result.errors);
      warnings.push(...result.warnings);

      if (speakerIds.has(panelist.id)) {
        errors.push({
          code: "duplicate_speaker_id",
          rosterKey: key,
          message: `Duplicate speaker id ${panelist.id} in roster ${key}`,
        });
      }
      speakerIds.add(panelist.id);

      if (panelist.partnerId && !input.knownPartnerIds.has(panelist.partnerId)) {
        errors.push({
          code: "orphan_partner",
          rosterKey: key,
          message: `Panelist ${panelist.id} references missing partner ${panelist.partnerId}`,
        });
      }

      if (panelist.seatIndex !== undefined) {
        if (seatIndexes.has(panelist.seatIndex)) {
          errors.push({
            code: "duplicate_seat_index",
            rosterKey: key,
            message: `Duplicate panelist seatIndex ${panelist.seatIndex} in roster ${key}`,
          });
        }
        seatIndexes.add(panelist.seatIndex);

        if (seminar && (panelist.seatIndex < 0 || panelist.seatIndex >= seminar.panelistSlots)) {
          errors.push({
            code: "seat_index_out_of_range",
            rosterKey: key,
            message: `Panelist seatIndex ${panelist.seatIndex} is outside seminar panelistSlots ${seminar.panelistSlots}`,
          });
        }
      }
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    counts: countSeminarRosters(input.rosters),
  };
}

function toJsonValue<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

/** Maps optional roster text: undefined/null -> Prisma null; explicit "" preserved. */
export function mapOptionalSeminarRosterTextField(
  value: string | null | undefined
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return value;
}

export function mapSeminarRosterSourceToPrisma(
  roster: SeminarSessionRoster
): MappedSeminarSessionRoster {
  return {
    eventId: roster.eventId,
    seminarId: roster.seminarId,
    moderator:
      roster.moderator === null || roster.moderator === undefined
        ? Prisma.JsonNull
        : toJsonValue(roster.moderator),
    panelists: toJsonValue(roster.panelists ?? []),
    topicBrief: mapOptionalSeminarRosterTextField(roster.topicBrief),
    notes: mapOptionalSeminarRosterTextField(roster.notes),
    updatedAt: parseRequiredDate(roster.updatedAt, "updatedAt"),
  };
}

export function buildSeminarRosterImportPlan(
  rosters: SeminarSessionRoster[]
): MappedSeminarSessionRoster[] {
  return rosters.map(mapSeminarRosterSourceToPrisma);
}
