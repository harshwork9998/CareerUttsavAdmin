import fs from "fs";
import path from "path";

import { mockEvents } from "@/lib/mock-data/events";
import type { Event } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "events-store.json");

function seedStore(): Event[] {
  const seed = mockEvents.map((event) => structuredClone(event));
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(seed, null, 2), "utf-8");
  return seed;
}

/** Load events from disk; seeds from mock data on first run. */
export function loadEvents(): Event[] {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      return seedStore();
    }
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Event[];
    if (!Array.isArray(parsed)) {
      return seedStore();
    }
    return parsed;
  } catch {
    return seedStore();
  }
}

export function saveEvents(events: Event[]): Event[] {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(events, null, 2), "utf-8");
  return events;
}

export function getEventStorePath() {
  return STORE_PATH;
}
