import type { Event, SeminarSessionRoster } from "@/types";

export function rosterSessionKey(eventId: string, seminarId: string): string {
  return `${eventId}:${seminarId}`;
}

export function buildValidSeminarSessionKeys(events: Event[]): Set<string> {
  const keys = new Set<string>();
  for (const event of events) {
    for (const seminar of event.seminars ?? []) {
      keys.add(rosterSessionKey(event.id, seminar.id));
    }
  }
  return keys;
}

export function filterRostersForEventCatalog(
  rosters: SeminarSessionRoster[],
  events: Event[]
): SeminarSessionRoster[] {
  const validSessions = buildValidSeminarSessionKeys(events);
  return rosters.filter((roster) =>
    validSessions.has(rosterSessionKey(roster.eventId, roster.seminarId))
  );
}

export function rostersNeedEventCatalogPrune(
  rosters: SeminarSessionRoster[],
  events: Event[]
): boolean {
  const validSessions = buildValidSeminarSessionKeys(events);
  return rosters.some(
    (roster) =>
      !validSessions.has(rosterSessionKey(roster.eventId, roster.seminarId))
  );
}

export function upsertSeminarRosterInList(
  rosters: SeminarSessionRoster[],
  roster: SeminarSessionRoster
): SeminarSessionRoster[] {
  const idx = rosters.findIndex(
    (entry) =>
      entry.eventId === roster.eventId && entry.seminarId === roster.seminarId
  );
  const next = { ...roster, updatedAt: new Date().toISOString() };
  if (idx === -1) {
    return [...rosters, next];
  }
  return rosters.map((entry, index) => (index === idx ? next : entry));
}
