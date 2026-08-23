/**
 * Preflight Admin users JSON snapshot before Prisma import.
 *
 * Usage:
 *   npx tsx scripts/preflight-users-to-prisma.ts --source <users-store.json>
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";

import {
  buildUserPreflightReport,
  readUserAuthSource,
} from "./lib/user-import-shared";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

function parseArgs(argv: string[]): { sourcePath: string } {
  let sourcePath: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === "--source") {
      sourcePath = argv[index + 1];
      index += 1;
      continue;
    }
    console.error(
      "Usage: npx tsx scripts/preflight-users-to-prisma.ts --source <users-store.json>"
    );
    process.exit(1);
  }
  if (!sourcePath) {
    console.error(
      "Usage: npx tsx scripts/preflight-users-to-prisma.ts --source <users-store.json>"
    );
    process.exit(1);
  }
  return { sourcePath: path.resolve(sourcePath) };
}

async function main(): Promise<void> {
  const { sourcePath } = parseArgs(process.argv.slice(2));
  const records = readUserAuthSource(sourcePath);
  const report = buildUserPreflightReport(sourcePath, records);

  console.log(
    JSON.stringify(
      {
        mode: "DRY-RUN",
        noDatabaseWrites: true,
        ...report,
      },
      null,
      2
    )
  );

  if (!report.safeToImport) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
