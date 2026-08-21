import fs from "node:fs";

import type { Partner } from "@/types";

import type { JsonSpocSource } from "@/lib/server/partner-prisma-import-map";

export function readJsonArrayFile<T>(sourcePath: string, label: string): T[] {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`${label} file not found: ${sourcePath}`);
  }

  const raw = fs.readFileSync(sourcePath, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`${label} file is not valid JSON: ${sourcePath}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`${label} file must contain a JSON array: ${sourcePath}`);
  }

  return parsed as T[];
}

export function readSpocSource(sourcePath: string): JsonSpocSource[] {
  return readJsonArrayFile<JsonSpocSource>(sourcePath, "SPOC source");
}

export function readPartnerSource(sourcePath: string): Partner[] {
  return readJsonArrayFile<Partner>(sourcePath, "Partner source");
}

export type ImportCliArgs = {
  spocsPath: string;
  partnersPath: string;
  apply: boolean;
};

export function printPartnerImportUsage(): never {
  console.error(
    [
      "Usage:",
      "  npx tsx scripts/import-partners-to-prisma.ts <spocs.json> <partners.json> [--apply]",
      "",
      "Defaults to dry-run. Pass --apply to write to Supabase.",
      "",
      "Examples:",
      "  npx tsx scripts/import-partners-to-prisma.ts tmp/db-import/spocs-store.production.json tmp/db-import/partners-store.production.json",
      "  npx tsx scripts/import-partners-to-prisma.ts tmp/db-import/spocs-store.production.json tmp/db-import/partners-store.production.json --apply",
    ].join("\n")
  );
  process.exit(1);
}

export function parsePartnerImportArgs(argv: string[]): ImportCliArgs {
  const positional = argv.filter((arg) => arg !== "--apply");
  const apply = argv.includes("--apply");

  if (positional.length !== 2) {
    printPartnerImportUsage();
  }

  return {
    spocsPath: positional[0]!,
    partnersPath: positional[1]!,
    apply,
  };
}
