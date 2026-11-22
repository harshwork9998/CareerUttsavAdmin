import { prisma } from "@/lib/server/prisma";
import type { NormalizedWhatsAppStatus } from "@/lib/server/whatsapp/meta-webhook";
import { isDryRunMetaMessageId } from "@/lib/server/whatsapp/campaign-dry-run";

const PROGRESS_RANK: Record<string, number> = {
  ACCEPTED: 1,
  SENT: 2,
  DELIVERED: 3,
  READ: 4,
};

function mapWebhookStatus(status: string): string | null {
  const normalized = status.toLowerCase();
  if (normalized === "sent") return "SENT";
  if (normalized === "delivered") return "DELIVERED";
  if (normalized === "read") return "READ";
  if (normalized === "failed") return "FAILED";
  return null;
}

export function shouldApplyDeliveryProgress(input: {
  currentStatus: string;
  nextStatus: string;
}): boolean {
  if (input.currentStatus === "SIMULATED") {
    return false;
  }

  if (input.nextStatus === "FAILED") {
    return (
      input.currentStatus !== "READ" &&
      input.currentStatus !== "DELIVERED"
    );
  }

  const upgradableFromUnknown = new Set(["SENT", "DELIVERED", "READ"]);
  if (
    input.currentStatus === "UNKNOWN" &&
    upgradableFromUnknown.has(input.nextStatus)
  ) {
    return true;
  }

  const current = PROGRESS_RANK[input.currentStatus] ?? 0;
  const next = PROGRESS_RANK[input.nextStatus] ?? 0;
  return next > current;
}

export async function applyCampaignDeliveryStatus(
  status: NormalizedWhatsAppStatus
): Promise<boolean> {
  if (!status.messageId || isDryRunMetaMessageId(status.messageId)) {
    return false;
  }

  const recipient = await prisma.whatsAppCampaignRecipient.findUnique({
    where: { metaMessageId: status.messageId },
    select: { id: true, status: true },
  });
  if (!recipient) return false;

  const mapped = mapWebhookStatus(status.status);
  if (!mapped) return false;

  if (
    !shouldApplyDeliveryProgress({
      currentStatus: recipient.status,
      nextStatus: mapped,
    })
  ) {
    return true;
  }

  const now = new Date();
  const data: Record<string, unknown> = { status: mapped, updatedAt: now };

  if (mapped === "SENT") data.sentAt = now;
  if (mapped === "DELIVERED") data.deliveredAt = now;
  if (mapped === "READ") data.readAt = now;
  if (mapped === "FAILED") {
    data.failedAt = now;
    const detail =
      status.deliveryErrors?.[0]?.deliveryErrorMessage ??
      status.deliveryErrors?.[0]?.deliveryErrorTitle;
    data.lastError = detail ?? "delivery_failed";
  }

  await prisma.whatsAppCampaignRecipient.update({
    where: { id: recipient.id },
    data,
  });

  return true;
}