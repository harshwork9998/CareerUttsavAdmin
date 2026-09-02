import { dispatchWhatsAppBotActions } from "@/lib/server/whatsapp/whatsapp-bot-dispatcher";
import {
  determineReminderStageToSend,
  effectiveLastInboundAt,
  isEligibleForRegistrationReminder,
  isReminderRetryThrottled,
} from "@/lib/server/whatsapp/whatsapp-registration-reminder-eligibility";
import {
  buildWhatsAppRegistrationReminder2hActions,
  buildWhatsAppRegistrationReminder6hActions,
} from "@/lib/server/whatsapp/whatsapp-registration-reminder-messages";
import { isWhatsAppRegistrationRemindersEnabled } from "@/lib/server/whatsapp/whatsapp-registration-reminder-config";
import { sendWhatsAppRegistrationReminder24hTemplate } from "@/lib/server/whatsapp/whatsapp-registration-reminder-template-sender";
import {
  listWhatsAppRegistrationReminderCandidates,
  loadWhatsAppRegistrationReminderContext,
  recordWhatsAppRegistrationReminderFailure,
  recordWhatsAppRegistrationReminderSuccess,
  type WhatsAppRegistrationReminderCandidate,
} from "@/lib/server/whatsapp/whatsapp-conversation-store";
import { runSerializedForWaId } from "@/lib/server/whatsapp/whatsapp-wa-id-serializer";

export type WhatsAppRegistrationReminderProcessorResult = {
  checked: number;
  sent2h: number;
  sent6h: number;
  sent24h: number;
  skipped: number;
  failed: number;
};

type ReminderProcessOutcome =
  | "sent2h"
  | "sent6h"
  | "sent24h"
  | "skipped"
  | "failed";

async function processReminderCandidate(
  candidate: WhatsAppRegistrationReminderCandidate,
  nowMs = Date.now()
): Promise<ReminderProcessOutcome> {
  return runSerializedForWaId(candidate.waId, async () => {
    const context = await loadWhatsAppRegistrationReminderContext(candidate.waId);
    if (!context) {
      return "skipped";
    }

    const snapshotActivityAt = effectiveLastInboundAt(
      candidate.lastInboundAt,
      candidate.expiresAt
    );
    const currentActivityAt = effectiveLastInboundAt(
      context.lastInboundAt,
      context.expiresAt
    );

    if (currentActivityAt.getTime() !== snapshotActivityAt.getTime()) {
      return "skipped";
    }

    if (
      !isEligibleForRegistrationReminder(context.conversation, context.expiresAt, nowMs)
    ) {
      return "skipped";
    }

    if (
      context.highestReminderStageSent !== candidate.highestReminderStageSent
    ) {
      return "skipped";
    }

    const inactivityMs = nowMs - currentActivityAt.getTime();
    const stage = determineReminderStageToSend(
      inactivityMs,
      context.highestReminderStageSent
    );
    if (!stage) {
      return "skipped";
    }

    if (isReminderRetryThrottled(context.lastReminderAttemptAt, nowMs)) {
      return "skipped";
    }

    if (stage === 24) {
      const templateSend = await sendWhatsAppRegistrationReminder24hTemplate(
        candidate.waId,
        context.conversation
      );
      if (!templateSend.success) {
        await recordWhatsAppRegistrationReminderFailure(candidate.waId);
        return "failed";
      }

      await recordWhatsAppRegistrationReminderSuccess(candidate.waId, 24);
      return "sent24h";
    }

    const actions =
      stage === 2
        ? buildWhatsAppRegistrationReminder2hActions(context.conversation)
        : buildWhatsAppRegistrationReminder6hActions(context.conversation);

    const dispatch = await dispatchWhatsAppBotActions(candidate.waId, actions);
    if (dispatch.failed > 0) {
      await recordWhatsAppRegistrationReminderFailure(candidate.waId);
      return "failed";
    }

    await recordWhatsAppRegistrationReminderSuccess(candidate.waId, stage);
    return stage === 2 ? "sent2h" : "sent6h";
  });
}

export async function processWhatsAppRegistrationReminders(): Promise<WhatsAppRegistrationReminderProcessorResult> {
  if (!isWhatsAppRegistrationRemindersEnabled()) {
    return {
      checked: 0,
      sent2h: 0,
      sent6h: 0,
      sent24h: 0,
      skipped: 0,
      failed: 0,
    };
  }

  const candidates = await listWhatsAppRegistrationReminderCandidates();
  const result: WhatsAppRegistrationReminderProcessorResult = {
    checked: candidates.length,
    sent2h: 0,
    sent6h: 0,
    sent24h: 0,
    skipped: 0,
    failed: 0,
  };

  for (const candidate of candidates) {
    try {
      const outcome = await processReminderCandidate(candidate);
      if (outcome === "sent2h") {
        result.sent2h += 1;
      } else if (outcome === "sent6h") {
        result.sent6h += 1;
      } else if (outcome === "sent24h") {
        result.sent24h += 1;
      } else if (outcome === "failed") {
        result.failed += 1;
      } else {
        result.skipped += 1;
      }
    } catch {
      result.failed += 1;
    }
  }

  return result;
}
