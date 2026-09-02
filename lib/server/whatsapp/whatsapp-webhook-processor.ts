import {
  extractNormalizedWhatsAppMessages,
  extractNormalizedWhatsAppStatuses,
  maskWaId,
  parseMetaWebhookPayload,
  safeLogWhatsAppDeliveryStatus,
  type NormalizedWhatsAppMessage,
} from "@/lib/server/whatsapp/meta-webhook";
import {
  isSupportedConversationMessage,
  normalizeWaId,
  resolveConversationRefreshExpiry,
  type WhatsAppBotAction,
} from "@/lib/server/whatsapp/registration-conversation";
import { dispatchWhatsAppBotActions } from "@/lib/server/whatsapp/whatsapp-bot-dispatcher";
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
import { getWhatsAppSeminarOptions } from "@/lib/server/whatsapp/whatsapp-seminar-context";
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

  if (!isSupportedConversationMessage(message)) {
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
  const { conversation: existingConversation, previousActivityAt } =
    await loadWhatsAppConversationTurnContext(waId);
  const seminarOptions = await getWhatsAppSeminarOptions();
  const completedRegistrationNumber = await resolveCompletedRegistrationNumber(
    existingConversation
  );

  const turn = await processWhatsAppRegistrationConversationTurnAsync({
    conversation: existingConversation,
    message: toIncomingMessage(message),
    seminarOptions,
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

  if (
    saved.status === "READY_TO_REGISTER" &&
    saved.currentStep === "READY_TO_REGISTER" &&
    !saved.completedRegistrationId
  ) {
    const completion = await completeWhatsAppRegistrationForConversation(waId);
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

  await dispatchWhatsAppBotActions(waId, actions);
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
    safeLogWhatsAppDeliveryStatus(status);
  }
}
