import type { PrismaClient } from "@/lib/generated/prisma/client";

export const RETAINED_SPOC_PROFILES = [
  { name: "Neha Choudhary", organization: "K2 Learning" },
  { name: "Sripal Jain", organization: "K2 Learning" },
  { name: "harsh test", organization: "k2 learning" },
] as const;

export type SpocRetentionRow = {
  id: string;
  name: string;
  organization: string;
  partnerReferenceCount: number;
  adminUserReferenceCount: number;
};

export type SpocCleanupDiagnosticReport = {
  retained: SpocRetentionRow[];
  proposedForDeletion: SpocRetentionRow[];
  missingRetainedProfiles: readonly { name: string; organization: string }[];
  dependencyNotes: string[];
};

export function spocMatchesRetainedProfile(spoc: {
  name: string;
  organization: string;
}): boolean {
  const name = spoc.name.trim();
  const organization = spoc.organization.trim();
  return RETAINED_SPOC_PROFILES.some(
    (profile) => profile.name === name && profile.organization === organization
  );
}

export function resolveRetainedSpocIds(
  spocs: { id: string; name: string; organization: string }[]
): {
  retainedIds: string[];
  missingProfiles: { name: string; organization: string }[];
  duplicateRetainedMatches: string[];
} {
  const retainedIds: string[] = [];
  const missingProfiles: { name: string; organization: string }[] = [];
  const duplicateRetainedMatches: string[] = [];

  for (const profile of RETAINED_SPOC_PROFILES) {
    const matches = spocs.filter(
      (spoc) =>
        spoc.name.trim() === profile.name &&
        spoc.organization.trim() === profile.organization
    );
    if (matches.length === 0) {
      missingProfiles.push({ ...profile });
      continue;
    }
    if (matches.length > 1) {
      duplicateRetainedMatches.push(
        ...matches.map((row) => `${row.id}:${row.name}`)
      );
    }
    retainedIds.push(matches[0]!.id);
  }

  return { retainedIds, missingProfiles, duplicateRetainedMatches };
}

const SPOC_DEPENDENCY_NOTES = [
  "Partner.relationshipSpocId → Spoc (ON DELETE SET NULL)",
  "AdminUser.relationshipSpocId → Spoc (ON DELETE SET NULL)",
  "RelationshipOwnerFollowUpDigest.ownerSpocId → Spoc (ON DELETE CASCADE — digest send logs for removed SPOCs are removed with the SPOC; partner meeting follow-up history is stored on Partner JSON and is not deleted)",
  "PartnerCommunicationLog and other partner tables do not reference Spoc directly",
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

  const { retainedIds, missingProfiles } = resolveRetainedSpocIds(spocs);
  const retainedIdSet = new Set(retainedIds);

  const toRow = (spoc: (typeof spocs)[number]): SpocRetentionRow => ({
    id: spoc.id,
    name: spoc.name.trim(),
    organization: spoc.organization.trim(),
    partnerReferenceCount: partnerCountBySpoc.get(spoc.id) ?? 0,
    adminUserReferenceCount: adminCountBySpoc.get(spoc.id) ?? 0,
  });

  return {
    retained: spocs.filter((spoc) => retainedIdSet.has(spoc.id)).map(toRow),
    proposedForDeletion: spocs
      .filter((spoc) => !retainedIdSet.has(spoc.id))
      .map(toRow),
    missingRetainedProfiles: missingProfiles,
    dependencyNotes: [...SPOC_DEPENDENCY_NOTES],
  };
}

export type SpocRetentionCleanupResult = {
  dryRun: boolean;
  retainedCount: number;
  deletedCount: number;
  nulledPartnerReferences: number;
  nulledAdminUserReferences: number;
  report: SpocCleanupDiagnosticReport;
  errors: string[];
};

export async function executeSpocRetentionCleanup(
  db: PrismaClient,
  options?: { dryRun?: boolean }
): Promise<SpocRetentionCleanupResult> {
  const dryRun = options?.dryRun ?? false;
  const report = await buildSpocCleanupDiagnosticReport(db);
  const errors: string[] = [];

  if (report.missingRetainedProfiles.length > 0) {
    for (const profile of report.missingRetainedProfiles) {
      errors.push(
        `Retained SPOC not found: ${profile.name} — ${profile.organization}`
      );
    }
  }

  const spocs = await db.spoc.findMany({
    select: { id: true, name: true, organization: true },
  });
  const { retainedIds, duplicateRetainedMatches } = resolveRetainedSpocIds(spocs);
  if (duplicateRetainedMatches.length > 0) {
    errors.push(
      `Multiple SPOCs match a retained profile: ${duplicateRetainedMatches.join(", ")}`
    );
  }

  const deleteIds = spocs
    .map((row) => row.id)
    .filter((id) => !retainedIds.includes(id));

  if (errors.length > 0) {
    return {
      dryRun,
      retainedCount: retainedIds.length,
      deletedCount: 0,
      nulledPartnerReferences: 0,
      nulledAdminUserReferences: 0,
      report,
      errors,
    };
  }

  if (deleteIds.length === 0) {
    return {
      dryRun,
      retainedCount: retainedIds.length,
      deletedCount: 0,
      nulledPartnerReferences: 0,
      nulledAdminUserReferences: 0,
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
      retainedCount: retainedIds.length,
      deletedCount: deleteIds.length,
      nulledPartnerReferences,
      nulledAdminUserReferences,
      report,
      errors,
    };
  }

  const result = await db.$transaction(async (tx) => {
    const partnerUpdate = await tx.partner.updateMany({
      where: { relationshipSpocId: { in: deleteIds } },
      data: { relationshipSpocId: null },
    });
    const adminUpdate = await tx.adminUser.updateMany({
      where: { relationshipSpocId: { in: deleteIds } },
      data: { relationshipSpocId: null },
    });
    const deleted = await tx.spoc.deleteMany({
      where: { id: { in: deleteIds } },
    });
    const remaining = await tx.spoc.count();
    return {
      nulledPartnerReferences: partnerUpdate.count,
      nulledAdminUserReferences: adminUpdate.count,
      deletedCount: deleted.count,
      retainedCount: remaining,
    };
  });

  if (result.retainedCount !== 3) {
    errors.push(
      `Expected exactly 3 SPOCs after cleanup, found ${result.retainedCount}`
    );
  }

  return {
    dryRun: false,
    retainedCount: result.retainedCount,
    deletedCount: result.deletedCount,
    nulledPartnerReferences: result.nulledPartnerReferences,
    nulledAdminUserReferences: result.nulledAdminUserReferences,
    report: await buildSpocCleanupDiagnosticReport(db),
    errors,
  };
}

export type SpocRetentionCleanupClient = PrismaClient;
