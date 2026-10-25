import { beforeEach, describe, expect, it, vi } from "vitest";

const findUniqueSpoc = vi.fn();
const findUniqueDigest = vi.fn();
const upsertDigest = vi.fn();
const updateDigest = vi.fn();
const listDueFollowUpsForOwner = vi.fn();
const listDistinctOwnerSpocIdsWithPartners = vi.fn();

vi.mock("@/lib/server/partner-persistence-mode", () => ({
  isPrismaPartnerPersistence: vi.fn(() => true),
}));

vi.mock("@/lib/server/partner-follow-up-resolver", () => ({
  listDistinctOwnerSpocIdsWithPartners: (...args: unknown[]) =>
    listDistinctOwnerSpocIdsWithPartners(...args),
  listDueFollowUpsForOwner: (...args: unknown[]) =>
    listDueFollowUpsForOwner(...args),
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    spoc: { findUnique: (...args: unknown[]) => findUniqueSpoc(...args) },
    relationshipOwnerFollowUpDigest: {
      findUnique: (...args: unknown[]) => findUniqueDigest(...args),
      upsert: (...args: unknown[]) => upsertDigest(...args),
      update: (...args: unknown[]) => updateDigest(...args),
    },
  },
}));

import {
  processRelationshipOwnerFollowUpDigestTest,
  processRelationshipOwnerFollowUpDigests,
} from "@/lib/server/relationship-owner-follow-up-processor";
import type { PartnerFollowUpItem } from "@/types";

const TEMPLATE = "relationship_owner_followup_digest";

function sampleFollowUpItem(): PartnerFollowUpItem {
  return {
    partner: {
      id: "p1",
      name: "Example University",
      city: "Bengaluru",
      state: "Karnataka",
      primaryContact: {
        name: "Contact",
        designation: "",
        phone: "9876543210",
        email: "c@example.edu",
      },
      secondaryContact: {
        name: "Secondary",
        designation: "",
        phone: "9000000001",
        email: "s@example.edu",
      },
      eventIds: [],
      relationshipOwner: {
        organization: "K2",
        spocId: "spoc-a",
        managerName: "Owner A",
        managerPhone: "919876543210",
        managerEmail: "owner@example.com",
      },
      stage: "Meeting Scheduled",
      stageRemarks: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    meeting: {
      id: "m1",
      meetingAt: "2026-07-20T10:00:00",
      outcome: "in_discussion",
      followUpAt: "2026-07-21T10:00:00",
      createdAt: "2026-07-20T00:00:00.000Z",
      updatedAt: "2026-07-20T00:00:00.000Z",
    },
  };
}

describe("processRelationshipOwnerFollowUpDigestTest", () => {
  const sendTemplate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RELATIONSHIP_OWNER_FOLLOWUP_TEMPLATE_NAME = TEMPLATE;
    process.env.RELATIONSHIP_OWNER_FOLLOWUP_TEMPLATE_LANGUAGE = "en";
    sendTemplate.mockResolvedValue({ success: true, messageId: "wamid.test-123" });
    findUniqueDigest.mockResolvedValue(null);
  });

  it("sends one template message to the SPOC canonical phone", async () => {
    findUniqueSpoc.mockResolvedValue({
      id: "spoc-a",
      name: "Owner A",
      phone: "+91 98765 43210",
    });
    listDueFollowUpsForOwner.mockResolvedValue([sampleFollowUpItem()]);

    const result = await processRelationshipOwnerFollowUpDigestTest({
      ownerSpocId: "spoc-a",
      now: new Date("2026-07-21T10:00:00+05:30"),
      sendTemplate,
    });

    expect(result.status).toBe("sent");
    expect(result.ownerName).toBe("Owner A");
    expect(result.followUpCount).toBe(1);
    expect(result.messageId).toBe("wamid.test-123");
    expect(result.templateName).toBe(TEMPLATE);
    expect(result.recipientPhoneMasked).toBe("******3210");
    expect(sendTemplate).toHaveBeenCalledOnce();
    expect(sendTemplate.mock.calls[0]?.[0]).toMatchObject({
      to: "919876543210",
      templateName: TEMPLATE,
      languageCode: "en",
    });
    expect(listDistinctOwnerSpocIdsWithPartners).not.toHaveBeenCalled();
    expect(findUniqueDigest).not.toHaveBeenCalled();
    expect(upsertDigest).not.toHaveBeenCalled();
    expect(updateDigest).not.toHaveBeenCalled();
  });

  it("skips with zero_follow_ups without sending", async () => {
    findUniqueSpoc.mockResolvedValue({
      id: "spoc-a",
      name: "Owner A",
      phone: "9876543210",
    });
    listDueFollowUpsForOwner.mockResolvedValue([]);

    const result = await processRelationshipOwnerFollowUpDigestTest({
      ownerSpocId: "spoc-a",
      sendTemplate,
    });

    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("zero_follow_ups");
    expect(sendTemplate).not.toHaveBeenCalled();
    expect(upsertDigest).not.toHaveBeenCalled();
  });

  it("skips with missing_phone without sending", async () => {
    findUniqueSpoc.mockResolvedValue({
      id: "spoc-a",
      name: "Owner A",
      phone: "123",
    });
    listDueFollowUpsForOwner.mockResolvedValue([sampleFollowUpItem()]);

    const result = await processRelationshipOwnerFollowUpDigestTest({
      ownerSpocId: "spoc-a",
      sendTemplate,
    });

    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("missing_phone");
    expect(sendTemplate).not.toHaveBeenCalled();
  });

  it("skips when template is not configured", async () => {
    delete process.env.RELATIONSHIP_OWNER_FOLLOWUP_TEMPLATE_NAME;
    const result = await processRelationshipOwnerFollowUpDigestTest({
      ownerSpocId: "spoc-a",
      sendTemplate,
    });
    expect(result.reason).toBe("template_not_configured");
    expect(sendTemplate).not.toHaveBeenCalled();
  });

  it("loads only the requested owner", async () => {
    findUniqueSpoc.mockResolvedValue({
      id: "spoc-b",
      name: "Owner B",
      phone: "9876500000",
    });
    listDueFollowUpsForOwner.mockResolvedValue([]);

    await processRelationshipOwnerFollowUpDigestTest({
      ownerSpocId: "spoc-b",
      sendTemplate,
    });

    expect(findUniqueSpoc).toHaveBeenCalledWith({ where: { id: "spoc-b" } });
    expect(listDueFollowUpsForOwner).toHaveBeenCalledWith({
      ownerSpocId: "spoc-b",
      asOf: expect.any(Date),
    });
    expect(listDistinctOwnerSpocIdsWithPartners).not.toHaveBeenCalled();
  });
});

describe("processRelationshipOwnerFollowUpDigests automatic path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RELATIONSHIP_OWNER_FOLLOWUP_TEMPLATE_NAME = TEMPLATE;
    listDistinctOwnerSpocIdsWithPartners.mockResolvedValue(["spoc-a", "spoc-b"]);
    findUniqueDigest.mockResolvedValue(null);
    findUniqueSpoc.mockResolvedValue({
      id: "spoc-a",
      name: "Owner A",
      phone: "9876543210",
    });
    listDueFollowUpsForOwner.mockResolvedValue([]);
    upsertDigest.mockResolvedValue({});
  });

  it("still examines all owners and may persist digest rows", async () => {
    const summary = await processRelationshipOwnerFollowUpDigests({
      now: new Date("2026-07-21T10:00:00+05:30"),
      sendTemplate: vi.fn(),
    });
    expect(summary.examinedOwners).toBe(2);
    expect(upsertDigest).toHaveBeenCalled();
  });
});
