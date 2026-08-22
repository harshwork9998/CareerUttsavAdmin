import {
  buildValidSeminarSessionKeys,
  filterRostersForEventCatalog,
  rosterSessionKey,
} from "@/lib/seminar-roster-links";
import { applySeminarSpeakerMobileValidation } from "@/lib/seminar-roster-mobile";
import { loadEvents } from "@/lib/server/events-persistence";
import { isPrismaSeminarRosterPersistence } from "@/lib/server/seminar-roster-persistence-mode";
import {
  getPrismaSeminarRoster,
  listPrismaSeminarRosters,
  prunePrismaSeminarRostersForEventCatalog,
  upsertPrismaSeminarRoster,
} from "@/lib/server/seminar-roster-prisma-store";
import { prisma } from "@/lib/server/prisma";
import {
  loadRawSeminarRosters,
  loadSeminarRosters,
  saveSeminarRosters,
  upsertSeminarRoster,
} from "@/lib/server/seminar-rosters-persistence";
import type { Event, SeminarSessionRoster } from "@/types";

export type SeminarRosterWriteResult =
  | { ok: true; roster: SeminarSessionRoster }
  | { ok: false; status: number; error: string };

export type SeminarSessionValidationResult =
  | { ok: true; panelistSlots: number }
  | { ok: false; status: number; error: string };

const SESSION_NOT_LINKED_ERROR =
  "Seminar session is not linked to a current event";

export async function listSeminarRostersForApi(): Promise<SeminarSessionRoster[]> {
  if (isPrismaSeminarRosterPersistence()) {
    return listPrismaSeminarRosters();
  }
  return loadSeminarRosters();
}

export async function getSeminarRosterForApi(
  eventId: string,
  seminarId: string
): Promise<SeminarSessionRoster | null> {
  if (isPrismaSeminarRosterPersistence()) {
    return getPrismaSeminarRoster(eventId, seminarId);
  }

  return (
    loadRawSeminarRosters().find(
      (entry) => entry.eventId === eventId && entry.seminarId === seminarId
    ) ?? null
  );
}

export async function validateSeminarSessionForRoster(
  eventId: string,
  seminarId: string
): Promise<SeminarSessionValidationResult> {
  if (!eventId || !seminarId) {
    return {
      ok: false,
      status: 400,
      error: SESSION_NOT_LINKED_ERROR,
    };
  }

  if (isPrismaSeminarRosterPersistence()) {
    const seminar = await prisma.seminar.findUnique({
      where: { id: seminarId },
      select: { id: true, eventId: true, panelistSlots: true },
    });

    if (!seminar || seminar.eventId !== eventId) {
      return {
        ok: false,
        status: 400,
        error: SESSION_NOT_LINKED_ERROR,
      };
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });

    if (!event) {
      return {
        ok: false,
        status: 400,
        error: SESSION_NOT_LINKED_ERROR,
      };
    }

    return { ok: true, panelistSlots: seminar.panelistSlots };
  }

  const events = loadEvents();
  const validSessions = buildValidSeminarSessionKeys(events);
  if (!validSessions.has(rosterSessionKey(eventId, seminarId))) {
    return {
      ok: false,
      status: 400,
      error: SESSION_NOT_LINKED_ERROR,
    };
  }

  const event = events.find((entry) => entry.id === eventId);
  const seminar = event?.seminars?.find((entry) => entry.id === seminarId);
  return { ok: true, panelistSlots: seminar?.panelistSlots ?? 0 };
}

export async function upsertSeminarRosterForApi(
  roster: SeminarSessionRoster
): Promise<SeminarRosterWriteResult> {
  const validation = await validateSeminarSessionForRoster(
    roster.eventId,
    roster.seminarId
  );
  if (!validation.ok) {
    return validation;
  }

  const existing = await getSeminarRosterForApi(roster.eventId, roster.seminarId);
  const mobiles = applySeminarSpeakerMobileValidation(roster, existing ?? undefined);
  if (!mobiles.ok) {
    return { ok: false, status: 400, error: mobiles.error };
  }

  const toSave: SeminarSessionRoster = {
    ...mobiles.roster,
    eventId: roster.eventId,
    seminarId: roster.seminarId,
  };

  if (isPrismaSeminarRosterPersistence()) {
    const saved = await upsertPrismaSeminarRoster(toSave);
    return { ok: true, roster: saved };
  }

  const saved = upsertSeminarRoster(toSave);
  return { ok: true, roster: saved };
}

export async function pruneSeminarRostersForEventCatalog(
  events: Event[]
): Promise<void> {
  if (isPrismaSeminarRosterPersistence()) {
    await prunePrismaSeminarRostersForEventCatalog(events);
    return;
  }

  const rosters = loadRawSeminarRosters();
  const next = filterRostersForEventCatalog(rosters, events);
  if (next.length !== rosters.length) {
    saveSeminarRosters(next);
  }
}
