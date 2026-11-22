import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/server/prisma";
import {
  WHATSAPP_CAMPAIGN_CLAIM_LEASE_MS,
  WHATSAPP_CAMPAIGN_UNKNOWN_AFTER_MS,
} from "@/lib/server/whatsapp/campaign-config";
import type { ParsedContactRow } from "@/lib/server/whatsapp/campaign-import";
import {
  isSafeToReturnRecipientToPending,
  recipientMayHaveBeenSubmitted,
} from "@/lib/server/whatsapp/campaign-send-safety";

export async function createCampaignDraft(input: {
  name: string;
  createdByAdminId: string;
  sendDelayMs?: number;
  batchSize?: number;
}) {
  return prisma.whatsAppCampaign.create({
    data: {
      name: input.name,
      createdByAdminId: input.createdByAdminId,
      sendDelayMs: input.sendDelayMs,
      batchSize: input.batchSize,
    },
  });
}

export async function updateCampaignDraft(
  campaignId: string,
  data: Prisma.WhatsAppCampaignUpdateInput
) {
  return prisma.whatsAppCampaign.update({
    where: { id: campaignId },
    data,
  });
}

export async function replaceCampaignRecipients(
  campaignId: string,
  accepted: ParsedContactRow[],
  skippedReasonByRow: Array<{ rowNumber: number; status: "INVALID" | "DUPLICATE" | "OPTED_OUT" | "SKIPPED"; reason: string; waId?: string; phoneLast10?: string }>
) {
  await prisma.$transaction(async (tx) => {
    await tx.whatsAppCampaignRecipient.deleteMany({ where: { campaignId } });
    if (skippedReasonByRow.length > 0) {
      await tx.whatsAppCampaignRecipient.createMany({
        data: skippedReasonByRow.map((row) => ({
          campaignId,
          waId: row.waId ?? `skipped-${campaignId}-${row.rowNumber}`,
          phoneLast10: row.phoneLast10 ?? "0000000000",
          rowNumber: row.rowNumber,
          status: row.status,
          skipReason: row.reason,
        })),
      });
    }
    if (accepted.length > 0) {
      await tx.whatsAppCampaignRecipient.createMany({
        data: accepted.map((row) => ({
          campaignId,
          waId: row.waId,
          phoneLast10: row.phoneLast10,
          rowNumber: row.rowNumber,
          rowData: row.rowData,
          status: "PENDING",
        })),
      });
    }
  });
}

export async function claimCampaignRecipients(input: {
  campaignId: string;
  limit: number;
  now: Date;
}): Promise<string[]> {
  const campaign = await prisma.whatsAppCampaign.findUnique({
    where: { id: input.campaignId },
    select: { status: true },
  });
  if (campaign?.status !== "RUNNING") {
    return [];
  }

  const leaseBefore = new Date(
    input.now.getTime() - WHATSAPP_CAMPAIGN_CLAIM_LEASE_MS
  );

  await prisma.whatsAppCampaignRecipient.updateMany({
    where: {
      campaignId: input.campaignId,
      status: "CLAIMED",
      claimedAt: { lt: leaseBefore },
    },
    data: {
      status: "NEEDS_REVIEW",
      claimedAt: null,
      lastError: "claim_lease_expired",
    },
  });

  const pending = await prisma.whatsAppCampaignRecipient.findMany({
    where: {
      campaignId: input.campaignId,
      status: "PENDING",
    },
    orderBy: { rowNumber: "asc" },
    take: input.limit,
    select: { id: true },
  });

  const claimedIds: string[] = [];
  for (const row of pending) {
    const claimed = await prisma.whatsAppCampaignRecipient.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: {
        status: "CLAIMED",
        claimedAt: input.now,
        attemptCount: { increment: 1 },
      },
    });
    if (claimed.count === 1) {
      claimedIds.push(row.id);
    }
  }

  return claimedIds;
}

export async function markRecipientSubmissionStarted(
  recipientId: string,
  at: Date
): Promise<boolean> {
  const updated = await prisma.whatsAppCampaignRecipient.updateMany({
    where: {
      id: recipientId,
      status: "CLAIMED",
      submissionStartedAt: null,
      campaign: { status: "RUNNING" },
    },
    data: { submissionStartedAt: at },
  });
  return updated.count === 1;
}

/**
 * Must pass immediately before a Meta API call (or dry-run completion).
 * Ensures pause/cancel flipped campaign or recipient state while worker was preparing.
 */
export async function isRecipientAuthorizedForOutbound(
  recipientId: string
): Promise<boolean> {
  const row = await prisma.whatsAppCampaignRecipient.findFirst({
    where: {
      id: recipientId,
      status: "CLAIMED",
      submissionStartedAt: { not: null },
      campaign: { status: "RUNNING" },
    },
    select: { id: true },
  });
  return Boolean(row);
}

export async function markRecipientSimulated(recipientId: string, at: Date) {
  await prisma.whatsAppCampaignRecipient.updateMany({
    where: {
      id: recipientId,
      status: "CLAIMED",
      campaign: { status: "RUNNING" },
    },
    data: {
      status: "SIMULATED",
      metaMessageId: null,
      acceptedAt: null,
      claimedAt: null,
      lastError: null,
      skipReason: "dry_run_simulated",
    },
  });
}

export async function markRecipientAccepted(
  recipientId: string,
  messageId: string,
  at: Date
) {
  await prisma.whatsAppCampaignRecipient.updateMany({
    where: { id: recipientId, status: "CLAIMED" },
    data: {
      status: "ACCEPTED",
      metaMessageId: messageId,
      acceptedAt: at,
      claimedAt: null,
      lastError: null,
    },
  });
}

export async function markRecipientFailed(
  recipientId: string,
  errorCode: string
) {
  await prisma.whatsAppCampaignRecipient.updateMany({
    where: {
      id: recipientId,
      status: "CLAIMED",
    },
    data: {
      status: "FAILED",
      claimedAt: null,
      lastError: errorCode,
    },
  });
}

export async function markRecipientNeedsReview(
  recipientId: string,
  errorCode: string
) {
  await prisma.whatsAppCampaignRecipient.updateMany({
    where: {
      id: recipientId,
      status: "CLAIMED",
    },
    data: {
      status: "NEEDS_REVIEW",
      claimedAt: null,
      lastError: errorCode,
    },
  });
}

export async function returnRecipientWhenSafe(
  recipientId: string,
  reason: string
): Promise<void> {
  const recipient = await prisma.whatsAppCampaignRecipient.findUnique({
    where: { id: recipientId },
    select: { submissionStartedAt: true, status: true },
  });
  if (!recipient || recipient.status !== "CLAIMED") return;

  const submissionStarted = recipientMayHaveBeenSubmitted(
    recipient.submissionStartedAt
  );
  if (isSafeToReturnRecipientToPending({ submissionStarted, reason })) {
    await prisma.whatsAppCampaignRecipient.updateMany({
      where: { id: recipientId, status: "CLAIMED", submissionStartedAt: null },
      data: {
        status: "PENDING",
        claimedAt: null,
        lastError: reason,
      },
    });
    return;
  }

  if (submissionStarted) {
    await markRecipientNeedsReview(recipientId, reason);
  }
}

export async function markUnknownDeliveryStatuses(now = new Date()) {
  const cutoff = new Date(now.getTime() - WHATSAPP_CAMPAIGN_UNKNOWN_AFTER_MS);
  await prisma.whatsAppCampaignRecipient.updateMany({
    where: {
      status: "ACCEPTED",
      acceptedAt: { lt: cutoff },
    },
    data: {
      status: "UNKNOWN",
      lastError: "delivery_status_unknown",
    },
  });
}

export async function tryCompleteCampaign(campaignId: string) {
  const remaining = await prisma.whatsAppCampaignRecipient.count({
    where: {
      campaignId,
      status: { in: ["PENDING", "CLAIMED"] },
    },
  });
  if (remaining > 0) return;

  await prisma.whatsAppCampaign.updateMany({
    where: {
      id: campaignId,
      status: "RUNNING",
    },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });
}

export async function setCampaignStatus(
  campaignId: string,
  status: "RUNNING" | "PAUSED" | "CANCELLED" | "COMPLETED"
) {
  const data: Prisma.WhatsAppCampaignUpdateInput = { status };
  if (status === "RUNNING") data.startedAt = new Date();
  if (status === "PAUSED") data.pausedAt = new Date();
  if (status === "COMPLETED") data.completedAt = new Date();
  const updated = await prisma.whatsAppCampaign.update({
    where: { id: campaignId },
    data,
  });

  if (status === "PAUSED" || status === "CANCELLED") {
    const inFlight = await prisma.whatsAppCampaignRecipient.findMany({
      where: {
        campaignId,
        status: "CLAIMED",
      },
      select: { id: true, submissionStartedAt: true },
    });
    for (const row of inFlight) {
      if (recipientMayHaveBeenSubmitted(row.submissionStartedAt)) {
        await markRecipientNeedsReview(row.id, `campaign_${status.toLowerCase()}`);
      } else {
        await prisma.whatsAppCampaignRecipient.updateMany({
          where: { id: row.id, status: "CLAIMED", submissionStartedAt: null },
          data: {
            status: "PENDING",
            claimedAt: null,
            lastError: `campaign_${status.toLowerCase()}`,
          },
        });
      }
    }
  }

  return updated;
}