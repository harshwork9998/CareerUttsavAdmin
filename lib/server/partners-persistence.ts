import fs from "fs";
import path from "path";

import { migratePartnerCredentials } from "@/lib/partner-credentials";
import { isPartnerPasswordHash } from "@/lib/partner-password";
import { isPartnerPortalEmail } from "@/lib/partner-invite";
import { enrichPartnersWithEventCatalog } from "@/lib/partner-event-config";
import { mockPartners } from "@/lib/mock-data/partners";
import { getEventCatalog } from "@/lib/server/events-catalog";
import type { Partner } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "partners-store.json");

function backfillPortalAccess(partners: Partner[]): Partner[] {
  const takenLogins = new Set(
    partners
      .map((partner) => partner.portalLogin?.trim().toLowerCase())
      .filter((login): login is string => Boolean(login))
  );

  return partners.map((partner) => {
    let next = partner;
    if (!next.portalLogin?.trim() && isPartnerPortalEmail(next.portalInviteEmail)) {
      const candidate = next.portalInviteEmail!.trim().toLowerCase();
      if (!takenLogins.has(candidate)) {
        takenLogins.add(candidate);
        next = { ...next, portalLogin: candidate };
      }
    }
    if (typeof next.portalAccessEnabled === "boolean") return next;
    const enabled = Boolean(
      next.portalInviteSentAt ||
        (next.portalLogin && isPartnerPasswordHash(next.portalPasswordHash))
    );
    return { ...next, portalAccessEnabled: enabled };
  });
}

function enrichStoredPartners(partners: Partner[]): Partner[] {
  const migrated = enrichPartnersWithEventCatalog(partners, getEventCatalog()).map(
    migratePartnerCredentials
  );
  return backfillPortalAccess(migrated);
}

function accessDigest(partners: Partner[]): string {
  return JSON.stringify(
    partners.map((partner) => ({
      id: partner.id,
      login: partner.portalLogin ?? null,
      enabled: partner.portalAccessEnabled === true,
    }))
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
    const accessChanged = accessDigest(parsed) !== accessDigest(enriched);
    if (assignmentsChanged || credentialsChanged || accessChanged) {
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
