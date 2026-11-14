import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => {
  const client = {
    leadSource: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    leadSubSource: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    marketingCampaign: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: typeof client) => Promise<unknown>) =>
      fn(client)
    ),
  };
  return { prismaMock: client };
});

vi.mock("@/lib/server/marketing-attribution-audit", () => ({
  recordMarketingAttributionAudit: vi.fn(),
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/server/marketing-attribution-prisma-store", () => ({
  listMarketingAttributionTree: vi.fn(async () => ({ sources: [] })),
  getLeadSourceById: vi.fn(),
  getLeadSubSourceById: vi.fn(),
  getMarketingCampaignById: vi.fn(),
  isPrismaUniqueConstraintError: vi.fn(() => true),
  countSubSourcesForLeadSource: vi.fn(),
  countCampaignsForSubSource: vi.fn(),
}));

import { recordMarketingAttributionAudit } from "@/lib/server/marketing-attribution-audit";
import {
  createLeadSourceForApi,
  createLeadSubSourceForApi,
  createMarketingCampaignForApi,
  updateLeadSourceForApi,
  updateLeadSubSourceForApi,
  updateMarketingCampaignForApi,
} from "@/lib/server/marketing-attribution-service";
import {
  getLeadSourceById,
  getLeadSubSourceById,
  getMarketingCampaignById,
} from "@/lib/server/marketing-attribution-prisma-store";

const now = new Date("2026-11-14T00:00:00.000Z");

describe("marketing attribution service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a lead source and records audit in the same transaction", async () => {
    prismaMock.leadSource.create.mockResolvedValue({
      id: "src-1",
      name: "Offline Marketing",
      nameKey: "offline marketing",
      description: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const result = await createLeadSourceForApi(
      { name: "Offline Marketing" },
      "admin-1"
    );
    expect(result.ok).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(recordMarketingAttributionAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        adminUserId: "admin-1",
        action: "CREATE",
        metadata: expect.objectContaining({ after: expect.any(Object) }),
      }),
      prismaMock
    );
  });

  it("returns 409 for duplicate lead source names (case-insensitive)", async () => {
    prismaMock.leadSource.create.mockRejectedValue({ code: "P2002" });
    const result = await createLeadSourceForApi(
      { name: "offline marketing" },
      "admin-1"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toMatch(/case-insensitively/);
    }
    expect(recordMarketingAttributionAudit).not.toHaveBeenCalled();
  });

  it("allows the same sub-source name under different lead sources", async () => {
    vi.mocked(getLeadSourceById).mockResolvedValue({
      id: "src-2",
      name: "Digital Marketing",
      nameKey: "digital marketing",
      description: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    prismaMock.leadSubSource.create.mockResolvedValue({
      id: "sub-2",
      leadSourceId: "src-2",
      name: "Auto",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const result = await createLeadSubSourceForApi(
      { leadSourceId: "src-2", name: "Auto" },
      "admin-1"
    );
    expect(result.ok).toBe(true);
    expect(prismaMock.leadSubSource.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nameKey: "auto",
          leadSourceId: "src-2",
        }),
      })
    );
  });

  it("returns 409 for duplicate sub-source names under the same parent", async () => {
    vi.mocked(getLeadSourceById).mockResolvedValue({
      id: "src-1",
      name: "Offline Marketing",
      nameKey: "offline marketing",
      description: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    prismaMock.leadSubSource.create.mockRejectedValue({ code: "P2002" });

    const result = await createLeadSubSourceForApi(
      { leadSourceId: "src-1", name: "auto" },
      "admin-1"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toMatch(/already has a sub-source/);
    }
  });

  it("deactivates a lead source", async () => {
    vi.mocked(getLeadSourceById).mockResolvedValue({
      id: "src-1",
      name: "Offline Marketing",
      nameKey: "offline marketing",
      description: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    prismaMock.leadSource.update.mockResolvedValue({
      id: "src-1",
      name: "Offline Marketing",
      nameKey: "offline marketing",
      description: null,
      isActive: false,
      createdAt: now,
      updatedAt: now,
    });

    const result = await updateLeadSourceForApi(
      "src-1",
      { isActive: false },
      "admin-1"
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.isActive).toBe(false);
  });

  it("rejects sub-source under inactive parent", async () => {
    vi.mocked(getLeadSourceById).mockResolvedValue({
      id: "src-1",
      name: "Offline Marketing",
      nameKey: "offline marketing",
      description: null,
      isActive: false,
      createdAt: now,
      updatedAt: now,
    });

    const result = await createLeadSubSourceForApi(
      { leadSourceId: "src-1", name: "Auto" },
      "admin-1"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects parent reassignment on sub-source update", async () => {
    vi.mocked(getLeadSubSourceById).mockResolvedValue({
      id: "sub-1",
      leadSourceId: "src-1",
      name: "Auto",
      nameKey: "auto",
      isActive: true,
      createdAt: now,
      updatedAt: now,
      leadSource: {
        id: "src-1",
        name: "Offline Marketing",
        nameKey: "offline marketing",
        description: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    });

    const result = await updateLeadSubSourceForApi(
      "sub-1",
      { leadSourceId: "other" },
      "admin-1"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/cannot be changed/);
  });

  it("creates campaigns with normalized codes", async () => {
    vi.mocked(getLeadSubSourceById).mockResolvedValue({
      id: "sub-1",
      leadSourceId: "src-1",
      name: "Auto",
      nameKey: "auto",
      isActive: true,
      createdAt: now,
      updatedAt: now,
      leadSource: {
        id: "src-1",
        name: "Offline Marketing",
        nameKey: "offline marketing",
        description: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    });

    prismaMock.marketingCampaign.create.mockResolvedValue({
      id: "camp-1",
      leadSubSourceId: "sub-1",
      name: "Bengaluru Auto Campaign",
      trackingCode: "AUTO26",
      trackingCodeKey: "auto26",
      placementDescription: null,
      startDate: null,
      endDate: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      leadSubSource: {
        id: "sub-1",
        leadSourceId: "src-1",
        name: "Auto",
        nameKey: "auto",
        isActive: true,
        createdAt: now,
        updatedAt: now,
        leadSource: {
          id: "src-1",
          name: "Offline Marketing",
          nameKey: "offline marketing",
          description: null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      },
    });

    const result = await createMarketingCampaignForApi(
      {
        leadSubSourceId: "sub-1",
        name: "Bengaluru Auto Campaign",
        trackingCode: "auto26",
      },
      "admin-1"
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.trackingCode).toBe("AUTO26");
      expect(result.data.trackingUrl).toContain("ref=AUTO26");
    }
  });

  it("rejects duplicate tracking codes", async () => {
    vi.mocked(getLeadSubSourceById).mockResolvedValue({
      id: "sub-1",
      leadSourceId: "src-1",
      name: "Auto",
      nameKey: "auto",
      isActive: true,
      createdAt: now,
      updatedAt: now,
      leadSource: {
        id: "src-1",
        name: "Offline Marketing",
        nameKey: "offline marketing",
        description: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    });

    prismaMock.marketingCampaign.create.mockRejectedValue({ code: "P2002" });

    const result = await createMarketingCampaignForApi(
      {
        leadSubSourceId: "sub-1",
        name: "Another",
        trackingCode: "AUTO26",
      },
      "admin-1"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toMatch(/retired campaigns/);
    }
    expect(recordMarketingAttributionAudit).not.toHaveBeenCalled();
  });

  it("rejects concurrent duplicate campaign code creation with 409", async () => {
    vi.mocked(getLeadSubSourceById).mockResolvedValue({
      id: "sub-1",
      leadSourceId: "src-1",
      name: "Auto",
      nameKey: "auto",
      isActive: true,
      createdAt: now,
      updatedAt: now,
      leadSource: {
        id: "src-1",
        name: "Offline Marketing",
        nameKey: "offline marketing",
        description: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    });
    prismaMock.marketingCampaign.create.mockRejectedValue({ code: "P2002" });

    const [a, b] = await Promise.all([
      createMarketingCampaignForApi(
        { leadSubSourceId: "sub-1", name: "Race Campaign A", trackingCode: "AUTO26" },
        "admin-1"
      ),
      createMarketingCampaignForApi(
        { leadSubSourceId: "sub-1", name: "Race Campaign B", trackingCode: "auto26" },
        "admin-2"
      ),
    ]);
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(false);
    if (!a.ok) expect(a.status).toBe(409);
    if (!b.ok) expect(b.status).toBe(409);
  });

  it("blocks tracking code changes after create", async () => {
    const result = await updateMarketingCampaignForApi(
      "camp-1",
      { trackingCode: "NEW" },
      "admin-1"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/cannot be changed/);
  });

  it("rejects invalid campaign date ranges", async () => {
    vi.mocked(getMarketingCampaignById).mockResolvedValue({
      id: "camp-1",
      leadSubSourceId: "sub-1",
      name: "Camp",
      trackingCode: "AUTO26",
      trackingCodeKey: "auto26",
      placementDescription: null,
      startDate: null,
      endDate: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      leadSubSource: {
        id: "sub-1",
        leadSourceId: "src-1",
        name: "Auto",
        nameKey: "auto",
        isActive: true,
        createdAt: now,
        updatedAt: now,
        leadSource: {
          id: "src-1",
          name: "Offline Marketing",
          nameKey: "offline marketing",
          description: null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      },
    });

    const result = await updateMarketingCampaignForApi(
      "camp-1",
      {
        startDate: "2026-12-01T00:00:00.000Z",
        endDate: "2026-11-01T00:00:00.000Z",
      },
      "admin-1"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/End date/);
  });

  it("prevents campaign activation when parent is inactive", async () => {
    vi.mocked(getMarketingCampaignById).mockResolvedValue({
      id: "camp-1",
      leadSubSourceId: "sub-1",
      name: "Camp",
      trackingCode: "AUTO26",
      trackingCodeKey: "auto26",
      placementDescription: null,
      startDate: null,
      endDate: null,
      isActive: false,
      createdAt: now,
      updatedAt: now,
      leadSubSource: {
        id: "sub-1",
        leadSourceId: "src-1",
        name: "Auto",
        nameKey: "auto",
        isActive: false,
        createdAt: now,
        updatedAt: now,
        leadSource: {
          id: "src-1",
          name: "Offline Marketing",
          nameKey: "offline marketing",
          description: null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      },
    });

    const result = await updateMarketingCampaignForApi(
      "camp-1",
      { isActive: true },
      "admin-1"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/inactive/);
  });
});