import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const MIGRATION_SQL = readFileSync(
  join(
    process.cwd(),
    "prisma/migrations/20261114120000_marketing_attribution/migration.sql"
  ),
  "utf8"
);

const SCHEMA = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");

describe("marketing attribution migration contract", () => {
  it("defines DB-level case-insensitive uniqueness for sources and sub-sources", () => {
    expect(MIGRATION_SQL).toContain('"nameKey" TEXT NOT NULL');
    expect(MIGRATION_SQL).toContain(
      'CREATE UNIQUE INDEX "lead_sources_nameKey_key"'
    );
    expect(MIGRATION_SQL).toContain(
      'CREATE UNIQUE INDEX "lead_sub_sources_leadSourceId_nameKey_key"'
    );
    expect(MIGRATION_SQL).toContain(
      'CREATE UNIQUE INDEX "marketing_campaigns_trackingCodeKey_key"'
    );
  });

  it("uses non-destructive FK rules and does not touch registrations", () => {
    expect(MIGRATION_SQL).toContain("ON DELETE RESTRICT");
    expect(MIGRATION_SQL).not.toContain("registrations");
    expect(MIGRATION_SQL).not.toContain("DROP TABLE");
  });

  it("matches prisma/schema.prisma marketing models", () => {
    expect(SCHEMA).toContain("nameKey     String   @unique");
    expect(SCHEMA).toContain("@@unique([leadSourceId, nameKey])");
    expect(SCHEMA).toContain("trackingCodeKey       String    @unique");
    expect(SCHEMA).toContain("onDelete: Restrict");
  });
});