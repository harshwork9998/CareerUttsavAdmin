import fs from "fs";
import path from "path";

import { resolveRegistrations } from "@/lib/enrich-registration";
import { filterRegistrationsForEventCatalog } from "@/lib/registration-event-links";
import { mockRegistrations } from "@/lib/mock-data/registrations";
import { loadEvents } from "@/lib/server/events-persistence";
import type { Registration } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "registrations-store.json");

function enrichStoredRegistrations(registrations: Registration[]): Registration[] {
  return resolveRegistrations(registrations, loadEvents());
}

function seedStore(): Registration[] {
  const seed = mockRegistrations.map((registration) => structuredClone(registration));
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(seed, null, 2), "utf-8");
  return seed;
}

function syncRawRegistrationsWithEventCatalog(
  registrations: Registration[]
): Registration[] {
  const validEventIds = new Set(loadEvents().map((event) => event.id));
  const synced = filterRegistrationsForEventCatalog(
    registrations,
    validEventIds
  );
  if (synced.length !== registrations.length) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(synced, null, 2), "utf-8");
  }
  return synced;
}

/** Load raw registrations from disk; seeds from mock data on first run. */
export function loadRawRegistrations(): Registration[] {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      return syncRawRegistrationsWithEventCatalog(seedStore());
    }
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Registration[];
    if (!Array.isArray(parsed)) {
      return syncRawRegistrationsWithEventCatalog(seedStore());
    }
    return syncRawRegistrationsWithEventCatalog(parsed);
  } catch {
    return syncRawRegistrationsWithEventCatalog(seedStore());
  }
}

/** Load registrations enriched against the current event catalog. */
export function loadRegistrations(): Registration[] {
  return enrichStoredRegistrations(loadRawRegistrations());
}

export function saveRegistrations(registrations: Registration[]): Registration[] {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(registrations, null, 2), "utf-8");
  return enrichStoredRegistrations(registrations);
}

export function getRegistrationStorePath() {
  return STORE_PATH;
}
