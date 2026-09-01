import { CURRENT_EVENT_ID } from "@/lib/current-events";
import { generateRegistrationQrPngBase64 } from "@/lib/email";
import { requireIndianMobile } from "@/lib/indian-mobile";
import {
  normalizeRegistrationEmail,
  normalizeRegistrationPhone,
} from "@/lib/registration-duplicates";
import { isStudentRegistration } from "@/lib/registration-kinds";
import type { CreateStudentRegistrationInput } from "@/lib/registration-validation";
import {
  createStudentRegistration,
  getRegistrationForApi,
  resolveStudentRegistrationDuplicate,
} from "@/lib/server/registration-service";
import { maskWaId } from "@/lib/server/whatsapp/meta-webhook";
import {
  type SeminarOption,
  type WhatsAppBotAction,
  type WhatsAppConversationState,
} from "@/lib/server/whatsapp/registration-conversation";
import {
  buildWhatsAppAlreadyRegisteredActions,
  buildWhatsAppCompletionFailureActions,
  buildWhatsAppEmailDuplicatePrivacyActions,
  buildWhatsAppRegistrationConflictActions,
  buildWhatsAppRegistrationSuccessActions,
  buildWhatsAppSameMobileAlreadyRegisteredActions,
} from "@/lib/server/whatsapp/whatsapp-registration-bot-actions";
import {
  cancelWhatsAppConversationForEmailDuplicate,
  finalizeWhatsAppConversationRegistration,
  linkWhatsAppConversationToRegistration,
  loadWhatsAppConversationRecordByWaId,
} from "@/lib/server/whatsapp/whatsapp-conversation-store";
import { reconcileCompletedWhatsAppConversation } from "@/lib/server/whatsapp/whatsapp-completed-conversation-reconcile";
import { getWhatsAppSeminarOptions } from "@/lib/server/whatsapp/whatsapp-seminar-context";
import type { Registration } from "@/types";

export type WhatsAppRegistrationCompletionStatus =
  | "SUCCESS"
  | "ALREADY_REGISTERED"
  | "ALREADY_COMPLETED"
  | "INVALID_PHONE"
  | "INVALID_CONVERSATION"
  | "INVALID_SEMINARS"
  | "CONFLICT"
  | "FAILED";

export type WhatsAppRegistrationCompletionResult = {
  status: WhatsAppRegistrationCompletionStatus;
  registrationId?: string;
  registrationNumber?: string;
  revealRegistrationNumber?: boolean;
  emailSent?: boolean;
  qrPngBase64?: string;
  conversation?: WhatsAppConversationState;
  actions: WhatsAppBotAction[];
};

function safeLogCompletion(input: {
  waId: string;
  status: WhatsAppRegistrationCompletionStatus;
  registrationId?: string;
}): void {
  console.info("[whatsapp-registration] completion", {
    sender: maskWaId(input.waId),
    status: input.status,
    registrationId: input.registrationId,
  });
}

function isReadyConversation(
  conversation: WhatsAppConversationState
): conversation is WhatsAppConversationState & {
  studentName: string;
  email: string;
  classLabel: string;
  gender: NonNullable<WhatsAppConversationState["gender"]>;
  board: string;
  interestedStream: string;
  college: string;
  city: string;
} {
  return (
    conversation.status === "READY_TO_REGISTER" &&
    conversation.currentStep === "READY_TO_REGISTER" &&
    Boolean(conversation.studentName?.trim()) &&
    Boolean(conversation.email?.trim()) &&
    Boolean(conversation.classLabel?.trim()) &&
    Boolean(conversation.gender) &&
    Boolean(conversation.board?.trim()) &&
    Boolean(conversation.interestedStream?.trim()) &&
    Boolean(conversation.college?.trim()) &&
    Boolean(conversation.city?.trim()) &&
    conversation.selectedSeminarIds.length > 0
  );
}

export function resolveSeminarTitlesFromIds(
  selectedSeminarIds: string[],
  seminarOptions: SeminarOption[]
): { ok: true; titles: string[] } | { ok: false } {
  const uniqueIds = [...new Set(selectedSeminarIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { ok: false };
  }

  const optionById = new Map(seminarOptions.map((option) => [option.id, option]));
  const titles: string[] = [];
  for (const seminarId of uniqueIds) {
    const option = optionById.get(seminarId);
    if (!option) {
      return { ok: false };
    }
    titles.push(option.title);
  }

  return { ok: true, titles };
}

export function duplicateAllowsRegistrationNumberReveal(
  duplicate: Registration,
  inputPhone: string
): boolean {
  if (!isStudentRegistration(duplicate)) {
    return false;
  }
  return (
    normalizeRegistrationPhone(duplicate.phone) ===
    normalizeRegistrationPhone(inputPhone)
  );
}

async function buildVerifiedAlreadyRegisteredActions(
  registrationNumber?: string
): Promise<WhatsAppBotAction[]> {
  const qrPngBase64 = registrationNumber
    ? await generateRegistrationQrPngBase64(registrationNumber)
    : undefined;
  return buildWhatsAppAlreadyRegisteredActions({
    registrationNumber,
    qrPngBase64,
  });
}

async function buildAlreadyCompletedResult(
  registrationId: string
): Promise<WhatsAppRegistrationCompletionResult> {
  const registration = await getRegistrationForApi(registrationId);
  const registrationNumber = registration?.registrationNumber;
  return {
    status: "ALREADY_COMPLETED",
    registrationId,
    registrationNumber,
    revealRegistrationNumber: true,
    actions: await buildVerifiedAlreadyRegisteredActions(registrationNumber),
  };
}

type DuplicateRegistrationRef = {
  id: string;
  registrationNumber: string;
};

async function healConversationWithExistingRegistration(
  waId: string,
  registration: DuplicateRegistrationRef,
  options: {
    variant?: "standard" | "same_mobile_different_email";
  } = {}
): Promise<WhatsAppRegistrationCompletionResult> {
  const finalized =
    (await finalizeWhatsAppConversationRegistration({
      waId,
      registrationId: registration.id,
    })) ??
    (await linkWhatsAppConversationToRegistration({
      waId,
      registrationId: registration.id,
    }));
  const conversation =
    finalized ?? (await loadWhatsAppConversationRecordByWaId(waId)) ?? undefined;

  const healed =
    conversation?.completedRegistrationId === registration.id &&
    conversation.status === "COMPLETED";

  safeLogCompletion({
    waId,
    status: healed ? "ALREADY_COMPLETED" : "ALREADY_REGISTERED",
    registrationId: registration.id,
  });

  const qrPngBase64 = await generateRegistrationQrPngBase64(
    registration.registrationNumber
  );
  const builder =
    options.variant === "same_mobile_different_email"
      ? buildWhatsAppSameMobileAlreadyRegisteredActions
      : buildWhatsAppAlreadyRegisteredActions;

  return {
    status: healed ? "ALREADY_COMPLETED" : "ALREADY_REGISTERED",
    registrationId: registration.id,
    registrationNumber: registration.registrationNumber,
    revealRegistrationNumber: true,
    conversation,
    actions: builder({
      registrationNumber: registration.registrationNumber,
      qrPngBase64,
    }),
  };
}

async function handleEmailOnlyDuplicateCancellation(
  waId: string,
  record: WhatsAppConversationState
): Promise<WhatsAppRegistrationCompletionResult> {
  const cancelled = await cancelWhatsAppConversationForEmailDuplicate(waId);
  const conversation =
    cancelled ??
    ({
      ...record,
      status: "CANCELLED",
      currentStep: "CANCELLED",
      completedRegistrationId: null,
    } satisfies WhatsAppConversationState);

  safeLogCompletion({ waId, status: "ALREADY_REGISTERED" });

  return {
    status: "ALREADY_REGISTERED",
    revealRegistrationNumber: false,
    conversation,
    actions: buildWhatsAppEmailDuplicatePrivacyActions(),
  };
}

async function handleRegistrationConflict(
  waId: string,
  record: WhatsAppConversationState
): Promise<WhatsAppRegistrationCompletionResult> {
  const cancelled = await cancelWhatsAppConversationForEmailDuplicate(waId);
  const conversation =
    cancelled ??
    ({
      ...record,
      status: "CANCELLED",
      currentStep: "CANCELLED",
      completedRegistrationId: null,
    } satisfies WhatsAppConversationState);

  safeLogCompletion({ waId, status: "CONFLICT" });

  return {
    status: "CONFLICT",
    revealRegistrationNumber: false,
    conversation,
    actions: buildWhatsAppRegistrationConflictActions(),
  };
}

async function handleResolvedDuplicateRegistration(
  waId: string,
  record: WhatsAppConversationState,
  inputPhone: string,
  resolution: Awaited<
    ReturnType<typeof resolveStudentRegistrationDuplicate>
  >["resolution"]
): Promise<WhatsAppRegistrationCompletionResult> {
  if (resolution.outcome === "conflict") {
    return handleRegistrationConflict(waId, record);
  }

  if (resolution.outcome === "email") {
    return handleEmailOnlyDuplicateCancellation(waId, record);
  }

  if (resolution.outcome === "phone" || resolution.outcome === "both") {
    const registration = resolution.registration;
    if (
      !duplicateAllowsRegistrationNumberReveal(registration, inputPhone)
    ) {
      return handleEmailOnlyDuplicateCancellation(waId, record);
    }

    return healConversationWithExistingRegistration(
      waId,
      {
        id: registration.id,
        registrationNumber: registration.registrationNumber,
      },
      {
        variant:
          resolution.outcome === "both"
            ? "standard"
            : "same_mobile_different_email",
      }
    );
  }

  return {
    status: "FAILED",
    conversation: record,
    actions: buildWhatsAppCompletionFailureActions(
      "We could not complete your registration right now. Please try again shortly."
    ),
  };
}

function buildStudentRegistrationInput(
  conversation: WhatsAppConversationState & {
    studentName: string;
    email: string;
    classLabel: string;
    gender: NonNullable<WhatsAppConversationState["gender"]>;
    board: string;
    interestedStream: string;
    college: string;
    city: string;
  },
  phone: string,
  seminarTitles: string[]
): CreateStudentRegistrationInput {
  return {
    kind: "student",
    eventId: CURRENT_EVENT_ID,
    studentName: conversation.studentName,
    email: conversation.email,
    phone,
    college: conversation.college,
    classLabel: conversation.classLabel,
    interestedStream: conversation.interestedStream,
    board: conversation.board,
    gender: conversation.gender,
    city: conversation.city,
    seminarInterests: seminarTitles,
  };
}

export async function completeWhatsAppRegistrationForConversation(
  waId: string
): Promise<WhatsAppRegistrationCompletionResult> {
  let record = await loadWhatsAppConversationRecordByWaId(waId);
  if (!record) {
    safeLogCompletion({ waId, status: "INVALID_CONVERSATION" });
    return {
      status: "INVALID_CONVERSATION",
      actions: buildWhatsAppCompletionFailureActions(
        "We could not complete your registration. Please try again."
      ),
    };
  }

  if (record.completedRegistrationId) {
    const registration = await getRegistrationForApi(record.completedRegistrationId);
    if (registration) {
      const result = await buildAlreadyCompletedResult(
        record.completedRegistrationId
      );
      safeLogCompletion({
        waId,
        status: "ALREADY_COMPLETED",
        registrationId: record.completedRegistrationId,
      });
      return { ...result, conversation: record };
    }

    record = await reconcileCompletedWhatsAppConversation(record);
    if (record.completedRegistrationId) {
      const healedRegistration = await getRegistrationForApi(
        record.completedRegistrationId
      );
      if (healedRegistration) {
        const result = await buildAlreadyCompletedResult(
          record.completedRegistrationId
        );
        safeLogCompletion({
          waId,
          status: "ALREADY_COMPLETED",
          registrationId: record.completedRegistrationId,
        });
        return { ...result, conversation: record };
      }
    }
  }

  if (!isReadyConversation(record)) {
    safeLogCompletion({ waId, status: "INVALID_CONVERSATION" });
    return {
      status: "INVALID_CONVERSATION",
      conversation: record,
      actions: buildWhatsAppCompletionFailureActions(
        "We could not complete your registration. Please try again."
      ),
    };
  }

  const phoneResult = requireIndianMobile(record.waId, "WhatsApp mobile number");
  if (!phoneResult.ok) {
    safeLogCompletion({ waId, status: "INVALID_PHONE" });
    return {
      status: "INVALID_PHONE",
      conversation: record,
      actions: buildWhatsAppCompletionFailureActions(
        "We could not verify your WhatsApp mobile number for registration. Please contact support."
      ),
    };
  }

  const seminarOptions = await getWhatsAppSeminarOptions();
  const seminarResolution = resolveSeminarTitlesFromIds(
    record.selectedSeminarIds,
    seminarOptions
  );
  if (!seminarResolution.ok) {
    safeLogCompletion({ waId, status: "INVALID_SEMINARS" });
    return {
      status: "INVALID_SEMINARS",
      conversation: record,
      actions: buildWhatsAppCompletionFailureActions(
        "One or more seminar selections are no longer available. Please start again."
      ),
    };
  }

  const duplicateResolution = await resolveStudentRegistrationDuplicate({
    eventId: CURRENT_EVENT_ID,
    email: record.email,
    phone: phoneResult.mobile,
  });
  if (duplicateResolution.resolution.outcome !== "none") {
    return handleResolvedDuplicateRegistration(
      waId,
      record,
      phoneResult.mobile,
      duplicateResolution.resolution
    );
  }

  const createResult = await createStudentRegistration(
    buildStudentRegistrationInput(
      record,
      phoneResult.mobile,
      seminarResolution.titles
    ),
    { trustedInternalRegistration: true }
  );

  if (!createResult.ok) {
    if (
      createResult.error.status === 409 &&
      createResult.error.body.duplicate === true
    ) {
      const refreshedDuplicate = await resolveStudentRegistrationDuplicate({
        eventId: CURRENT_EVENT_ID,
        email: record.email,
        phone: phoneResult.mobile,
      });
      if (refreshedDuplicate.resolution.outcome !== "none") {
        return handleResolvedDuplicateRegistration(
          waId,
          record,
          phoneResult.mobile,
          refreshedDuplicate.resolution
        );
      }
    }

    safeLogCompletion({ waId, status: "FAILED" });
    return {
      status: "FAILED",
      conversation: record,
      actions: buildWhatsAppCompletionFailureActions(
        "We could not complete your registration right now. Please try again shortly."
      ),
    };
  }

  const registration = createResult.registration;
  if (!isStudentRegistration(registration)) {
    safeLogCompletion({ waId, status: "FAILED" });
    return {
      status: "FAILED",
      conversation: record,
      actions: buildWhatsAppCompletionFailureActions(
        "We could not complete your registration right now. Please try again shortly."
      ),
    };
  }

  const finalized = await finalizeWhatsAppConversationRegistration({
    waId,
    registrationId: registration.id,
  });

  if (!finalized) {
    const racedRecord = await loadWhatsAppConversationRecordByWaId(waId);
    if (racedRecord?.completedRegistrationId) {
      const raced = await buildAlreadyCompletedResult(
        racedRecord.completedRegistrationId
      );
      safeLogCompletion({
        waId,
        status: "ALREADY_COMPLETED",
        registrationId: racedRecord.completedRegistrationId,
      });
      return { ...raced, conversation: racedRecord };
    }

    return healConversationWithExistingRegistration(waId, {
      id: registration.id,
      registrationNumber: registration.registrationNumber,
    });
  }

  const qrPngBase64 = await generateRegistrationQrPngBase64(
    registration.registrationNumber
  );

  safeLogCompletion({
    waId,
    status: "SUCCESS",
    registrationId: registration.id,
  });

  return {
    status: "SUCCESS",
    registrationId: registration.id,
    registrationNumber: registration.registrationNumber,
    emailSent: true,
    qrPngBase64,
    conversation: finalized,
    actions: buildWhatsAppRegistrationSuccessActions({
      registrationNumber: registration.registrationNumber,
      qrPngBase64,
    }),
  };
}

export function emailMatchesDuplicate(
  duplicateEmail: string,
  inputEmail: string
): boolean {
  return (
    normalizeRegistrationEmail(duplicateEmail) ===
    normalizeRegistrationEmail(inputEmail)
  );
}
