import { CURRENT_EVENT_ID } from "@/lib/current-events";
import { lastStepForWhatsAppConversation } from "@/lib/registration-attempt";
import {
  ensureWhatsAppRegistrationAttempt,
  syncWhatsAppRegistrationAttempt,
} from "@/lib/server/registration-attempt-store";
import { requireIndianMobile } from "@/lib/indian-mobile";
import {
  getRegistrationForApi,
  resolveStudentRegistrationDuplicate,
} from "@/lib/server/registration-service";
import {
  generateWhatsAppEntryPassPngBase64,
  seminarTitlesForEventPass,
} from "@/lib/server/whatsapp/event-pass";
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
import type { WhatsAppSeminarDayCatalog } from "@/lib/server/whatsapp/whatsapp-seminar-day-catalog";
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

async function storedSeminarTitles(registrationId?: string | null): Promise<string[]> {
  if (!registrationId) {
    return [];
  }
  try {
    const registration = await getRegistrationForApi(registrationId);
    return seminarTitlesForEventPass(registration);
  } catch (error) {
    console.error(
      "[event-pass] stored seminar lookup failed",
      error instanceof Error ? error.message : "unknown"
    );
    return [];
  }
}

async function buildVerifiedRegistrationActions(input: {
  registrationId?: string | null;
  registrationNumber?: string;
  variant: AlreadyRegisteredVariant;
}): Promise<WhatsAppBotAction[]> {
  const seminarTitles = await storedSeminarTitles(input.registrationId);
  const qrPngBase64 = input.registrationNumber
    ? await generateWhatsAppEntryPassPngBase64({
        registrationId: input.registrationNumber,
        seminarTitles,
      })
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
      registrationId: input.registrationId,
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
    registrationId: input.completedRegistrationId,
    registrationNumber: input.completedRegistrationNumber ?? undefined,
    variant: "standard",
  });
}

export async function processWhatsAppRegistrationConversationTurnAsync(input: {
  conversation: WhatsAppConversationState | null;
  message: IncomingConversationMessage;
  seminarOptions: SeminarOption[];
  eventArtworkSeminarOptions: SeminarOption[];
  seminarDayCatalog: WhatsAppSeminarDayCatalog;
  waId: string;
  completedRegistrationNumber?: string | null;
  sessionExpired?: boolean;
  previousActivityAt?: Date | null;
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

  if (conversation.status === "COMPLETED") {
    return processRegistrationConversationTurn({
      ...input,
      conversation,
    });
  }

  const attempt = await ensureWhatsAppRegistrationAttempt({
    eventId: CURRENT_EVENT_ID,
    waId: normalizedWaId,
    attemptId: conversation.registrationAttemptId,
  });
  conversation = {
    ...conversation,
    registrationAttemptId: attempt.id,
  };

  const result = processRegistrationConversationTurn({
    ...input,
    conversation,
  });
  const syncedConversation = {
    ...result.conversation,
    registrationAttemptId:
      result.conversation.registrationAttemptId ?? attempt.id,
  };
  const seminarTitles = syncedConversation.selectedSeminarIds.flatMap((seminarId) => {
    const match = input.seminarOptions.find((option) => option.id === seminarId);
    return match?.title.trim() ? [match.title.trim()] : [];
  });
  await syncWhatsAppRegistrationAttempt({
    attemptId: attempt.id,
    currentStep: syncedConversation.currentStep,
    name: syncedConversation.studentName,
    email: syncedConversation.email,
    classLabel: syncedConversation.classLabel,
    gender: syncedConversation.gender,
    board: syncedConversation.board,
    interestedStream: syncedConversation.interestedStream,
    college: syncedConversation.college,
    city: syncedConversation.city,
    seminarInterests:
      syncedConversation.selectedSeminarIds.length > 0 && seminarTitles.length === 0
        ? attempt.seminarInterests
        : seminarTitles,
    lastStep: lastStepForWhatsAppConversation(syncedConversation.currentStep),
    clearProgress: false,
  });
  return {
    ...result,
    conversation: syncedConversation,
  };
}
