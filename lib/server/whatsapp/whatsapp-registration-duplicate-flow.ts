import { CURRENT_EVENT_ID } from "@/lib/current-events";
import { generateRegistrationQrPngBase64 } from "@/lib/email";
import { requireIndianMobile } from "@/lib/indian-mobile";
import { resolveStudentRegistrationDuplicate } from "@/lib/server/registration-service";
import {
  REGISTRATION_INTERACTIVE_IDS,
} from "@/lib/server/whatsapp/registration-interactive-ids";
import {
  createInitialConversationState,
  normalizeWaId,
  processRegistrationConversationTurn,
  type ConversationTurnResult,
  type IncomingConversationMessage,
  type SeminarOption,
  type WhatsAppBotAction,
  type WhatsAppConversationState,
} from "@/lib/server/whatsapp/registration-conversation";
import {
  buildWhatsAppAlreadyRegisteredActions,
  buildWhatsAppEmailDuplicatePrivacyActions,
  buildWhatsAppRegistrationConflictActions,
  buildWhatsAppSameMobileAlreadyRegisteredActions,
} from "@/lib/server/whatsapp/whatsapp-registration-bot-actions";
import {
  reconcileCompletedWhatsAppConversation,
  resolveCompletedRegistrationNumberForConversation,
} from "@/lib/server/whatsapp/whatsapp-completed-conversation-reconcile";

type AlreadyRegisteredVariant = "standard" | "same_mobile_different_email";

function isGreetingText(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return (
    normalized === "hi" ||
    normalized === "hello" ||
    normalized === "hey" ||
    normalized === "register" ||
    normalized === "start" ||
    normalized === "hii" ||
    normalized === "namaste"
  );
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isStartMessage(message: IncomingConversationMessage): boolean {
  return message.interactiveId === REGISTRATION_INTERACTIVE_IDS.START;
}

function isGreetingOrStartMessage(message: IncomingConversationMessage): boolean {
  return (
    isStartMessage(message) ||
    Boolean(message.text?.trim() && isGreetingText(message.text))
  );
}

function shouldCheckMobileOnStart(
  conversation: WhatsAppConversationState,
  message: IncomingConversationMessage
): boolean {
  if (conversation.status === "COMPLETED") {
    return false;
  }
  if (
    conversation.status === "ACTIVE" &&
    conversation.currentStep !== "AWAITING_START"
  ) {
    return false;
  }
  if (conversation.status === "READY_TO_REGISTER") {
    return false;
  }

  if (!isGreetingOrStartMessage(message)) {
    return false;
  }

  return (
    conversation.status === "CANCELLED" ||
    conversation.currentStep === "AWAITING_START"
  );
}

async function buildVerifiedRegistrationActions(input: {
  registrationNumber?: string;
  variant: AlreadyRegisteredVariant;
}): Promise<WhatsAppBotAction[]> {
  const qrPngBase64 = input.registrationNumber
    ? await generateRegistrationQrPngBase64(input.registrationNumber)
    : undefined;
  const builder =
    input.variant === "same_mobile_different_email"
      ? buildWhatsAppSameMobileAlreadyRegisteredActions
      : buildWhatsAppAlreadyRegisteredActions;

  return builder({
    registrationNumber: input.registrationNumber,
    qrPngBase64,
  });
}

function buildCompletedConversationState(
  waId: string,
  registrationId: string
): WhatsAppConversationState {
  return {
    ...createInitialConversationState(waId),
    status: "COMPLETED",
    currentStep: "COMPLETED",
    completedRegistrationId: registrationId,
  };
}

async function buildAlreadyRegisteredTurn(input: {
  waId: string;
  registrationId: string;
  registrationNumber?: string;
  variant: AlreadyRegisteredVariant;
}): Promise<ConversationTurnResult> {
  const conversation = buildCompletedConversationState(
    input.waId,
    input.registrationId
  );

  return {
    conversation,
    actions: await buildVerifiedRegistrationActions({
      registrationNumber: input.registrationNumber,
      variant: input.variant,
    }),
    refreshExpiry: true,
  };
}

function buildCancelledConversation(
  conversation: WhatsAppConversationState
): WhatsAppConversationState {
  return {
    ...conversation,
    status: "CANCELLED",
    currentStep: "CANCELLED",
    completedRegistrationId: null,
  };
}

export async function buildCompletedUserGreetingActions(input: {
  completedRegistrationId?: string | null;
  completedRegistrationNumber?: string | null;
}): Promise<WhatsAppBotAction[]> {
  return buildVerifiedRegistrationActions({
    registrationNumber: input.completedRegistrationNumber ?? undefined,
    variant: "standard",
  });
}

export async function processWhatsAppRegistrationConversationTurnAsync(input: {
  conversation: WhatsAppConversationState | null;
  message: IncomingConversationMessage;
  seminarOptions: SeminarOption[];
  waId: string;
  completedRegistrationNumber?: string | null;
  sessionExpired?: boolean;
}): Promise<ConversationTurnResult> {
  const normalizedWaId = normalizeWaId(input.waId);
  let conversation =
    input.conversation ?? createInitialConversationState(normalizedWaId);

  conversation = await reconcileCompletedWhatsAppConversation(conversation);

  if (
    conversation.status === "COMPLETED" &&
    isGreetingOrStartMessage(input.message)
  ) {
    const registrationNumber =
      await resolveCompletedRegistrationNumberForConversation(conversation);
    return {
      conversation,
      actions: await buildCompletedUserGreetingActions({
        completedRegistrationId: conversation.completedRegistrationId,
        completedRegistrationNumber: registrationNumber,
      }),
      refreshExpiry: false,
    };
  }

  if (shouldCheckMobileOnStart(conversation, input.message)) {
    const phoneResult = requireIndianMobile(
      normalizedWaId,
      "WhatsApp mobile number"
    );
    if (phoneResult.ok) {
      const duplicate = await resolveStudentRegistrationDuplicate({
        eventId: CURRENT_EVENT_ID,
        phone: phoneResult.mobile,
      });
      if (
        duplicate.resolution.outcome === "phone" ||
        duplicate.resolution.outcome === "both"
      ) {
        return buildAlreadyRegisteredTurn({
          waId: normalizedWaId,
          registrationId: duplicate.resolution.registration.id,
          registrationNumber:
            duplicate.resolution.registration.registrationNumber,
          variant: "standard",
        });
      }
    }
  }

  if (
    conversation.currentStep === "AWAITING_EMAIL" &&
    input.message.text &&
    isValidEmail(input.message.text)
  ) {
    const email = input.message.text.trim().toLowerCase();
    const phoneResult = requireIndianMobile(
      normalizedWaId,
      "WhatsApp mobile number"
    );
    if (phoneResult.ok) {
      const duplicate = await resolveStudentRegistrationDuplicate({
        eventId: CURRENT_EVENT_ID,
        phone: phoneResult.mobile,
        email,
      });

      if (duplicate.resolution.outcome === "conflict") {
        return {
          conversation: buildCancelledConversation(conversation),
          actions: buildWhatsAppRegistrationConflictActions(),
          refreshExpiry: true,
        };
      }

      if (duplicate.resolution.outcome === "email") {
        return {
          conversation: buildCancelledConversation(conversation),
          actions: buildWhatsAppEmailDuplicatePrivacyActions(),
          refreshExpiry: true,
        };
      }

      if (
        duplicate.resolution.outcome === "phone" ||
        duplicate.resolution.outcome === "both"
      ) {
        return buildAlreadyRegisteredTurn({
          waId: normalizedWaId,
          registrationId: duplicate.resolution.registration.id,
          registrationNumber:
            duplicate.resolution.registration.registrationNumber,
          variant:
            duplicate.resolution.outcome === "both"
              ? "standard"
              : "same_mobile_different_email",
        });
      }
    }
  }

  return processRegistrationConversationTurn({
    ...input,
    conversation,
  });
}
