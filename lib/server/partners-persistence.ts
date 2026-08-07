import fs from "fs";
import path from "path";

import { migratePartnerCredentials } from "@/lib/partner-credentials";
import { enrichPartnersWithEventCatalog } from "@/lib/partner-event-config";
import { mockPartners } from "@/lib/mock-data/partners";
import { getEventCatalog } from "@/lib/server/events-catalog";
import type { Partner } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "partners-store.json");

function enrichStoredPartners(partners: Partner[]): Partner[] {
  return enrichPartnersWithEventCatalog(partners, getEventCatalog()).map(
    migratePartnerCredentials
  );
}

function credentialsDigest(partners: Partner[]): string {
  return JSON.stringify(
    partners.map((p) => ({
      id: p.id,
      hash: p.portalPasswordHash ?? null,
      temp: p.portalTempPassword ?? null,
    }))
  );
}

function seminarAssignmentsDigest(partners: Partner[]): string {
  return JSON.stringify(partners.map((p) => p.seminarSlotAssignments ?? []));
}

function seedStore(): Partner[] {
  const seed = enrichStoredPartners(mockPartners.map((p) => structuredClone(p)));
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(seed, null, 2), "utf-8");
  return seed;
}

/** Load partners from disk; seeds from mock data on first run. */
export function loadPartners(): Partner[] {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      return seedStore();
    }
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partner[];
    if (!Array.isArray(parsed)) {
      return seedStore();
    }
    const enriched = enrichStoredPartners(parsed);
    const assignmentsChanged =
      seminarAssignmentsDigest(parsed) !== seminarAssignmentsDigest(enriched);
    const credentialsChanged =
      credentialsDigest(parsed) !== credentialsDigest(enriched);
    if (assignmentsChanged || credentialsChanged) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(STORE_PATH, JSON.stringify(enriched, null, 2), "utf-8");
    }
    return enriched;
  } catch {
    return seedStore();
  }
}

export function savePartners(partners: Partner[]): Partner[] {
  const enriched = enrichStoredPartners(partners);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(enriched, null, 2), "utf-8");
  return enriched;
}

export function getPartnerStorePath() {
  return STORE_PATH;
}
