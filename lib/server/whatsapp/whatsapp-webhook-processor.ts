import {
  extractNormalizedWhatsAppMessages,
  maskWaId,
  parseMetaWebhookPayload,
  type NormalizedWhatsAppMessage,
} from "@/lib/server/whatsapp/meta-webhook";
import {
  isSupportedConversationMessageType,
  normalizeWaId,
  processRegistrationConversationTurn,
} from "@/lib/server/whatsapp/registration-conversation";
import { dispatchWhatsAppBotActions } from "@/lib/server/whatsapp/whatsapp-bot-dispatcher";
import {
  deleteExpiredWhatsAppConversation,
  loadWhatsAppConversationForWaId,
  saveWhatsAppConversationState,
} from "@/lib/server/whatsapp/whatsapp-conversation-store";
import {
  claimWhatsAppInboundMessage,
  markWhatsAppInboundMessageProcessed,
} from "@/lib/server/whatsapp/whatsapp-inbound-message-store";
import { getWhatsAppSeminarOptions } from "@/lib/server/whatsapp/whatsapp-seminar-context";

function toIncomingMessage(
  message: NormalizedWhatsAppMessage
): { text?: string; interactiveId?: string } {
  return {
    text: message.textBody,
    interactiveId: message.interactiveReplyId,
  };
}

function safeLogConversationProgress(input: {
  messageId: string;
  messageType: string;
  waId: string;
  status: string;
  currentStep: string;
  duplicate?: boolean;
}): void {
  console.info("[whatsapp-webhook] conversation", {
    messageId: input.messageId,
    messageType: input.messageType,
    sender: maskWaId(input.waId),
    status: input.status,
    currentStep: input.currentStep,
    duplicate: input.duplicate ?? false,
  });
}

async function processInboundUserMessage(
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

  await deleteExpiredWhatsAppConversation(waId);
  const existingConversation = await loadWhatsAppConversationForWaId(waId);
  const seminarOptions = await getWhatsAppSeminarOptions();

  const turn = processRegistrationConversationTurn({
    conversation: existingConversation,
    message: toIncomingMessage(message),
    seminarOptions,
    waId,
  });

  const saved = await saveWhatsAppConversationState(turn.conversation, {
    refreshExpiry: turn.refreshExpiry,
  });

  safeLogConversationProgress({
    messageId: message.messageId,
    messageType: message.type,
    waId,
    status: saved.status,
    currentStep: saved.currentStep,
  });

  dispatchWhatsAppBotActions(turn.actions);
  await markWhatsAppInboundMessageProcessed(message.messageId);
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
}
