import fs from "fs";
import path from "path";

import { mockPartners } from "@/lib/mock-data/partners";
import type { Partner } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "partners-store.json");

function seedStore(): Partner[] {
  const seed = mockPartners.map((p) => structuredClone(p));
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
    return parsed;
  } catch {
    return seedStore();
  }
}

export function savePartners(partners: Partner[]): Partner[] {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(partners, null, 2), "utf-8");
  return partners;
}

export function getPartnerStorePath() {
  return STORE_PATH;
}
