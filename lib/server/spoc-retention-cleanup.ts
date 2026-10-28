import type { PrismaClient } from "@/lib/generated/prisma/client";

/** Canonical one-time production retention allowlist (exact database IDs). */
export const RETAINED_SPOC_ALLOWLIST = [
  { id: "c5y3v9ex9", expectedName: "Neha Choudhary" },
  { id: "o14obh405", expectedName: "Sripal Jain" },
  { id: "4rf64jc98", expectedName: "harsh test" },
] as const;

export const RETAINED_SPOC_IDS: readonly string[] = RETAINED_SPOC_ALLOWLIST.map(
  (row) => row.id
);

export const HARSH_TEST_SPOC_ID = "4rf64jc98" as const;
export const HARSH_TEST_ORGANIZATION_CANONICAL = "K2 Learning";

export type SpocRetentionRow = {
  id: string;
  name: string;
  organization: string;
  partnerReferenceCount: number;
  adminUserReferenceCount: number;
};

export type RetainedSpocNameMismatch = {
  id: string;
  expectedName: string;
  actualName: string;
};

export type SpocCleanupDiagnosticReport = {
  retained: SpocRetentionRow[];
  proposedForDeletion: SpocRetentionRow[];
  missingRetainedIds: string[];
  retainedNameMismatches: RetainedSpocNameMismatch[];
  plannedOrganizationUpdates: { id: string; from: string; to: string }[];
  dependencyNotes: string[];
};

export function isRetainedSpocId(spocId: string): boolean {
  return RETAINED_SPOC_IDS.includes(spocId);
}

export function validateRetainedSpocs(
  spocs: { id: string; name: string; organization: string }[]
): {
  retainedIds: readonly string[];
  missingRetainedIds: string[];
  retainedNameMismatches: RetainedSpocNameMismatch[];
} {
  const byId = new Map(spocs.map((row) => [row.id, row]));
  const missingRetainedIds: string[] = [];
  const retainedNameMismatches: RetainedSpocNameMismatch[] = [];

  for (const entry of RETAINED_SPOC_ALLOWLIST) {
    const row = byId.get(entry.id);
    if (!row) {
      missingRetainedIds.push(entry.id);
      continue;
    }
    if (row.name.trim() !== entry.expectedName) {
      retainedNameMismatches.push({
        id: entry.id,
        expectedName: entry.expectedName,
        actualName: row.name.trim(),
      });
    }
  }

  return {
    retainedIds: RETAINED_SPOC_IDS,
    missingRetainedIds,
    retainedNameMismatches,
  };
}

export function planHarshTestOrganizationNormalization(spoc: {
  id: string;
  organization: string;
}): { id: string; from: string; to: string } | null {
  if (spoc.id !== HARSH_TEST_SPOC_ID) return null;
  const from = spoc.organization.trim();
  if (from === HARSH_TEST_ORGANIZATION_CANONICAL) return null;
  return { id: spoc.id, from, to: HARSH_TEST_ORGANIZATION_CANONICAL };
}

const SPOC_DEPENDENCY_NOTES = [
  "Partner.relationshipSpocId → Spoc (ON DELETE SET NULL)",
  "AdminUser.relationshipSpocId → Spoc (ON DELETE SET NULL)",
  "RelationshipOwnerFollowUpDigest.ownerSpocId → Spoc (ON DELETE CASCADE — digest send logs for removed SPOCs are removed with the SPOC; partner meeting follow-up history is stored on Partner JSON and is not deleted)",
  "PartnerCommunicationLog and other partner tables do not reference Spoc directly",
  "Retention is enforced by exact SPOC id allowlist; organisation strings are not used for keep/delete decisions",
] as const;

export async function buildSpocCleanupDiagnosticReport(
  db: Pick<
    PrismaClient,
    "spoc" | "partner" | "adminUser" | "relationshipOwnerFollowUpDigest"
  >
): Promise<SpocCleanupDiagnosticReport> {
  const spocs = await db.spoc.findMany({
    select: { id: true, name: true, organization: true },
    orderBy: { name: "asc" },
  });

  const partnerCounts = await db.partner.groupBy({
    by: ["relationshipSpocId"],
    _count: { _all: true },
    where: { relationshipSpocId: { not: null } },
  });
  const adminCounts = await db.adminUser.groupBy({
    by: ["relationshipSpocId"],
    _count: { _all: true },
    where: { relationshipSpocId: { not: null } },
  });

  const partnerCountBySpoc = new Map<string, number>();
  for (const row of partnerCounts) {
    if (row.relationshipSpocId) {
      partnerCountBySpoc.set(row.relationshipSpocId, row._count._all);
    }
  }
  const adminCountBySpoc = new Map<string, number>();
  for (const row of adminCounts) {
    if (row.relationshipSpocId) {
      adminCountBySpoc.set(row.relationshipSpocId, row._count._all);
    }
  }

  const validation = validateRetainedSpocs(spocs);
  const retainedIdSet = new Set<string>(RETAINED_SPOC_IDS);

  const toRow = (spoc: (typeof spocs)[number]): SpocRetentionRow => ({
    id: spoc.id,
    name: spoc.name.trim(),
    organization: spoc.organization.trim(),
    partnerReferenceCount: partnerCountBySpoc.get(spoc.id) ?? 0,
    adminUserReferenceCount: adminCountBySpoc.get(spoc.id) ?? 0,
  });

  const plannedOrganizationUpdates = spocs
    .map((spoc) => planHarshTestOrganizationNormalization(spoc))
    .filter((row): row is { id: string; from: string; to: string } => row !== null);

  return {
    retained: RETAINED_SPOC_ALLOWLIST.map((entry) => {
      const spoc = spocs.find((row) => row.id === entry.id);
      if (!spoc) {
        return {
          id: entry.id,
          name: entry.expectedName,
          organization: "",
          partnerReferenceCount: 0,
          adminUserReferenceCount: 0,
        };
      }
      return toRow(spoc);
    }),
    proposedForDeletion: spocs
      .filter((spoc) => !retainedIdSet.has(spoc.id))
      .map(toRow),
    missingRetainedIds: validation.missingRetainedIds,
    retainedNameMismatches: validation.retainedNameMismatches,
    plannedOrganizationUpdates,
    dependencyNotes: [...SPOC_DEPENDENCY_NOTES],
  };
}

export type SpocRetentionCleanupResult = {
  dryRun: boolean;
  retainedCount: number;
  deletedCount: number;
  nulledPartnerReferences: number;
  nulledAdminUserReferences: number;
  harshTestPartnerReferenceCount: number;
  organizationNormalized: boolean;
  report: SpocCleanupDiagnosticReport;
  errors: string[];
};

function collectValidationErrors(
  report: SpocCleanupDiagnosticReport
): string[] {
  const errors: string[] = [];
  for (const id of report.missingRetainedIds) {
    const expected = RETAINED_SPOC_ALLOWLIST.find((row) => row.id === id);
    errors.push(
      `Retained SPOC id not found: ${id}${expected ? ` (${expected.expectedName})` : ""}`
    );
  }
  for (const mismatch of report.retainedNameMismatches) {
    errors.push(
      `Retained SPOC name mismatch for ${mismatch.id}: expected "${mismatch.expectedName}", found "${mismatch.actualName}"`
    );
  }
  for (const retained of report.retained) {
    if (report.proposedForDeletion.some((row) => row.id === retained.id)) {
      errors.push(`Retained SPOC ${retained.id} incorrectly marked for deletion`);
    }
  }
  if (
    report.missingRetainedIds.length === 0 &&
    report.retainedNameMismatches.length === 0 &&
    report.retained.length !== 3
  ) {
    errors.push(`Expected 3 retained SPOC rows in report, found ${report.retained.length}`);
  }
  return errors;
}

export async function executeSpocRetentionCleanup(
  db: PrismaClient,
  options?: { dryRun?: boolean }
): Promise<SpocRetentionCleanupResult> {
  const dryRun = options?.dryRun ?? false;
  const report = await buildSpocCleanupDiagnosticReport(db);
  const errors = collectValidationErrors(report);

  const spocs = await db.spoc.findMany({
    select: { id: true, name: true, organization: true },
  });
  const retainedIdSet = new Set<string>(RETAINED_SPOC_IDS);
  const deleteIds = spocs
    .map((row) => row.id)
    .filter((id) => !retainedIdSet.has(id));

  const harshRow = spocs.find((row) => row.id === HARSH_TEST_SPOC_ID);
  const harshTestPartnerReferenceCount =
    report.retained.find((row) => row.id === HARSH_TEST_SPOC_ID)
      ?.partnerReferenceCount ?? 0;
  const organizationPlan = harshRow
    ? planHarshTestOrganizationNormalization(harshRow)
    : null;

  if (errors.length > 0) {
    return {
      dryRun,
      retainedCount: spocs.filter((row) => retainedIdSet.has(row.id)).length,
      deletedCount: 0,
      nulledPartnerReferences: 0,
      nulledAdminUserReferences: 0,
      harshTestPartnerReferenceCount,
      organizationNormalized: false,
      report,
      errors,
    };
  }

  if (deleteIds.length === 0) {
    return {
      dryRun,
      retainedCount: 3,
      deletedCount: 0,
      nulledPartnerReferences: 0,
      nulledAdminUserReferences: 0,
      harshTestPartnerReferenceCount,
      organizationNormalized: false,
      report,
      errors,
    };
  }

  if (dryRun) {
    const nulledPartnerReferences = report.proposedForDeletion.reduce(
      (sum, row) => sum + row.partnerReferenceCount,
      0
    );
    const nulledAdminUserReferences = report.proposedForDeletion.reduce(
      (sum, row) => sum + row.adminUserReferenceCount,
      0
    );
    return {
      dryRun: true,
      retainedCount: 3,
      deletedCount: deleteIds.length,
      nulledPartnerReferences,
      nulledAdminUserReferences,
      harshTestPartnerReferenceCount,
      organizationNormalized: Boolean(organizationPlan),
      report,
      errors,
    };
  }

  const partnerRefsBefore = await db.partner.count({
    where: { relationshipSpocId: HARSH_TEST_SPOC_ID },
  });

  const result = await db.$transaction(async (tx) => {
    const partnerUpdate = await tx.partner.updateMany({
      where: { relationshipSpocId: { in: deleteIds } },
      data: { relationshipSpocId: null },
    });
    const adminUpdate = await tx.adminUser.updateMany({
      where: { relationshipSpocId: { in: deleteIds } },
      data: { relationshipSpocId: null },
    });
    let organizationNormalized = false;
    if (organizationPlan) {
      await tx.spoc.update({
        where: { id: HARSH_TEST_SPOC_ID },
        data: { organization: HARSH_TEST_ORGANIZATION_CANONICAL },
      });
      organizationNormalized = true;
    }
    const deleted = await tx.spoc.deleteMany({
      where: { id: { in: deleteIds } },
    });
    const remaining = await tx.spoc.count();
    const partnerRefsAfter = await tx.partner.count({
      where: { relationshipSpocId: HARSH_TEST_SPOC_ID },
    });
    return {
      nulledPartnerReferences: partnerUpdate.count,
      nulledAdminUserReferences: adminUpdate.count,
      deletedCount: deleted.count,
      retainedCount: remaining,
      partnerRefsAfter,
      organizationNormalized,
    };
  });

  if (result.retainedCount !== 3) {
    errors.push(
      `Expected exactly 3 SPOCs after cleanup, found ${result.retainedCount}`
    );
  }
  const remainingIds = (
    await db.spoc.findMany({ select: { id: true }, orderBy: { id: "asc" } })
  ).map((row) => row.id);
  for (const id of RETAINED_SPOC_IDS) {
    if (!remainingIds.includes(id)) {
      errors.push(`Retained SPOC id missing after cleanup: ${id}`);
    }
  }
  if (result.partnerRefsAfter !== partnerRefsBefore) {
    errors.push(
      `harsh test partner references changed (${partnerRefsBefore} → ${result.partnerRefsAfter})`
    );
  }

  return {
    dryRun: false,
    retainedCount: result.retainedCount,
    deletedCount: result.deletedCount,
    nulledPartnerReferences: result.nulledPartnerReferences,
    nulledAdminUserReferences: result.nulledAdminUserReferences,
    harshTestPartnerReferenceCount: result.partnerRefsAfter,
    organizationNormalized: result.organizationNormalized,
    report: await buildSpocCleanupDiagnosticReport(db),
    errors,
  };
}

export type SpocRetentionCleanupClient = PrismaClient;
