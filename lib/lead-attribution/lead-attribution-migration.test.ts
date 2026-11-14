import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const MIGRATION = readFileSync(
  join(process.cwd(), "prisma/migrations/20261114120000_marketing_attribution/migration.sql"),
  "utf8"
);
const SCHEMA = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");

describe("lead attribution migration safety", () => {
  it("adds nullable registration snapshots only", () => {
    expect(MIGRATION).toContain('"leadSource"');
    expect(MIGRATION).toContain('"leadSubSource"');
    expect(MIGRATION).not.toContain("lead_sources");
    expect(MIGRATION).not.toContain("marketing_campaigns");
    expect(MIGRATION).not.toContain("DROP TABLE");
  });

  it("schema has no campaign management models", () => {
    expect(SCHEMA).not.toContain("model LeadSource");
    expect(SCHEMA).not.toContain("model MarketingCampaign");
    expect(SCHEMA).toContain("leadSource");
    expect(SCHEMA).toContain("leadSubSource");
  });
});