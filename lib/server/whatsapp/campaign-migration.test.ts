import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const MIGRATION = readFileSync(
  join(
    process.cwd(),
    "prisma/migrations/20261122120000_whatsapp_campaigns/migration.sql"
  ),
  "utf8"
);

describe("whatsapp campaigns migration", () => {
  it("creates campaign, recipient, and suppression tables", () => {
    expect(MIGRATION).toContain("whatsapp_campaigns");
    expect(MIGRATION).toContain("whatsapp_campaign_recipients");
    expect(MIGRATION).toContain("whatsapp_suppressions");
    expect(MIGRATION).toContain("WhatsAppCampaignRecipientStatus");
  });
});