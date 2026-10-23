import { normalizeWaId } from "@/lib/server/whatsapp/registration-conversation";
import type { WhatsAppConversationState } from "@/lib/server/whatsapp/registration-conversation";
import { dispatchWhatsAppBotActions } from "@/lib/server/whatsapp/whatsapp-bot-dispatcher";
import { loadWhatsAppConversationRecordByWaId } from "@/lib/server/whatsapp/whatsapp-conversation-store";
import { buildPostRegistrationGrowthAction } from "@/lib/server/whatsapp/whatsapp-post-registration-messages";
import {
  cancelPostRegistrationGrowthTrigger,
  claimPostRegistrationGrowthTrigger,
  listDuePostRegistrationGrowthTriggers,
  markPostRegistrationGrowthTriggerSent,
  releasePostRegistrationGrowthTrigger,
  type PostRegistrationGrowthTriggerRow,
} from "@/lib/server/whatsapp/whatsapp-post-registration-store";
import { runSerializedForWaId } from "@/lib/server/whatsapp/whatsapp-wa-id-serializer";

export type PostRegistrationGrowthProcessorResult = {
  checked: number;
  sentInstagram: number;
  sentParentInvite: number;
  sentFriendInvite: number;
  skipped: number;
  failed: number;
  cancelled: number;
};

export function postRegistrationGrowthSendBlockReason(input: {
  trigger: Pick<PostRegistrationGrowthTriggerRow, "waId" | "registrationId">;
  conversation: WhatsAppConversationState | null;
}): "missing_wa_id" | "cancelled" | "not_completed" | "registration_mismatch" | "missing_conversation" | null {
  if (!normalizeWaId(input.trigger.waId)) return "missing_wa_id";
  if (!input.conversation) return "missing_conversation";
  if (input.conversation.status === "CANCELLED") return "cancelled";
  if (
    input.conversation.status !== "COMPLETED" ||
    input.conversation.currentStep !== "COMPLETED" ||
    !input.conversation.completedRegistrationId
  ) {
    return "not_completed";
  }
  if (input.conversation.completedRegistrationId !== input.trigger.registrationId) {
    return "registration_mismatch";
  }
  return null;
}

function emptyResult(): PostRegistrationGrowthProcessorResult {
  return {
    checked: 0,
    sentInstagram: 0,
    sentParentInvite: 0,
    sentFriendInvite: 0,
    skipped: 0,
    failed: 0,
    cancelled: 0,
  };
}

async function processTrigger(
  trigger: PostRegistrationGrowthTriggerRow,
  now: Date,
  result: PostRegistrationGrowthProcessorResult
): Promise<void> {
  const claimed = await claimPostRegistrationGrowthTrigger(trigger.id, now);
  if (!claimed) {
    result.skipped += 1;
    return;
  }

  await runSerializedForWaId(trigger.waId, async () => {
    const conversation = await loadWhatsAppConversationRecordByWaId(trigger.waId);
    const blockReason = postRegistrationGrowthSendBlockReason({
      trigger,
      conversation,
    });

    if (blockReason === "missing_conversation") {
      await releasePostRegistrationGrowthTrigger(trigger.id, blockReason);
      result.failed += 1;
      return;
    }

    if (blockReason) {
      await cancelPostRegistrationGrowthTrigger(trigger.id, blockReason);
      result.cancelled += 1;
      return;
    }

    const action = buildPostRegistrationGrowthAction({
      kind: trigger.kind,
      studentName: conversation?.studentName ?? null,
    });
    const dispatch = await dispatchWhatsAppBotActions(trigger.waId, [action]);
    if (dispatch.failed > 0) {
      const errorCode = dispatch.results.find((item) => !item.success)?.errorCode;
      await releasePostRegistrationGrowthTrigger(
        trigger.id,
        errorCode ?? "send_failed"
      );
      result.failed += 1;
      return;
    }

    await markPostRegistrationGrowthTriggerSent(trigger.id, now);
    if (trigger.kind === "INSTAGRAM") result.sentInstagram += 1;
    else if (trigger.kind === "PARENT_INVITE") result.sentParentInvite += 1;
    else result.sentFriendInvite += 1;
  });
}

export async function processPostRegistrationGrowthTriggers(
  now = new Date()
): Promise<PostRegistrationGrowthProcessorResult> {
  const due = await listDuePostRegistrationGrowthTriggers(now);
  const result = emptyResult();
  result.checked = due.length;

  for (const trigger of due) {
    try {
      await processTrigger(trigger, now, result);
    } catch (error) {
      result.failed += 1;
      try {
        await releasePostRegistrationGrowthTrigger(
          trigger.id,
          error instanceof Error ? error.message : "send_failed"
        );
      } catch {
        // The claim lease releases the row if this process dies.
      }
    }
  }

  return result;
}
