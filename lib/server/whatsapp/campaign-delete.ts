import { isDryRunMetaMessageId } from "@/lib/server/whatsapp/campaign-dry-run";
import { prisma } from "@/lib/server/prisma";

const OUTBOUND_EVIDENCE_STATUSES = new Set([
  "NEEDS_REVIEW",
  "ACCEPTED",
  "SENT",
  "DELIVERED",
  "READ",
  "FAILED",
  "UNKNOWN",
]);

export async function campaignHasOutboundSendingEvidence(
  campaignId: string
): Promise<boolean> {
  const recipients = await prisma.whatsAppCampaignRecipient.findMany({
    where: { campaignId },
    select: { status: true, metaMessageId: true },
  });

  for (const recipient of recipients) {
    if (OUTBOUND_EVIDENCE_STATUSES.has(recipient.status)) {
      return true;
    }
    if (
      recipient.metaMessageId &&
      !isDryRunMetaMessageId(recipient.metaMessageId)
    ) {
      return true;
    }
  }

  return false;
}

export type DeleteCampaignResult =
  | { outcome: "hard_deleted" }
  | { outcome: "soft_deleted" }
  | { outcome: "already_deleted" };

export async function deleteCampaign(input: {
  campaignId: string;
  adminUserId: string;
}): Promise<DeleteCampaignResult> {
  const campaign = await prisma.whatsAppCampaign.findUnique({
    where: { id: input.campaignId },
    select: {
      id: true,
      status: true,
      deletedAt: true,
    },
  });

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  if (campaign.deletedAt) {
    return { outcome: "already_deleted" };
  }

  if (campaign.status === "RUNNING") {
    throw new Error(
      "This campaign is still sending. Pause it, then cancel it, before deleting."
    );
  }

  if (campaign.status === "PAUSED") {
    throw new Error(
      "Cancel this campaign before deleting it so no messages are left in progress."
    );
  }

  const hasEvidence = await campaignHasOutboundSendingEvidence(input.campaignId);
  const hardDeleteEligible =
    campaign.status === "DRAFT" &&
    !hasEvidence;

  if (hardDeleteEligible) {
    await prisma.whatsAppCampaign.delete({
      where: { id: input.campaignId },
    });
    return { outcome: "hard_deleted" };
  }

  await prisma.whatsAppCampaign.update({
    where: { id: input.campaignId },
    data: {
      deletedAt: new Date(),
      deletedByAdminId: input.adminUserId,
      status:
        campaign.status === "DRAFT" ? "CANCELLED" : campaign.status,
    },
  });

  return { outcome: "soft_deleted" };
}