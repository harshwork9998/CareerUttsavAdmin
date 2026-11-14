import { beforeEach, describe, expect, it, vi } from "vitest";

const { auditCreate, txAuditCreate, txClient } = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  txAuditCreate: vi.fn(),
  txClient: {
    marketingAttributionAuditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    marketingAttributionAuditLog: {
      create: auditCreate,
    },
  },
}));

import { recordMarketingAttributionAudit } from "@/lib/server/marketing-attribution-audit";

describe("recordMarketingAttributionAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txClient.marketingAttributionAuditLog.create.mockImplementation(txAuditCreate);
  });

  it("writes through the transaction client when provided", async () => {
    await recordMarketingAttributionAudit(
      {
        adminUserId: "admin-42",
        action: "CREATE",
        entityType: "LEAD_SOURCE",
        entityId: "src-1",
        summary: "Created lead source",
        metadata: { after: { name: "Offline Marketing" } },
      },
      txClient as never
    );
    expect(txAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          adminUserId: "admin-42",
          action: "CREATE",
          entityType: "LEAD_SOURCE",
        }),
      })
    );
    expect(auditCreate).not.toHaveBeenCalled();
  });
});