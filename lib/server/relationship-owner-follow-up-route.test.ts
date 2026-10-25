import { beforeEach, describe, expect, it, vi } from "vitest";

import { RELATIONSHIP_OWNER_FOLLOWUP_CRON_KEY_HEADER } from "@/lib/server/relationship-owner-follow-up-cron-auth";

vi.mock("@/lib/server/relationship-owner-follow-up-processor", () => ({
  processRelationshipOwnerFollowUpDigests: vi.fn(async () => ({
    examinedOwners: 2,
    sent: 1,
    skipped: 1,
    failed: 0,
    reasons: {},
  })),
  processRelationshipOwnerFollowUpDigestTest: vi.fn(async () => ({
    mode: "test",
    ownerSpocId: "spoc-a",
    ownerName: "Owner A",
    recipientPhoneMasked: "******3210",
    followUpCount: 1,
    templateName: "relationship_owner_followup_digest",
    status: "sent",
    messageId: "wamid.test",
  })),
}));

import { POST } from "@/app/api/internal/whatsapp/relationship-owner-follow-ups/route";
import {
  processRelationshipOwnerFollowUpDigestTest,
  processRelationshipOwnerFollowUpDigests,
} from "@/lib/server/relationship-owner-follow-up-processor";

const URL = "http://localhost/api/internal/whatsapp/relationship-owner-follow-ups";

describe("relationship owner follow-up cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RELATIONSHIP_OWNER_FOLLOWUP_CRON_SECRET = "cron-secret";
  });

  it("requires valid cron secret for test mode", async () => {
    const response = await POST(
      new Request(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "test", ownerSpocId: "spoc-a" }),
      })
    );
    expect(response.status).toBe(401);
    expect(processRelationshipOwnerFollowUpDigestTest).not.toHaveBeenCalled();
  });

  it("requires ownerSpocId for test mode", async () => {
    const response = await POST(
      new Request(URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [RELATIONSHIP_OWNER_FOLLOWUP_CRON_KEY_HEADER]: "cron-secret",
        },
        body: JSON.stringify({ mode: "test" }),
      })
    );
    expect(response.status).toBe(400);
    expect(processRelationshipOwnerFollowUpDigestTest).not.toHaveBeenCalled();
  });

  it("runs test mode for one owner when authorized", async () => {
    const response = await POST(
      new Request(URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [RELATIONSHIP_OWNER_FOLLOWUP_CRON_KEY_HEADER]: "cron-secret",
        },
        body: JSON.stringify({ mode: "test", ownerSpocId: "spoc-a" }),
      })
    );
    expect(response.status).toBe(200);
    expect(processRelationshipOwnerFollowUpDigestTest).toHaveBeenCalledWith({
      ownerSpocId: "spoc-a",
    });
    expect(processRelationshipOwnerFollowUpDigests).not.toHaveBeenCalled();
    const body = (await response.json()) as { mode: string; status: string };
    expect(body.mode).toBe("test");
    expect(body.status).toBe("sent");
  });

  it("keeps automatic no-body cron behavior", async () => {
    const response = await POST(
      new Request(URL, {
        method: "POST",
        headers: {
          [RELATIONSHIP_OWNER_FOLLOWUP_CRON_KEY_HEADER]: "cron-secret",
        },
      })
    );
    expect(response.status).toBe(200);
    expect(processRelationshipOwnerFollowUpDigests).toHaveBeenCalledOnce();
    expect(processRelationshipOwnerFollowUpDigestTest).not.toHaveBeenCalled();
    const body = (await response.json()) as { examinedOwners: number };
    expect(body.examinedOwners).toBe(2);
  });
});
