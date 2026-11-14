import type {
  MarketingAttributionAuditAction,
  MarketingAttributionEntityType,
  Prisma,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/server/prisma";

export type MarketingAttributionAuditInput = {
  adminUserId: string;
  action: MarketingAttributionAuditAction;
  entityType: MarketingAttributionEntityType;
  entityId: string;
  summary: string;
  metadata?: Record<string, unknown>;
};

export async function recordMarketingAttributionAudit(
  input: MarketingAttributionAuditInput,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? prisma;
  await client.marketingAttributionAuditLog.create({
    data: {
      adminUserId: input.adminUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}