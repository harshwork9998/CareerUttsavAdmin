import type { Partner } from "@/types";

import {
  buildPartnerImportPlan,
  type JsonSpocSource,
  type PartnerImportPlan,
} from "@/lib/server/partner-prisma-import-map";
import type { PrismaPartnerRecord, PrismaSpocRecord } from "@/lib/server/partner-prisma-map";
import {
  compareExistingPartner,
  compareExistingSpoc,
  countAuthMismatches,
  countRelationalMismatches,
  partnerRowIsExactMatch,
  type PartnerReconciliationConflict,
  type PartnerReconciliationRow,
  type SpocReconciliationRow,
} from "@/lib/server/partner-reconciliation";

export type PartnerReconciliationPlan = {
  conflicts: PartnerReconciliationConflict[];
  spocRows: SpocReconciliationRow[];
  partnerRows: PartnerReconciliationRow[];
  spocsNeedingUpdate: string[];
  partnersNeedingUpdate: string[];
  importPlan: PartnerImportPlan;
};

export type BuildPartnerReconciliationPlanInput = {
  jsonSpocs: JsonSpocSource[];
  jsonPartners: Partner[];
  dbSpocsById: Map<string, PrismaSpocRecord>;
  dbPartnersById: Map<string, PrismaPartnerRecord>;
};

export function buildPartnerReconciliationPlan(
  input: BuildPartnerReconciliationPlanInput
): PartnerReconciliationPlan {
  const conflicts: PartnerReconciliationConflict[] = [];
  const jsonSpocIds = new Set(input.jsonSpocs.map((spoc) => spoc.id));
  const jsonPartnerIds = new Set(input.jsonPartners.map((partner) => partner.id));

  for (const dbSpocId of input.dbSpocsById.keys()) {
    if (!jsonSpocIds.has(dbSpocId)) {
      conflicts.push({
        code: "spoc_absent_from_final_json",
        entityId: dbSpocId,
        message: `Database SPOC ${dbSpocId} is absent from final production JSON`,
      });
    }
  }

  for (const jsonSpocId of jsonSpocIds) {
    if (!input.dbSpocsById.has(jsonSpocId)) {
      conflicts.push({
        code: "spoc_missing_from_database",
        entityId: jsonSpocId,
        message: `Final JSON SPOC ${jsonSpocId} is missing from database`,
      });
    }
  }

  for (const dbPartnerId of input.dbPartnersById.keys()) {
    if (!jsonPartnerIds.has(dbPartnerId)) {
      conflicts.push({
        code: "partner_absent_from_final_json",
        entityId: dbPartnerId,
        message: `Database partner ${dbPartnerId} is absent from final production JSON`,
      });
    }
  }

  for (const jsonPartnerId of jsonPartnerIds) {
    if (!input.dbPartnersById.has(jsonPartnerId)) {
      conflicts.push({
        code: "partner_missing_from_database",
        entityId: jsonPartnerId,
        message: `Final JSON partner ${jsonPartnerId} is missing from database`,
      });
    }
  }

  const spocRows: SpocReconciliationRow[] = [];
  const spocsNeedingUpdate: string[] = [];

  for (const jsonSpoc of input.jsonSpocs) {
    const dbRecord = input.dbSpocsById.get(jsonSpoc.id);
    if (!dbRecord) {
      continue;
    }

    const fieldMismatches = compareExistingSpoc(jsonSpoc, dbRecord);
    const exactMatch = fieldMismatches.length === 0;
    spocRows.push({
      id: jsonSpoc.id,
      exactMatch,
      fieldMismatches,
    });

    if (!exactMatch) {
      spocsNeedingUpdate.push(jsonSpoc.id);
    }
  }

  const partnerRows: PartnerReconciliationRow[] = [];
  const partnersNeedingUpdate: string[] = [];

  for (const jsonPartner of input.jsonPartners) {
    const dbRecord = input.dbPartnersById.get(jsonPartner.id);
    if (!dbRecord) {
      continue;
    }

    const comparison = compareExistingPartner(jsonPartner, dbRecord);
    const row: PartnerReconciliationRow = {
      id: jsonPartner.id,
      exactMatch: false,
      fieldMismatches: comparison.fieldMismatches,
      authMismatches: comparison.authMismatches,
      relationalMismatches: comparison.relationalMismatches,
    };
    row.exactMatch = partnerRowIsExactMatch(row);
    partnerRows.push(row);

    if (!row.exactMatch) {
      partnersNeedingUpdate.push(jsonPartner.id);
    }
  }

  const importPlan = buildPartnerImportPlan({
    spocs: input.jsonSpocs,
    partners: input.jsonPartners,
  });

  return {
    conflicts,
    spocRows,
    partnerRows,
    spocsNeedingUpdate,
    partnersNeedingUpdate,
    importPlan,
  };
}

export function summarizePartnerReconciliationPlan(
  plan: PartnerReconciliationPlan
): {
  exactSpocMatches: number;
  exactPartnerMatches: number;
  authMismatchCount: number;
  relationalMismatchCount: number;
} {
  return {
    exactSpocMatches: plan.spocRows.filter((row) => row.exactMatch).length,
    exactPartnerMatches: plan.partnerRows.filter((row) => row.exactMatch).length,
    authMismatchCount: countAuthMismatches(plan.partnerRows),
    relationalMismatchCount: countRelationalMismatches(plan.partnerRows),
  };
}
