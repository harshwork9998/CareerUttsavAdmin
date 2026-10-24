import { describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/internal/partner-communications/reminders/route";
import { PARTNER_COMMUNICATION_CRON_KEY_HEADER } from "@/lib/server/partner-communication-cron-auth";

vi.mock("@/lib/server/partner-communication-service", () => ({
  processPartnerCommunicationReminders: vi.fn(async () => ({
    examined: 2,
    sent: 1,
    skipped: 1,
    failed: 0,
  })),
}));

describe("partner communication reminder cron", () => {
  it("rejects a missing secret and runs with the configured key", async () => {
    delete process.env.PARTNER_COMMUNICATION_CRON_SECRET;
    const missing = await POST(new Request("http://localhost/reminders", { method: "POST" }));
    expect(missing.status).toBe(401);

    process.env.PARTNER_COMMUNICATION_CRON_SECRET = "partner-cron-secret";
    const wrong = await POST(
      new Request("http://localhost/reminders", {
        method: "POST",
        headers: { [PARTNER_COMMUNICATION_CRON_KEY_HEADER]: "nope" },
      })
    );
    expect(wrong.status).toBe(401);

    const ok = await POST(
      new Request("http://localhost/reminders", {
        method: "POST",
        headers: { [PARTNER_COMMUNICATION_CRON_KEY_HEADER]: "partner-cron-secret" },
      })
    );
    expect(ok.status).toBe(200);
    await expect(ok.json()).resolves.toMatchObject({ sent: 1, failed: 0 });
    delete process.env.PARTNER_COMMUNICATION_CRON_SECRET;
  });
});
