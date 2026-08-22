import { Prisma } from "@/lib/generated/prisma/client";
import {
  buildValidSeminarSessionKeys,
  rosterSessionKey,
} from "@/lib/seminar-roster-links";
import { mapOptionalSeminarRosterTextField } from "@/lib/server/seminar-roster-prisma-import-map";
import { mapPrismaSeminarRosterToApi } from "@/lib/server/seminar-roster-reconciliation";
import { prisma } from "@/lib/server/prisma";
import type { Event, SeminarSessionRoster } from "@/types";

function toModeratorJson(
  moderator: SeminarSessionRoster["moderator"]
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
  if (moderator === null || moderator === undefined) {
    return Prisma.JsonNull;
  }
  return moderator as unknown as Prisma.InputJsonValue;
}

function toPanelistsJson(
  panelists: SeminarSessionRoster["panelists"]
): Prisma.InputJsonValue {
  return panelists as unknown as Prisma.InputJsonValue;
}

export async function listPrismaSeminarRosters(): Promise<SeminarSessionRoster[]> {
  const rows = await prisma.seminarSessionRoster.findMany({
    orderBy: [{ eventId: "asc" }, { seminarId: "asc" }],
  });
  return rows.map(mapPrismaSeminarRosterToApi);
}

export async function getPrismaSeminarRoster(
  eventId: string,
  seminarId: string
): Promise<SeminarSessionRoster | null> {
  const row = await prisma.seminarSessionRoster.findUnique({
    where: {
      eventId_seminarId: {
        eventId,
        seminarId,
      },
    },
  });
  return row ? mapPrismaSeminarRosterToApi(row) : null;
}

export async function upsertPrismaSeminarRoster(
  roster: SeminarSessionRoster
): Promise<SeminarSessionRoster> {
  const updatedAt = new Date();
  const row = await prisma.seminarSessionRoster.upsert({
    where: {
      eventId_seminarId: {
        eventId: roster.eventId,
        seminarId: roster.seminarId,
      },
    },
    create: {
      eventId: roster.eventId,
      seminarId: roster.seminarId,
      moderator: toModeratorJson(roster.moderator),
      panelists: toPanelistsJson(roster.panelists),
      topicBrief: mapOptionalSeminarRosterTextField(roster.topicBrief),
      notes: mapOptionalSeminarRosterTextField(roster.notes),
      updatedAt,
    },
    update: {
      moderator: toModeratorJson(roster.moderator),
      panelists: toPanelistsJson(roster.panelists),
      topicBrief: mapOptionalSeminarRosterTextField(roster.topicBrief),
      notes: mapOptionalSeminarRosterTextField(roster.notes),
      updatedAt,
    },
  });
  return mapPrismaSeminarRosterToApi(row);
}

export async function prunePrismaSeminarRostersForEventCatalog(
  events: Event[]
): Promise<void> {
  const validSessions = buildValidSeminarSessionKeys(events);
  const rows = await prisma.seminarSessionRoster.findMany({
    select: { eventId: true, seminarId: true },
  });

  const invalid = rows.filter(
    (row) => !validSessions.has(rosterSessionKey(row.eventId, row.seminarId))
  );

  if (invalid.length === 0) {
    return;
  }

  await prisma.$transaction(
    invalid.map((row) =>
      prisma.seminarSessionRoster.delete({
        where: {
          eventId_seminarId: {
            eventId: row.eventId,
            seminarId: row.seminarId,
          },
        },
      })
    )
  );
}
