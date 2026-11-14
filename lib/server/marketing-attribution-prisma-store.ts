import type {
  LeadSource,
  LeadSubSource,
  MarketingCampaign,
} from "@/lib/generated/prisma/client";
import { buildCampaignTrackingUrl } from "@/lib/marketing-attribution/tracking-url";
import type {
  LeadSourceRecord,
  LeadSubSourceRecord,
  MarketingAttributionTree,
  MarketingCampaignRecord,
} from "@/lib/marketing-attribution/types";
import { isPrismaUniqueConstraintError } from "@/lib/server/partner-prisma-map";
import { prisma } from "@/lib/server/prisma";

function mapSource(row: LeadSource): LeadSourceRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapSubSource(row: LeadSubSource): LeadSubSourceRecord {
  return {
    id: row.id,
    leadSourceId: row.leadSourceId,
    name: row.name,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapCampaign(
  row: MarketingCampaign,
  ancestorsActive: boolean
): MarketingCampaignRecord {
  const effectivelyActive = row.isActive && ancestorsActive;
  return {
    id: row.id,
    leadSubSourceId: row.leadSubSourceId,
    name: row.name,
    trackingCode: row.trackingCode,
    placementDescription: row.placementDescription,
    startDate: row.startDate?.toISOString() ?? null,
    endDate: row.endDate?.toISOString() ?? null,
    isActive: row.isActive,
    effectivelyActive,
    trackingUrl: buildCampaignTrackingUrl(row.trackingCode),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listMarketingAttributionTree(): Promise<MarketingAttributionTree> {
  const sources = await prisma.leadSource.findMany({
    orderBy: { name: "asc" },
    include: {
      subSources: {
        orderBy: { name: "asc" },
        include: {
          campaigns: { orderBy: { name: "asc" } },
        },
      },
    },
  });

  return {
    sources: sources.map((source) => ({
      ...mapSource(source),
      subSources: source.subSources.map((sub) => {
        const ancestorsActive = source.isActive && sub.isActive;
        return {
          ...mapSubSource(sub),
          campaigns: sub.campaigns.map((c) => mapCampaign(c, ancestorsActive)),
        };
      }),
    })),
  };
}

export async function getLeadSourceById(id: string): Promise<LeadSource | null> {
  return prisma.leadSource.findUnique({ where: { id } });
}

export async function getLeadSubSourceById(
  id: string
): Promise<(LeadSubSource & { leadSource: LeadSource }) | null> {
  return prisma.leadSubSource.findUnique({
    where: { id },
    include: { leadSource: true },
  });
}

export async function getMarketingCampaignById(id: string): Promise<
  | (MarketingCampaign & {
      leadSubSource: LeadSubSource & { leadSource: LeadSource };
    })
  | null
> {
  return prisma.marketingCampaign.findUnique({
    where: { id },
    include: {
      leadSubSource: { include: { leadSource: true } },
    },
  });
}

export async function countSubSourcesForLeadSource(leadSourceId: string) {
  return prisma.leadSubSource.count({ where: { leadSourceId } });
}

export async function countCampaignsForSubSource(leadSubSourceId: string) {
  return prisma.marketingCampaign.count({ where: { leadSubSourceId } });
}

export { isPrismaUniqueConstraintError };