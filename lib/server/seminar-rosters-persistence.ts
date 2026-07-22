import fs from "fs";
import path from "path";

import { mockSeminarRosters } from "@/lib/mock-data/seminar-rosters";
import {
  filterRostersForEventCatalog,
  upsertSeminarRosterInList,
} from "@/lib/seminar-roster-links";
import { loadEvents } from "@/lib/server/events-persistence";
import type { SeminarSessionRoster } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "seminar-rosters-store.json");

function seedStore(): SeminarSessionRoster[] {
  const seed = mockSeminarRosters.map((roster) => structuredClone(roster));
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(seed, null, 2), "utf-8");
  return seed;
}

function syncRostersWithEventCatalog(
  rosters: SeminarSessionRoster[]
): SeminarSessionRoster[] {
  const synced = filterRostersForEventCatalog(rosters, loadEvents());
  if (synced.length !== rosters.length) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(synced, null, 2), "utf-8");
  }
  return synced;
}

export function loadRawSeminarRosters(): SeminarSessionRoster[] {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      return syncRostersWithEventCatalog(seedStore());
    }
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as SeminarSessionRoster[];
    if (!Array.isArray(parsed)) {
      return syncRostersWithEventCatalog(seedStore());
    }
    return syncRostersWithEventCatalog(parsed);
  } catch {
    return syncRostersWithEventCatalog(seedStore());
  }
}

export function loadSeminarRosters(): SeminarSessionRoster[] {
  return loadRawSeminarRosters();
}

export function saveSeminarRosters(
  rosters: SeminarSessionRoster[]
): SeminarSessionRoster[] {
  const synced = syncRostersWithEventCatalog(rosters);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(synced, null, 2), "utf-8");
  return synced;
}

export function upsertSeminarRoster(
  roster: SeminarSessionRoster
): SeminarSessionRoster {
  const rosters = loadRawSeminarRosters();
  const next = upsertSeminarRosterInList(rosters, roster);
  saveSeminarRosters(next);
  return next.find(
    (entry) =>
      entry.eventId === roster.eventId && entry.seminarId === roster.seminarId
  )!;
}

export function getSeminarRosterStorePath() {
  return STORE_PATH;
}
