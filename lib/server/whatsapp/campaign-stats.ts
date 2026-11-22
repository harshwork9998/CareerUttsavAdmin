import { prisma } from "@/lib/server/prisma";

export type CampaignRecipientCounts = {
  total: number;
  eligible: number;
  skipped: number;
  pending: number;
  claimed: number;
  needsReview: number;
  accepted: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  unknown: number;
  simulated: number;
  invalid: number;
  duplicate: number;
  optedOut: number;
  /** Delivered or better (includes Read). */
  deliveredOrRead: number;
  /** Accepted by Meta API (not the same as handset delivery). */
  acceptedByMeta: number;
};

export async function countCampaignRecipients(
  campaignId: string
): Promise<CampaignRecipientCounts> {
  const groups = await prisma.whatsAppCampaignRecipient.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: { _all: true },
  });

  const counts: CampaignRecipientCounts = {
    total: 0,
    eligible: 0,
    skipped: 0,
    pending: 0,
    claimed: 0,
    needsReview: 0,
    accepted: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    unknown: 0,
    simulated: 0,
    invalid: 0,
    duplicate: 0,
    optedOut: 0,
    deliveredOrRead: 0,
    acceptedByMeta: 0,
  };

  for (const row of groups) {
    const n = row._count._all;
    counts.total += n;
    switch (row.status) {
      case "PENDING":
        counts.pending = n;
        counts.eligible += n;
        break;
      case "CLAIMED":
        counts.claimed = n;
        break;
      case "NEEDS_REVIEW":
        counts.needsReview = n;
        break;
      case "ACCEPTED":
        counts.accepted = n;
        break;
      case "SENT":
        counts.sent = n;
        break;
      case "DELIVERED":
        counts.delivered = n;
        break;
      case "READ":
        counts.read = n;
        break;
      case "FAILED":
        counts.failed = n;
        break;
      case "UNKNOWN":
        counts.unknown = n;
        break;
      case "SIMULATED":
        counts.simulated = n;
        break;
      case "INVALID":
        counts.invalid = n;
        counts.skipped += n;
        break;
      case "DUPLICATE":
        counts.duplicate = n;
        counts.skipped += n;
        break;
      case "OPTED_OUT":
        counts.optedOut = n;
        counts.skipped += n;
        break;
      case "SKIPPED":
        counts.skipped += n;
        break;
      default:
        break;
    }
  }

  counts.acceptedByMeta =
    counts.accepted + counts.sent + counts.delivered + counts.read;
  // Simulated dry-run rows are excluded from Meta acceptance and delivery metrics.
  counts.deliveredOrRead = counts.delivered + counts.read;
  counts.eligible +=
    counts.acceptedByMeta +
    counts.claimed +
    counts.needsReview +
    counts.failed +
    counts.unknown;

  return counts;
}