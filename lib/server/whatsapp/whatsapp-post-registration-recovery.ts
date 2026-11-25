import { prisma } from "@/lib/server/prisma";
import { maskWaId } from "@/lib/server/whatsapp/meta-webhook";
import { loadWhatsAppConversationRecordByWaId } from "@/lib/server/whatsapp/whatsapp-conversation-store";
import { schedulePostRegistrationGrowthTriggers } from "@/lib/server/whatsapp/whatsapp-post-registration-schedule";

/** Only registrations with a stored entry-pass QR acceptance within this window may recover. */
export const POST_REGISTRATION_GROWTH_RECOVERY_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const RECOVERY_BATCH_SIZE = 50;

export type PostRegistrationGrowthRecoveryResult = {
  examined: number;
  recovered: number;
  failed: number;
  skipped: number;
  skippedWithoutQrEvidence: number;
};

export async function recoverMissingPostRegistrationGrowthSchedules(
  now = new Date()
): Promise<PostRegistrationGrowthRecoveryResult> {
  const since = new Date(now.getTime() - POST_REGISTRATION_GROWTH_RECOVERY_LOOKBACK_MS);
  const conversations = await prisma.whatsAppRegistrationConversation.findMany({
    where: {
      status: "COMPLETED",
      currentStep: "COMPLETED",
      completedRegistrationId: { not: null },
      postRegistrationEntryPassDeliveredAt: { not: null, gte: since },
    },
    orderBy: { postRegistrationEntryPassDeliveredAt: "desc" },
    take: RECOVERY_BATCH_SIZE,
    select: {
      waId: true,
      completedRegistrationId: true,
      postRegistrationEntryPassDeliveredAt: true,
    },
  });

  const result: PostRegistrationGrowthRecoveryResult = {
    examined: conversations.length,
    recovered: 0,
    failed: 0,
    skipped: 0,
    skippedWithoutQrEvidence: 0,
  };

  for (const row of conversations) {
    const registrationId = row.completedRegistrationId;
    const entryPassDeliveredAt = row.postRegistrationEntryPassDeliveredAt;
    if (!registrationId || !entryPassDeliveredAt) {
      result.skippedWithoutQrEvidence += 1;
      continue;
    }

    const existing = await prisma.whatsAppPostRegistrationTrigger.count({
      where: { registrationId },
    });
    if (existing > 0) {
      result.skipped += 1;
      continue;
    }

    const conversation = await loadWhatsAppConversationRecordByWaId(row.waId);
    try {
      const scheduled = await schedulePostRegistrationGrowthTriggers({
        waId: row.waId,
        registrationId,
        completedAt: entryPassDeliveredAt,
        conversation,
      });
      if (scheduled.scheduled) {
        result.recovered += 1;
        console.info("[whatsapp-growth] schedule recovered", {
          registrationId,
          sender: maskWaId(row.waId),
          entryPassDeliveredAt: entryPassDeliveredAt.toISOString(),
        });
      } else {
        result.skipped += 1;
      }
    } catch (error) {
      result.failed += 1;
      console.error("[whatsapp-growth] schedule recovery failed", {
        registrationId,
        sender: maskWaId(row.waId),
        entryPassDeliveredAt: entryPassDeliveredAt.toISOString(),
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  if (result.recovered > 0 || result.failed > 0) {
    console.info("[whatsapp-growth] recovery pass", result);
  }

  return result;
}