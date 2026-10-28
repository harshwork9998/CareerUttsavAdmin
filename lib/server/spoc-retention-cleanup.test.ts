import { describe, expect, it, vi } from "vitest";

import {
  RETAINED_SPOC_PROFILES,
  buildSpocCleanupDiagnosticReport,
  executeSpocRetentionCleanup,
  resolveRetainedSpocIds,
  spocMatchesRetainedProfile,
} from "@/lib/server/spoc-retention-cleanup";

describe("spoc retention profiles", () => {
  it("matches only exact retained name + organization pairs", () => {
    expect(
      spocMatchesRetainedProfile({
        name: "Neha Choudhary",
        organization: "K2 Learning",
      })
    ).toBe(true);
    expect(
      spocMatchesRetainedProfile({
        name: "Neha Choudhary",
        organization: "IES",
      })
    ).toBe(false);
    expect(
      spocMatchesRetainedProfile({
        name: "Meera Joshi",
        organization: "IES",
      })
    ).toBe(false);
  });

  it("resolves retained IDs for the three keep-list profiles", () => {
    const spocs = [
      { id: "keep-neha", name: "Neha Choudhary", organization: "K2 Learning" },
      { id: "keep-sripal", name: "Sripal Jain", organization: "K2 Learning" },
      { id: "keep-harsh", name: "harsh test", organization: "k2 learning" },
      { id: "drop-meera", name: "Meera Joshi", organization: "IES" },
      { id: "drop-priya", name: "Priya Natarajan", organization: "K2" },
    ];

    const resolved = resolveRetainedSpocIds(spocs);
    expect(resolved.missingProfiles).toEqual([]);
    expect(resolved.retainedIds).toEqual([
      "keep-neha",
      "keep-sripal",
      "keep-harsh",
    ]);
    expect(spocs.filter((row) => !resolved.retainedIds.includes(row.id))).toHaveLength(
      2
    );
  });

  it("selects non-retained SPOCs for deletion in diagnostics", async () => {
    const spocs = [
      { id: "keep-neha", name: "Neha Choudhary", organization: "K2 Learning" },
      { id: "keep-sripal", name: "Sripal Jain", organization: "K2 Learning" },
      { id: "keep-harsh", name: "harsh test", organization: "k2 learning" },
      { id: "drop-meera", name: "Meera Joshi", organization: "IES" },
    ];

    const db = {
      spoc: {
        findMany: vi.fn(async () => spocs),
      },
      partner: {
        groupBy: vi.fn(async () => [
          { relationshipSpocId: "drop-meera", _count: { _all: 2 } },
        ]),
      },
      adminUser: {
        groupBy: vi.fn(async () => [
          { relationshipSpocId: "drop-meera", _count: { _all: 1 } },
        ]),
      },
      relationshipOwnerFollowUpDigest: {},
    };

    const report = await buildSpocCleanupDiagnosticReport(db as never);
    expect(report.retained).toHaveLength(3);
    expect(report.proposedForDeletion).toEqual([
      expect.objectContaining({
        id: "drop-meera",
        partnerReferenceCount: 2,
        adminUserReferenceCount: 1,
      }),
    ]);
    expect(RETAINED_SPOC_PROFILES).toHaveLength(3);
  });
});

describe("executeSpocRetentionCleanup", () => {
  it("nulls partner and admin references then deletes SPOCs in a transaction", async () => {
    const spocs = [
      { id: "keep-neha", name: "Neha Choudhary", organization: "K2 Learning" },
      { id: "keep-sripal", name: "Sripal Jain", organization: "K2 Learning" },
      { id: "keep-harsh", name: "harsh test", organization: "k2 learning" },
      { id: "drop-meera", name: "Meera Joshi", organization: "IES" },
    ];

    const partnerUpdateMany = vi.fn(async () => ({ count: 2 }));
    const adminUpdateMany = vi.fn(async () => ({ count: 1 }));
    const spocDeleteMany = vi.fn(async () => ({ count: 1 }));
    const spocCount = vi.fn(async () => 3);

    const tx = {
      partner: { updateMany: partnerUpdateMany },
      adminUser: { updateMany: adminUpdateMany },
      spoc: { deleteMany: spocDeleteMany, count: spocCount },
    };

    const db = {
      spoc: { findMany: vi.fn(async () => spocs) },
      partner: {
        groupBy: vi.fn(async () => []),
      },
      adminUser: {
        groupBy: vi.fn(async () => []),
      },
      relationshipOwnerFollowUpDigest: {},
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx)
      ),
    };

    const result = await executeSpocRetentionCleanup(db as never, {
      dryRun: false,
    });

    expect(partnerUpdateMany).toHaveBeenCalledWith({
      where: { relationshipSpocId: { in: ["drop-meera"] } },
      data: { relationshipSpocId: null },
    });
    expect(adminUpdateMany).toHaveBeenCalledWith({
      where: { relationshipSpocId: { in: ["drop-meera"] } },
      data: { relationshipSpocId: null },
    });
    expect(spocDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["drop-meera"] } },
    });
    expect(result.deletedCount).toBe(1);
    expect(result.nulledPartnerReferences).toBe(2);
    expect(result.nulledAdminUserReferences).toBe(1);
    expect(result.retainedCount).toBe(3);
    expect(result.errors).toEqual([]);
  });

  it("is idempotent when only retained SPOCs remain", async () => {
    const spocs = [
      { id: "keep-neha", name: "Neha Choudhary", organization: "K2 Learning" },
      { id: "keep-sripal", name: "Sripal Jain", organization: "K2 Learning" },
      { id: "keep-harsh", name: "harsh test", organization: "k2 learning" },
    ];

    const db = {
      spoc: { findMany: vi.fn(async () => spocs) },
      partner: { groupBy: vi.fn(async () => []) },
      adminUser: { groupBy: vi.fn(async () => []) },
      relationshipOwnerFollowUpDigest: {},
      $transaction: vi.fn(),
    };

    const result = await executeSpocRetentionCleanup(db as never);
    expect(result.deletedCount).toBe(0);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
