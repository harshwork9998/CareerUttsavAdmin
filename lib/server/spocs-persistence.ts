import fs from "fs";
import path from "path";

import { loadPartners } from "@/lib/server/partners-persistence";
import { generateId } from "@/lib/utils";
import type { Spoc } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "spocs-store.json");

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function seedFromPartners(): Spoc[] {
  const partners = loadPartners();
  const byEmail = new Map<string, Spoc>();
  const now = new Date().toISOString();

  for (const partner of partners) {
    const owner = partner.relationshipOwner;
    const name = owner?.managerName?.trim() ?? "";
    const organization = owner?.organization?.trim() ?? "";
    const phone = owner?.managerPhone?.trim() ?? "";
    const email = owner?.managerEmail?.trim() ?? "";
    if (!name || !phone || !email) continue;

    const key = normalizeEmail(email);
    if (byEmail.has(key)) continue;

    byEmail.set(key, {
      id: generateId(),
      name,
      organization: organization || "—",
      phone,
      email,
      createdAt: now,
      updatedAt: now,
    });
  }

  return Array.from(byEmail.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

function seedStore(): Spoc[] {
  const seed = seedFromPartners();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(seed, null, 2), "utf-8");
  return seed;
}

export function loadSpocs(): Spoc[] {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      return seedStore();
    }
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return seedStore();
    }
    return (parsed as Spoc[])
      .map((spoc) => ({
        ...spoc,
        organization:
          typeof spoc.organization === "string" && spoc.organization.trim()
            ? spoc.organization.trim()
            : "—",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return seedStore();
  }
}

export function saveSpocs(spocs: Spoc[]): Spoc[] {
  const sorted = spocs
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(sorted, null, 2), "utf-8");
  return sorted;
}

export function findSpocByEmail(
  spocs: Spoc[],
  email: string
): Spoc | undefined {
  const key = normalizeEmail(email);
  if (!key) return undefined;
  return spocs.find((s) => normalizeEmail(s.email) === key);
}
