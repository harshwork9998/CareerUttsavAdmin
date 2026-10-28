import { describe, expect, it, vi } from "vitest";

import {
  HARSH_TEST_SPOC_ID,
  RETAINED_SPOC_ALLOWLIST,
  RETAINED_SPOC_IDS,
  buildSpocCleanupDiagnosticReport,
  executeSpocRetentionCleanup,
  isRetainedSpocId,
  planHarshTestOrganizationNormalization,
  validateRetainedSpocs,
} from "@/lib/server/spoc-retention-cleanup";

const PRODUCTION_RETAINED = [
  {
    id: "c5y3v9ex9",
    name: "Neha Choudhary",
    organization: "K2 Learning",
  },
  {
    id: "o14obh405",
    name: "Sripal Jain",
    organization: "K2 Learning",
  },
  {
    id: "4rf64jc98",
    name: "harsh test",
    organization: "k2 learniung",
  },
] as const;

const PRODUCTION_DELETE = [
  { id: "qvvgr4ixn", name: "Meera Joshi", organization: "IES" },
  { id: "38whm9ctz", name: "Priya Natarajan", organization: "K2" },
  { id: "3jv3gueb5", name: "Suresh Kulkarni", organization: "K2" },
  { id: "kus83u0c2", name: "test spoc", organization: "k2" },
] as const;

describe("retained SPOC id allowlist", () => {
  it("uses exact production ids", () => {
    expect(RETAINED_SPOC_IDS).toEqual([
      "c5y3v9ex9",
      "o14obh405",
      "4rf64jc98",
    ]);
    expect(RETAINED_SPOC_ALLOWLIST).toHaveLength(3);
  });

  it("retains harsh test despite organisation typo", () => {
    const spocs = [...PRODUCTION_RETAINED, ...PRODUCTION_DELETE];
    const validation = validateRetainedSpocs(spocs);
    expect(validation.missingRetainedIds).toEqual([]);
    expect(validation.retainedNameMismatches).toEqual([]);
    expect(isRetainedSpocId("4rf64jc98")).toBe(true);
  });

  it("aborts when a retained id is missing", () => {
    const spocs = PRODUCTION_RETAINED.filter((row) => row.id !== "4rf64jc98");
    const validation = validateRetainedSpocs(spocs);
    expect(validation.missingRetainedIds).toEqual(["4rf64jc98"]);
  });

  it("aborts when a retained name mismatches", () => {
    const spocs = [
      ...PRODUCTION_RETAINED.filter((row) => row.id !== "c5y3v9ex9"),
      { id: "c5y3v9ex9", name: "Wrong Name", organization: "K2 Learning" },
    ];
    const validation = validateRetainedSpocs(spocs);
    expect(validation.retainedNameMismatches).toEqual([
      {
        id: "c5y3v9ex9",
        expectedName: "Neha Choudhary",
        actualName: "Wrong Name",
      },
    ]);
  });

  it("plans organisation normalization for harsh test typo", () => {
    expect(
      planHarshTestOrganizationNormalization({
        id: HARSH_TEST_SPOC_ID,
        organization: "k2 learniung",
      })
    ).toEqual({
      id: HARSH_TEST_SPOC_ID,
      from: "k2 learniung",
      to: "K2 Learning",
    });
    expect(
      planHarshTestOrganizationNormalization({
        id: HARSH_TEST_SPOC_ID,
        organization: "K2 Learning",
      })
    ).toBeNull();
  });
});

describe("buildSpocCleanupDiagnosticReport", () => {
  it("proposes only the four non-retained production SPOCs for deletion", async () => {
    const spocs = [...PRODUCTION_RETAINED, ...PRODUCTION_DELETE];
    const db = {
      spoc: { findMany: vi.fn(async () => spocs) },
      partner: {
        groupBy: vi.fn(async () => [
          { relationshipSpocId: "qvvgr4ixn", _count: { _all: 1 } },
          { relationshipSpocId: HARSH_TEST_SPOC_ID, _count: { _all: 2 } },
        ]),
      },
      adminUser: { groupBy: vi.fn(async () => []) },
      relationshipOwnerFollowUpDigest: {},
    };

    const report = await buildSpocCleanupDiagnosticReport(db as never);
    expect(report.proposedForDeletion.map((row) => row.id)).toEqual(
      PRODUCTION_DELETE.map((row) => row.id)
    );
    expect(
      report.proposedForDeletion.some((row) => row.id === HARSH_TEST_SPOC_ID)
    ).toBe(false);
    expect(
      report.retained.find((row) => row.id === HARSH_TEST_SPOC_ID)
        ?.partnerReferenceCount
    ).toBe(2);
    expect(report.plannedOrganizationUpdates).toEqual([
      {
        id: HARSH_TEST_SPOC_ID,
        from: "k2 learniung",
        to: "K2 Learning",
      },
    ]);
  });
});

describe("executeSpocRetentionCleanup", () => {
  it("nulls only deleted SPOC references and preserves harsh test partners", async () => {
    const spocs = [...PRODUCTION_RETAINED, PRODUCTION_DELETE[0]!];
    const partnerUpdateMany = vi.fn(async () => ({ count: 1 }));
    const adminUpdateMany = vi.fn(async () => ({ count: 0 }));
    const spocUpdate = vi.fn(async () => ({}));
    const spocDeleteMany = vi.fn(async () => ({ count: 1 }));
    const spocCount = vi.fn(async () => 3);
    const partnerCount = vi
      .fn()
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(2);

    const tx = {
      partner: { updateMany: partnerUpdateMany, count: partnerCount },
      adminUser: { updateMany: adminUpdateMany },
      spoc: {
        update: spocUpdate,
        deleteMany: spocDeleteMany,
        count: spocCount,
      },
    };

    const db = {
      spoc: {
        findMany: vi.fn(async () => spocs),
      },
      partner: {
        groupBy: vi.fn(async () => [
          { relationshipSpocId: PRODUCTION_DELETE[0]!.id, _count: { _all: 1 } },
          { relationshipSpocId: HARSH_TEST_SPOC_ID, _count: { _all: 2 } },
        ]),
        count: partnerCount,
      },
      adminUser: { groupBy: vi.fn(async () => []) },
      relationshipOwnerFollowUpDigest: {},
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx)
      ),
    };

    const result = await executeSpocRetentionCleanup(db as never, {
      dryRun: false,
    });

    expect(partnerUpdateMany).toHaveBeenCalledWith({
      where: { relationshipSpocId: { in: [PRODUCTION_DELETE[0]!.id] } },
      data: { relationshipSpocId: null },
    });
    expect(spocUpdate).toHaveBeenCalledWith({
      where: { id: HARSH_TEST_SPOC_ID },
      data: { organization: "K2 Learning" },
    });
    expect(result.harshTestPartnerReferenceCount).toBe(2);
    expect(result.organizationNormalized).toBe(true);
    expect(result.retainedCount).toBe(3);
    expect(result.errors).toEqual([]);
  });

  it("does not execute when a retained id is missing", async () => {
    const spocs = PRODUCTION_RETAINED.filter((row) => row.id !== "o14obh405");
    const db = {
      spoc: { findMany: vi.fn(async () => spocs) },
      partner: { groupBy: vi.fn(async () => []) },
      adminUser: { groupBy: vi.fn(async () => []) },
      relationshipOwnerFollowUpDigest: {},
      $transaction: vi.fn(),
    };

    const result = await executeSpocRetentionCleanup(db as never, {
      dryRun: false,
    });
    expect(result.errors.some((msg) => msg.includes("o14obh405"))).toBe(true);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("dry-run keeps harsh test off deletion list with partner count intact", async () => {
    const spocs = [...PRODUCTION_RETAINED, ...PRODUCTION_DELETE];
    const db = {
      spoc: { findMany: vi.fn(async () => spocs) },
      partner: {
        groupBy: vi.fn(async () => [
          { relationshipSpocId: HARSH_TEST_SPOC_ID, _count: { _all: 2 } },
        ]),
      },
      adminUser: { groupBy: vi.fn(async () => []) },
      relationshipOwnerFollowUpDigest: {},
      $transaction: vi.fn(),
    };

    const result = await executeSpocRetentionCleanup(db as never, {
      dryRun: true,
    });
    expect(result.deletedCount).toBe(4);
    expect(result.harshTestPartnerReferenceCount).toBe(2);
    expect(
      result.report.proposedForDeletion.some((row) => row.id === HARSH_TEST_SPOC_ID)
    ).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
