import fs from "node:fs";

import type { SeminarSessionRoster } from "@/types";

export function readSeminarRosterSource(sourcePath: string): SeminarSessionRoster[] {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Seminar roster source file not found: ${sourcePath}`);
  }

  const raw = fs.readFileSync(sourcePath, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`Seminar roster source file is not valid JSON: ${sourcePath}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      `Seminar roster source file must contain a JSON array: ${sourcePath}`
    );
  }

  return parsed as SeminarSessionRoster[];
}

export type SeminarRosterImportCliArgs = {
  sourcePath: string;
  apply: boolean;
};

export function printSeminarRosterImportUsage(): never {
  console.error(
    [
      "Usage:",
      "  npx tsx scripts/import-seminar-rosters-to-prisma.ts --source <rosters.json> [--apply]",
      "",
      "Defaults to dry-run. Pass --apply to write to Supabase.",
      "",
      "Examples:",
      "  npx tsx scripts/import-seminar-rosters-to-prisma.ts --source tmp/db-import/seminar-rosters-store.production.json",
      "  npx tsx scripts/import-seminar-rosters-to-prisma.ts --source tmp/db-import/seminar-rosters-store.production.json --apply",
    ].join("\n")
  );
  process.exit(1);
}

export function parseSeminarRosterImportArgs(
  argv: string[]
): SeminarRosterImportCliArgs {
  let sourcePath: string | undefined;
  let apply = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg === "--source") {
      sourcePath = argv[index + 1];
      index += 1;
      continue;
    }
    printSeminarRosterImportUsage();
  }

  if (!sourcePath) {
    printSeminarRosterImportUsage();
  }

  return {
    sourcePath,
    apply,
  };
}

export function parseSeminarRosterPreflightArgs(argv: string[]): {
  sourcePath: string;
} {
  let sourcePath: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === "--source") {
      sourcePath = argv[index + 1];
      index += 1;
      continue;
    }
    console.error(
      "Usage: npx tsx scripts/preflight-seminar-rosters-to-prisma.ts --source <rosters.json>"
    );
    process.exit(1);
  }

  if (!sourcePath) {
    console.error(
      "Usage: npx tsx scripts/preflight-seminar-rosters-to-prisma.ts --source <rosters.json>"
    );
    process.exit(1);
  }

  return { sourcePath };
}

export function parseSeminarRosterReconcileArgs(argv: string[]): {
  sourcePath: string;
  dryRun: boolean;
} {
  const dryRun = !argv.includes("--apply");
  let sourcePath: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === "--dry-run" || arg === "--apply") {
      continue;
    }
    if (arg === "--source") {
      sourcePath = argv[index + 1];
      index += 1;
      continue;
    }
    console.error(
      [
        "Usage:",
        "  npx tsx scripts/reconcile-final-seminar-roster-snapshot.ts --source <rosters.json> [--dry-run]",
        "  npx tsx scripts/reconcile-final-seminar-roster-snapshot.ts --source <rosters.json> --apply",
      ].join("\n")
    );
    process.exit(1);
  }

  if (!sourcePath) {
    console.error(
      "Usage: npx tsx scripts/reconcile-final-seminar-roster-snapshot.ts --source <rosters.json> [--dry-run]"
    );
    process.exit(1);
  }

  return { sourcePath, dryRun };
}
