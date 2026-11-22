import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  campaignHasOutboundSendingEvidence,
  deleteCampaign,
} from "@/lib/server/whatsapp/campaign-delete";

const { findUnique, findMany, deleteMock, updateMock } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
  deleteMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    whatsAppCampaign: {
      findUnique,
      delete: deleteMock,
      update: updateMock,
    },
    whatsAppCampaignRecipient: {
      findMany,
    },
  },
}));

describe("campaignHasOutboundSendingEvidence", () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it("treats SIMULATED-only drafts as safe to hard delete", async () => {
    findMany.mockResolvedValue([
      { status: "SIMULATED", metaMessageId: null },
      { status: "PENDING", metaMessageId: null },
    ]);
    await expect(campaignHasOutboundSendingEvidence("c1")).resolves.toBe(false);
  });

  it("detects real Meta message ids", async () => {
    findMany.mockResolvedValue([
      { status: "ACCEPTED", metaMessageId: "wamid.real" },
    ]);
    await expect(campaignHasOutboundSendingEvidence("c1")).resolves.toBe(true);
  });
});

describe("deleteCampaign", () => {
  beforeEach(() => {
    findUnique.mockReset();
    findMany.mockReset();
    deleteMock.mockReset();
    updateMock.mockReset();
  });

  it("rejects deleting a running campaign", async () => {
    findUnique.mockResolvedValue({
      id: "c1",
      status: "RUNNING",
      deletedAt: null,
    });
    await expect(
      deleteCampaign({ campaignId: "c1", adminUserId: "admin" })
    ).rejects.toThrow(/still sending/i);
  });

  it("rejects deleting a paused campaign", async () => {
    findUnique.mockResolvedValue({
      id: "c1",
      status: "PAUSED",
      deletedAt: null,
    });
    await expect(
      deleteCampaign({ campaignId: "c1", adminUserId: "admin" })
    ).rejects.toThrow(/Cancel this campaign/i);
  });

  it("hard deletes a clean draft", async () => {
    findUnique.mockResolvedValue({
      id: "c1",
      status: "DRAFT",
      deletedAt: null,
    });
    findMany.mockResolvedValue([{ status: "PENDING", metaMessageId: null }]);
    deleteMock.mockResolvedValue({});

    const result = await deleteCampaign({
      campaignId: "c1",
      adminUserId: "admin",
    });
    expect(result.outcome).toBe("hard_deleted");
    expect(deleteMock).toHaveBeenCalled();
  });

  it("soft deletes completed campaigns", async () => {
    findUnique.mockResolvedValue({
      id: "c1",
      status: "COMPLETED",
      deletedAt: null,
    });
    findMany.mockResolvedValue([
      { status: "DELIVERED", metaMessageId: "wamid.1" },
    ]);
    updateMock.mockResolvedValue({});

    const result = await deleteCampaign({
      campaignId: "c1",
      adminUserId: "admin",
    });
    expect(result.outcome).toBe("soft_deleted");
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deletedByAdminId: "admin",
        }),
      })
    );
  });

  it("is idempotent when already deleted", async () => {
    findUnique.mockResolvedValue({
      id: "c1",
      status: "CANCELLED",
      deletedAt: new Date(),
    });
    const result = await deleteCampaign({
      campaignId: "c1",
      adminUserId: "admin",
    });
    expect(result.outcome).toBe("already_deleted");
  });
});