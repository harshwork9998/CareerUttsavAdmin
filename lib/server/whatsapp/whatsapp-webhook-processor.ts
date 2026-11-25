import { applyCampaignDeliveryStatus } from "@/lib/server/whatsapp/campaign-delivery-webhook";
import { handleInboundOptOutIfNeeded } from "@/lib/server/whatsapp/campaign-opt-out-handler";
import {
  extractNormalizedWhatsAppMessages,
  extractNormalizedWhatsAppStatuses,
  maskWaId,
  parseMetaWebhookPayload,
  safeLogWhatsAppDeliveryStatus,
  type NormalizedWhatsAppMessage,
} from "@/lib/server/whatsapp/meta-webhook";
import {
  isSupportedConversationMessageType,
  normalizeWaId,
  resolveConversationRefreshExpiry,
  type WhatsAppBotAction,
} from "@/lib/server/whatsapp/registration-conversation";
import {
  dispatchWhatsAppBotActions,
  registrationEntryPassQrDelivered,
} from "@/lib/server/whatsapp/whatsapp-bot-dispatcher";
import { markPostRegistrationEntryPassDelivered } from "@/lib/server/whatsapp/whatsapp-growth-schedule-eligibility";
import { schedulePostRegistrationGrowthTriggers } from "@/lib/server/whatsapp/whatsapp-post-registration-schedule";
import { processWhatsAppRegistrationConversationTurnAsync } from "@/lib/server/whatsapp/whatsapp-registration-duplicate-flow";
import {
  deleteExpiredWhatsAppConversation,
  loadWhatsAppConversationTurnContext,
  saveWhatsAppConversationState,
} from "@/lib/server/whatsapp/whatsapp-conversation-store";
import {
  claimWhatsAppInboundMessage,
  markWhatsAppInboundMessageProcessed,
} from "@/lib/server/whatsapp/whatsapp-inbound-message-store";
import { completeWhatsAppRegistrationForConversation } from "@/lib/server/whatsapp/whatsapp-registration-completion";
import { resolveCompletedRegistrationNumberForConversation } from "@/lib/server/whatsapp/whatsapp-completed-conversation-reconcile";
import {
  getWhatsAppEventArtworkSeminarOptions,
  getWhatsAppSeminarDayCatalog,
  getWhatsAppSeminarOptions,
} from "@/lib/server/whatsapp/whatsapp-seminar-context";
import { runSerializedForWaId } from "@/lib/server/whatsapp/whatsapp-wa-id-serializer";

function toIncomingMessage(
  message: NormalizedWhatsAppMessage
): { text?: string; interactiveId?: string } {
  return {
    text: message.textBody,
    interactiveId: message.interactiveReplyId,
  };
}

async function resolveCompletedRegistrationNumber(
  conversation: Awaited<
    ReturnType<typeof loadWhatsAppConversationTurnContext>
  >["conversation"]
): Promise<string | null> {
  return resolveCompletedRegistrationNumberForConversation(conversation);
}

function safeLogConversationProgress(input: {
  messageId: string;
  messageType: string;
  waId: string;
  status: string;
  currentStep: string;
  duplicate?: boolean;
  completionStatus?: string;
}): void {
  console.info("[whatsapp-webhook] conversation", {
    messageId: input.messageId,
    messageType: input.messageType,
    sender: maskWaId(input.waId),
    status: input.status,
    currentStep: input.currentStep,
    duplicate: input.duplicate ?? false,
    completionStatus: input.completionStatus,
  });
}

async function processInboundUserMessageSerialized(
  message: NormalizedWhatsAppMessage
): Promise<void> {
  const waId = normalizeWaId(message.waId);
  const claim = await claimWhatsAppInboundMessage({
    messageId: message.messageId,
    waId,
    messageType: message.type,
  });

  if (claim === "duplicate") {
    safeLogConversationProgress({
      messageId: message.messageId,
      messageType: message.type,
      waId,
      status: "duplicate",
      currentStep: "duplicate",
      duplicate: true,
    });
    return;
  }

  if (await handleInboundOptOutIfNeeded({ waId, text: message.textBody })) {
    await markWhatsAppInboundMessageProcessed(message.messageId);
    return;
  }

  const turnContext = await loadWhatsAppConversationTurnContext(waId);

  if (!isSupportedConversationMessageType(message.type)) {
    safeLogConversationProgress({
      messageId: message.messageId,
      messageType: message.type,
      waId,
      status: "ignored",
      currentStep: "unsupported",
    });
    await markWhatsAppInboundMessageProcessed(message.messageId);
    return;
  }

  const sessionExpired = await deleteExpiredWhatsAppConversation(waId);
  const existingConversation = turnContext.conversation;
  const previousActivityAt = turnContext.previousActivityAt;
  const [seminarOptions, eventArtworkSeminarOptions, seminarDayCatalog] =
    await Promise.all([
      getWhatsAppSeminarOptions(),
      getWhatsAppEventArtworkSeminarOptions(),
      getWhatsAppSeminarDayCatalog(),
    ]);
  const completedRegistrationNumber = await resolveCompletedRegistrationNumber(
    existingConversation
  );

  const turn = await processWhatsAppRegistrationConversationTurnAsync({
    conversation: existingConversation,
    message: toIncomingMessage(message),
    seminarOptions,
    eventArtworkSeminarOptions,
    seminarDayCatalog,
    waId,
    completedRegistrationNumber,
    sessionExpired,
    previousActivityAt,
  });

  let saved = await saveWhatsAppConversationState(turn.conversation, {
    refreshExpiry: resolveConversationRefreshExpiry(
      turn.conversation,
      turn.refreshExpiry
    ),
    touchLastInboundAt: true,
    resetReminderTracking: turn.resetReminderTracking ?? false,
  });

  const actions: WhatsAppBotAction[] = [...turn.actions];
  let registrationCompletion:
    | Awaited<ReturnType<typeof completeWhatsAppRegistrationForConversation>>
    | null = null;

  if (
    saved.status === "READY_TO_REGISTER" &&
    saved.currentStep === "READY_TO_REGISTER" &&
    !saved.completedRegistrationId
  ) {
    const completion = await completeWhatsAppRegistrationForConversation(waId);
    registrationCompletion = completion;
    actions.push(...completion.actions);
    if (completion.conversation) {
      saved = await saveWhatsAppConversationState(completion.conversation, {
        refreshExpiry: resolveConversationRefreshExpiry(
          completion.conversation,
          false
        ),
        touchLastInboundAt: true,
      });
    }
    safeLogConversationProgress({
      messageId: message.messageId,
      messageType: message.type,
      waId,
      status: saved.status,
      currentStep: saved.currentStep,
      completionStatus: completion.status,
    });
  } else {
    safeLogConversationProgress({
      messageId: message.messageId,
      messageType: message.type,
      waId,
      status: saved.status,
      currentStep: saved.currentStep,
    });
  }

  const dispatchSummary = await dispatchWhatsAppBotActions(waId, actions);

  if (
    registrationCompletion?.status === "SUCCESS" &&
    registrationCompletion.registrationId &&
    registrationCompletion.conversation &&
    registrationEntryPassQrDelivered(dispatchSummary, actions)
  ) {
    const entryPassDeliveredAt = new Date();
    await markPostRegistrationEntryPassDelivered(waId, entryPassDeliveredAt);
    try {
      await schedulePostRegistrationGrowthTriggers({
        waId,
        registrationId: registrationCompletion.registrationId,
        completedAt: entryPassDeliveredAt,
        conversation: registrationCompletion.conversation,
      });
    } catch (error) {
      console.error("[whatsapp-growth] schedule failed", {
        event: "growth_schedule_failed",
        sender: maskWaId(waId),
        registrationId: registrationCompletion.registrationId,
        error: error instanceof Error ? error.message : "unknown",
        recovery: "worker_recovery_pass",
        entryPassDeliveredAt: entryPassDeliveredAt.toISOString(),
      });
    }
  }

  await markWhatsAppInboundMessageProcessed(message.messageId);
}

async function processInboundUserMessage(
  message: NormalizedWhatsAppMessage
): Promise<void> {
  return runSerializedForWaId(message.waId, () =>
    processInboundUserMessageSerialized(message)
  );
}

export async function processVerifiedWhatsAppWebhook(rawBody: string): Promise<void> {
  const payload = parseMetaWebhookPayload(rawBody);
  if (!payload) {
    console.warn("[whatsapp-webhook] received payload that could not be parsed");
    return;
  }

  const messages = extractNormalizedWhatsAppMessages(payload);
  for (const message of messages) {
    await processInboundUserMessage(message);
  }

  const statuses = extractNormalizedWhatsAppStatuses(payload);
  for (const status of statuses) {
    void applyCampaignDeliveryStatus(status).catch((error: unknown) => {
      console.warn(
        "[whatsapp-campaign] delivery update failed",
        error instanceof Error ? error.message : "unknown"
      );
    });
    safeLogWhatsAppDeliveryStatus(status);
  }
}
