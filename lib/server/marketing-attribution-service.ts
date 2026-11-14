import {
  campaignTrackingCodeKey,
  normalizeCampaignTrackingCodeInput,
  suggestCampaignTrackingCode,
  validateCampaignTrackingCode,
} from "@/lib/marketing-attribution/campaign-code";
import { marketingEntityNameKey } from "@/lib/marketing-attribution/entity-name";
import { buildCampaignTrackingUrl } from "@/lib/marketing-attribution/tracking-url";
import type {
  LeadSourceRecord,
  LeadSubSourceRecord,
  MarketingAttributionTree,
  MarketingCampaignRecord,
} from "@/lib/marketing-attribution/types";
import {
  parseOptionalISODate,
  validateCampaignDateRange,
  validateEntityName,
} from "@/lib/marketing-attribution/validation";
import { recordMarketingAttributionAudit } from "@/lib/server/marketing-attribution-audit";
import { marketingAttributionWriteConflictResult } from "@/lib/server/marketing-attribution-errors";
import {
  countCampaignsForSubSource,
  countSubSourcesForLeadSource,
  getLeadSourceById,
  getLeadSubSourceById,
  getMarketingCampaignById,
  listMarketingAttributionTree,
} from "@/lib/server/marketing-attribution-prisma-store";
import { prisma } from "@/lib/server/prisma";
import { generateId } from "@/lib/utils";

export type MarketingWriteResult<T> =
  | { ok: true; data: T; status?: number }
  | { ok: false; status: number; error: string };

function mapLeadSource(row: {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): LeadSourceRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapLeadSubSource(row: {
  id: string;
  leadSourceId: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): LeadSubSourceRecord {
  return {
    id: row.id,
    leadSourceId: row.leadSourceId,
    name: row.name,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function leadSourceAuditAction(
  previousIsActive: boolean,
  nextIsActive: boolean
): "CREATE" | "UPDATE" | "ACTIVATE" | "DEACTIVATE" {
  if (nextIsActive && !previousIsActive) return "ACTIVATE";
  if (!nextIsActive && previousIsActive) return "DEACTIVATE";
  return "UPDATE";
}

export async function getMarketingAttributionTreeForApi(): Promise<MarketingAttributionTree> {
  return listMarketingAttributionTree();
}

export async function createLeadSourceForApi(
  body: { name?: unknown; description?: unknown },
  adminUserId: string
): Promise<MarketingWriteResult<LeadSourceRecord>> {
  const nameError = validateEntityName(body.name, "Lead source");
  if (nameError) return { ok: false, status: 400, error: nameError };

  const trimmedName = (body.name as string).trim();
  const description =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim()
      : null;

  const id = generateId();
  const now = new Date();
  try {
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.leadSource.create({
        data: {
          id,
          name: trimmedName,
          nameKey: marketingEntityNameKey(trimmedName),
          description,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      });
      await recordMarketingAttributionAudit(
        {
          adminUserId,
          action: "CREATE",
          entityType: "LEAD_SOURCE",
          entityId: created.id,
          summary: `Created lead source “${created.name}”`,
          metadata: {
            after: {
              name: created.name,
              isActive: created.isActive,
              description: created.description,
            },
          },
        },
        tx
      );
      return created;
    });

    return { ok: true, data: mapLeadSource(row), status: 201 };
  } catch (error) {
    const conflict = marketingAttributionWriteConflictResult(error, "lead_source");
    if (conflict) return conflict;
    throw error;
  }
}

export async function updateLeadSourceForApi(
  id: string,
  body: { name?: unknown; description?: unknown; isActive?: unknown },
  adminUserId: string
): Promise<MarketingWriteResult<LeadSourceRecord>> {
  const current = await getLeadSourceById(id);
  if (!current) return { ok: false, status: 404, error: "Lead source not found" };

  const name =
    body.name !== undefined
      ? typeof body.name === "string"
        ? body.name
        : ""
      : current.name;
  const nameError = validateEntityName(name, "Lead source");
  if (nameError) return { ok: false, status: 400, error: nameError };

  const trimmedName = name.trim();
  const description =
    body.description !== undefined
      ? typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null
      : current.description;

  let isActive = current.isActive;
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") {
      return { ok: false, status: 400, error: "isActive must be a boolean" };
    }
    isActive = body.isActive;
  }

  try {
    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.leadSource.update({
        where: { id },
        data: {
          name: trimmedName,
          nameKey: marketingEntityNameKey(trimmedName),
          description,
          isActive,
          updatedAt: new Date(),
        },
      });

      const action = leadSourceAuditAction(current.isActive, updated.isActive);
      await recordMarketingAttributionAudit(
        {
          adminUserId,
          action,
          entityType: "LEAD_SOURCE",
          entityId: updated.id,
          summary: `Updated lead source “${updated.name}”`,
          metadata: {
            before: {
              name: current.name,
              isActive: current.isActive,
              description: current.description,
            },
            after: {
              name: updated.name,
              isActive: updated.isActive,
              description: updated.description,
            },
          },
        },
        tx
      );
      return updated;
    });

    return { ok: true, data: mapLeadSource(row) };
  } catch (error) {
    const conflict = marketingAttributionWriteConflictResult(error, "lead_source");
    if (conflict) return conflict;
    throw error;
  }
}

export async function createLeadSubSourceForApi(
  body: { leadSourceId?: unknown; name?: unknown },
  adminUserId: string
): Promise<MarketingWriteResult<LeadSubSourceRecord>> {
  if (typeof body.leadSourceId !== "string" || !body.leadSourceId.trim()) {
    return { ok: false, status: 400, error: "leadSourceId is required" };
  }
  const parent = await getLeadSourceById(body.leadSourceId.trim());
  if (!parent) return { ok: false, status: 404, error: "Parent lead source not found" };
  if (!parent.isActive) {
    return {
      ok: false,
      status: 400,
      error: "Cannot add sub-sources under an inactive lead source",
    };
  }

  const nameError = validateEntityName(body.name, "Lead sub-source");
  if (nameError) return { ok: false, status: 400, error: nameError };

  const trimmedName = (body.name as string).trim();
  const id = generateId();
  const now = new Date();

  try {
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.leadSubSource.create({
        data: {
          id,
          leadSourceId: parent.id,
          name: trimmedName,
          nameKey: marketingEntityNameKey(trimmedName),
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      });
      await recordMarketingAttributionAudit(
        {
          adminUserId,
          action: "CREATE",
          entityType: "LEAD_SUB_SOURCE",
          entityId: created.id,
          summary: `Created sub-source “${created.name}” under “${parent.name}”`,
          metadata: {
            leadSourceId: parent.id,
            after: { name: created.name, isActive: created.isActive },
          },
        },
        tx
      );
      return created;
    });

    return { ok: true, data: mapLeadSubSource(row), status: 201 };
  } catch (error) {
    const conflict = marketingAttributionWriteConflictResult(error, "lead_sub_source");
    if (conflict) return conflict;
    throw error;
  }
}

export async function updateLeadSubSourceForApi(
  id: string,
  body: {
    name?: unknown;
    isActive?: unknown;
    leadSourceId?: unknown;
  },
  adminUserId: string
): Promise<MarketingWriteResult<LeadSubSourceRecord>> {
  if (body.leadSourceId !== undefined) {
    return {
      ok: false,
      status: 400,
      error: "Parent lead source cannot be changed after creation",
    };
  }

  const current = await getLeadSubSourceById(id);
  if (!current) return { ok: false, status: 404, error: "Lead sub-source not found" };

  const name =
    body.name !== undefined
      ? typeof body.name === "string"
        ? body.name
        : ""
      : current.name;
  const nameError = validateEntityName(name, "Lead sub-source");
  if (nameError) return { ok: false, status: 400, error: nameError };

  const trimmedName = name.trim();

  let isActive = current.isActive;
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") {
      return { ok: false, status: 400, error: "isActive must be a boolean" };
    }
    isActive = body.isActive;
  }

  try {
    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.leadSubSource.update({
        where: { id },
        data: {
          name: trimmedName,
          nameKey: marketingEntityNameKey(trimmedName),
          isActive,
          updatedAt: new Date(),
        },
      });

      const action = leadSourceAuditAction(current.isActive, updated.isActive);
      await recordMarketingAttributionAudit(
        {
          adminUserId,
          action,
          entityType: "LEAD_SUB_SOURCE",
          entityId: updated.id,
          summary: `Updated sub-source “${updated.name}”`,
          metadata: {
            leadSourceId: current.leadSourceId,
            before: { name: current.name, isActive: current.isActive },
            after: { name: updated.name, isActive: updated.isActive },
          },
        },
        tx
      );
      return updated;
    });

    return { ok: true, data: mapLeadSubSource(row) };
  } catch (error) {
    const conflict = marketingAttributionWriteConflictResult(error, "lead_sub_source");
    if (conflict) return conflict;
    throw error;
  }
}

function resolveTrackingCodeInput(body: {
  trackingCode?: unknown;
  name?: unknown;
  suggestCode?: unknown;
}): { ok: true; code: string } | { ok: false; error: string } {
  if (body.suggestCode === true && typeof body.name === "string") {
    return { ok: true, code: suggestCampaignTrackingCode(body.name) };
  }
  if (typeof body.trackingCode !== "string" || !body.trackingCode.trim()) {
    return { ok: false, error: "trackingCode is required" };
  }
  const normalized = normalizeCampaignTrackingCodeInput(body.trackingCode);
  const validation = validateCampaignTrackingCode(normalized);
  if (validation) return { ok: false, error: validation };
  return { ok: true, code: normalized };
}

export async function createMarketingCampaignForApi(
  body: {
    leadSubSourceId?: unknown;
    name?: unknown;
    trackingCode?: unknown;
    suggestCode?: unknown;
    placementDescription?: unknown;
    startDate?: unknown;
    endDate?: unknown;
  },
  adminUserId: string
): Promise<MarketingWriteResult<MarketingCampaignRecord>> {
  if (typeof body.leadSubSourceId !== "string" || !body.leadSubSourceId.trim()) {
    return { ok: false, status: 400, error: "leadSubSourceId is required" };
  }

  const parent = await getLeadSubSourceById(body.leadSubSourceId.trim());
  if (!parent) return { ok: false, status: 404, error: "Parent sub-source not found" };
  if (!parent.isActive || !parent.leadSource.isActive) {
    return {
      ok: false,
      status: 400,
      error: "Cannot create campaigns under an inactive source chain",
    };
  }

  const nameError = validateEntityName(body.name, "Campaign");
  if (nameError) return { ok: false, status: 400, error: nameError };

  const codeResult = resolveTrackingCodeInput({
    trackingCode:
      typeof body.trackingCode === "string" && body.trackingCode.trim()
        ? body.trackingCode
        : typeof body.name === "string"
          ? suggestCampaignTrackingCode(body.name)
          : body.trackingCode,
    name: body.name,
    suggestCode: body.suggestCode,
  });
  if (!codeResult.ok) return { ok: false, status: 400, error: codeResult.error };

  const startParsed = parseOptionalISODate(body.startDate);
  if (!startParsed.ok) return { ok: false, status: 400, error: startParsed.error };
  const endParsed = parseOptionalISODate(body.endDate);
  if (!endParsed.ok) return { ok: false, status: 400, error: endParsed.error };
  const rangeError = validateCampaignDateRange(startParsed.value, endParsed.value);
  if (rangeError) return { ok: false, status: 400, error: rangeError };

  const placementDescription =
    typeof body.placementDescription === "string" && body.placementDescription.trim()
      ? body.placementDescription.trim()
      : null;

  const id = generateId();
  const now = new Date();
  try {
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.marketingCampaign.create({
        data: {
          id,
          leadSubSourceId: parent.id,
          name: (body.name as string).trim(),
          trackingCode: codeResult.code,
          trackingCodeKey: campaignTrackingCodeKey(codeResult.code),
          placementDescription,
          startDate: startParsed.value,
          endDate: endParsed.value,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        include: {
          leadSubSource: { include: { leadSource: true } },
        },
      });

      await recordMarketingAttributionAudit(
        {
          adminUserId,
          action: "CREATE",
          entityType: "MARKETING_CAMPAIGN",
          entityId: created.id,
          summary: `Created campaign “${created.name}” (${created.trackingCode})`,
          metadata: {
            leadSubSourceId: parent.id,
            after: {
              name: created.name,
              trackingCode: created.trackingCode,
              isActive: created.isActive,
            },
          },
        },
        tx
      );
      return created;
    });

    const ancestorsActive =
      row.leadSubSource.isActive && row.leadSubSource.leadSource.isActive;

    return {
      ok: true,
      data: {
        id: row.id,
        leadSubSourceId: row.leadSubSourceId,
        name: row.name,
        trackingCode: row.trackingCode,
        placementDescription: row.placementDescription,
        startDate: row.startDate?.toISOString() ?? null,
        endDate: row.endDate?.toISOString() ?? null,
        isActive: row.isActive,
        effectivelyActive: ancestorsActive && row.isActive,
        trackingUrl: buildCampaignTrackingUrl(row.trackingCode),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
      status: 201,
    };
  } catch (error) {
    const conflict = marketingAttributionWriteConflictResult(error, "marketing_campaign");
    if (conflict) return conflict;
    throw error;
  }
}

export async function updateMarketingCampaignForApi(
  id: string,
  body: {
    name?: unknown;
    trackingCode?: unknown;
    leadSubSourceId?: unknown;
    placementDescription?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    isActive?: unknown;
  },
  adminUserId: string
): Promise<MarketingWriteResult<MarketingCampaignRecord>> {
  if (body.trackingCode !== undefined) {
    return {
      ok: false,
      status: 400,
      error: "Tracking code cannot be changed after the campaign is created",
    };
  }
  if (body.leadSubSourceId !== undefined) {
    return {
      ok: false,
      status: 400,
      error: "Parent sub-source cannot be changed after creation",
    };
  }

  const current = await getMarketingCampaignById(id);
  if (!current) return { ok: false, status: 404, error: "Campaign not found" };

  const name =
    body.name !== undefined
      ? typeof body.name === "string"
        ? body.name
        : ""
      : current.name;
  const nameError = validateEntityName(name, "Campaign");
  if (nameError) return { ok: false, status: 400, error: nameError };

  const startParsed = parseOptionalISODate(
    body.startDate !== undefined ? body.startDate : current.startDate?.toISOString()
  );
  if (!startParsed.ok) return { ok: false, status: 400, error: startParsed.error };
  const endParsed = parseOptionalISODate(
    body.endDate !== undefined ? body.endDate : current.endDate?.toISOString()
  );
  if (!endParsed.ok) return { ok: false, status: 400, error: endParsed.error };
  const rangeError = validateCampaignDateRange(startParsed.value, endParsed.value);
  if (rangeError) return { ok: false, status: 400, error: rangeError };

  const placementDescription =
    body.placementDescription !== undefined
      ? typeof body.placementDescription === "string" && body.placementDescription.trim()
        ? body.placementDescription.trim()
        : null
      : current.placementDescription;

  let isActive = current.isActive;
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") {
      return { ok: false, status: 400, error: "isActive must be a boolean" };
    }
    isActive = body.isActive;
    if (isActive && (!current.leadSubSource.isActive || !current.leadSubSource.leadSource.isActive)) {
      return {
        ok: false,
        status: 400,
        error: "Cannot activate a campaign while its source or sub-source is inactive",
      };
    }
  }

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.marketingCampaign.update({
      where: { id },
      data: {
        name: name.trim(),
        placementDescription,
        startDate: startParsed.value,
        endDate: endParsed.value,
        isActive,
        updatedAt: new Date(),
      },
      include: {
        leadSubSource: { include: { leadSource: true } },
      },
    });

    const action = leadSourceAuditAction(current.isActive, updated.isActive);
    await recordMarketingAttributionAudit(
      {
        adminUserId,
        action,
        entityType: "MARKETING_CAMPAIGN",
        entityId: updated.id,
        summary: `Updated campaign “${updated.name}”`,
        metadata: {
          trackingCode: updated.trackingCode,
          before: {
            name: current.name,
            isActive: current.isActive,
            placementDescription: current.placementDescription,
          },
          after: {
            name: updated.name,
            isActive: updated.isActive,
            placementDescription: updated.placementDescription,
          },
        },
      },
      tx
    );
    return updated;
  });

  const ancestorsActive =
    row.leadSubSource.isActive && row.leadSubSource.leadSource.isActive;

  return {
    ok: true,
    data: {
      id: row.id,
      leadSubSourceId: row.leadSubSourceId,
      name: row.name,
      trackingCode: row.trackingCode,
      placementDescription: row.placementDescription,
      startDate: row.startDate?.toISOString() ?? null,
      endDate: row.endDate?.toISOString() ?? null,
      isActive: row.isActive,
      effectivelyActive: ancestorsActive && row.isActive,
      trackingUrl: buildCampaignTrackingUrl(row.trackingCode),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
  };
}

export async function suggestCampaignCodeForApi(name: unknown): Promise<string> {
  if (typeof name !== "string" || !name.trim()) {
    return "CAMP26";
  }
  return suggestCampaignTrackingCode(name);
}

export async function dependencyCountsForLeadSource(id: string) {
  return countSubSourcesForLeadSource(id);
}

export async function dependencyCountsForSubSource(id: string) {
  return countCampaignsForSubSource(id);
}