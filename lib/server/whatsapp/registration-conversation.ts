import {
  REGISTRATION_BOARD_OPTIONS,
  REGISTRATION_CLASS_OPTIONS,
  REGISTRATION_STREAM_OPTIONS,
  WHATSAPP_GENDER_OPTIONS,
  type WhatsAppGenderOption,
} from "@/lib/server/whatsapp/registration-options";
import {
  REGISTRATION_INTERACTIVE_IDS,
  boardInteractiveId,
  classInteractiveId,
  genderInteractiveId,
  parseBoardInteractiveId,
  parseClassInteractiveId,
  parseGenderInteractiveId,
  parseSeminarInteractiveId,
  parseSeminarPageInteractiveId,
  parseStreamInteractiveId,
  seminarInteractiveId,
  seminarPageInteractiveId,
  streamInteractiveId,
} from "@/lib/server/whatsapp/registration-interactive-ids";
import { formatNumberedSeminarListRow } from "@/lib/server/whatsapp/seminar-list-display";
import {
  WHATSAPP_LEGACY_SEMINAR_MIGRATION_MESSAGE,
  WHATSAPP_SEMINAR_FINISH_ALREADY_SAVED_PROMPT,
  WHATSAPP_SEMINAR_FINISH_PROMPT,
  WHATSAPP_STALE_SEMINAR_RECOVERY_MESSAGE,
  buildSeminarFinishSummaryBody,
  combinedSeminarSelectionActions,
  parseSeminarSelectionInput,
  seminarSelectionErrorActions,
  selectedSeminarsStillValidInCatalog,
  type WhatsAppSeminarDayCatalog,
} from "@/lib/server/whatsapp/whatsapp-seminar-day-catalog";

export const WHATSAPP_CONVERSATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const WHATSAPP_RESUME_INACTIVITY_MS = 30 * 60 * 1000;
export const WHATSAPP_SEMINAR_LIST_ROW_LIMIT = 10;
export const WHATSAPP_SEMINAR_LIST_PAGE_SIZE = 8;
export const WHATSAPP_SEMINAR_SELECTION_MIN = 1;
export const WHATSAPP_SEMINAR_SELECTION_MAX = 3;
export const WHATSAPP_CITY_PROMPT = "Please enter your city of residence.";
/** @deprecated Use WHATSAPP_SEMINAR_SELECTION_MAX */
export const WHATSAPP_SEMINAR_SELECTION_TARGET = WHATSAPP_SEMINAR_SELECTION_MAX;

export type WhatsAppConversationStatus =
  | "ACTIVE"
  | "READY_TO_REGISTER"
  | "COMPLETED"
  | "CANCELLED";

export type WhatsAppConversationStep =
  | "AWAITING_START"
  | "AWAITING_NAME"
  | "AWAITING_EMAIL"
  | "AWAITING_CLASS"
  | "AWAITING_GENDER"
  | "AWAITING_BOARD"
  | "AWAITING_STREAM"
  | "AWAITING_COLLEGE"
  | "AWAITING_CITY"
  | "AWAITING_SEMINARS"
  | "AWAITING_SEMINAR_FINISH"
  | "READY_TO_REGISTER"
  | "COMPLETED"
  | "CANCELLED";

export type WhatsAppConversationState = {
  waId: string;
  status: WhatsAppConversationStatus;
  currentStep: WhatsAppConversationStep;
  studentName: string | null;
  email: string | null;
  classLabel: string | null;
  gender: WhatsAppGenderOption | null;
  board: string | null;
  interestedStream: string | null;
  college: string | null;
  city: string | null;
  selectedSeminarIds: string[];
  completedRegistrationId: string | null;
};

export type SeminarOption = {
  id: string;
  title: string;
  date?: string;
  startTime?: string;
};

export type WhatsAppBotButton = {
  id: string;
  title: string;
};

export type WhatsAppBotListRow = {
  id: string;
  title: string;
  description?: string;
};

export type WhatsAppBotAction =
  | { type: "TEXT"; body: string }
  | {
      type: "BUTTONS";
      body: string;
      buttons: WhatsAppBotButton[];
    }
  | {
      type: "LIST";
      body: string;
      buttonText: string;
      sections: Array<{ title: string; rows: WhatsAppBotListRow[] }>;
    }
  | {
      type: "MEDIA";
      mimeType: "image/png";
      filename: string;
      contentBase64: string;
      caption?: string;
    };

export type IncomingConversationMessage = {
  text?: string;
  interactiveId?: string;
};

export type ConversationTurnResult = {
  conversation: WhatsAppConversationState;
  actions: WhatsAppBotAction[];
  refreshExpiry: boolean;
  resetReminderTracking?: boolean;
};

export function isIncompleteConversationStatus(
  status: WhatsAppConversationStatus
): boolean {
  return status === "ACTIVE" || status === "READY_TO_REGISTER";
}

export function shouldRefreshIncompleteConversationExpiry(
  status: WhatsAppConversationStatus
): boolean {
  return isIncompleteConversationStatus(status);
}

export function resolveConversationRefreshExpiry(
  conversation: WhatsAppConversationState,
  turnRefreshExpiry: boolean
): boolean {
  if (
    conversation.status === "COMPLETED" ||
    conversation.status === "CANCELLED"
  ) {
    return false;
  }
  if (shouldRefreshIncompleteConversationExpiry(conversation.status)) {
    return true;
  }
  return turnRefreshExpiry;
}

export function computePreviousActivityAtFromExpiresAt(expiresAt: Date): Date {
  return new Date(expiresAt.getTime() - WHATSAPP_CONVERSATION_TTL_MS);
}

export function isReturningUserInactivity(
  previousActivityAt: Date | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!previousActivityAt) {
    return true;
  }
  return nowMs - previousActivityAt.getTime() >= WHATSAPP_RESUME_INACTIVITY_MS;
}

export function normalizeWaId(waId: string): string {
  return waId.replace(/\D/g, "");
}

export function createInitialConversationState(waId: string): WhatsAppConversationState {
  return {
    waId: normalizeWaId(waId),
    status: "ACTIVE",
    currentStep: "AWAITING_START",
    studentName: null,
    email: null,
    classLabel: null,
    gender: null,
    board: null,
    interestedStream: null,
    college: null,
    city: null,
    selectedSeminarIds: [],
    completedRegistrationId: null,
  };
}

export function resetConversationAnswers(
  conversation: WhatsAppConversationState
): WhatsAppConversationState {
  return {
    ...createInitialConversationState(conversation.waId),
    status: "ACTIVE",
    currentStep: "AWAITING_NAME",
    completedRegistrationId: null,
  };
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidName(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 2 && trimmed.length <= 120;
}

function isValidPlaceName(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 2 && trimmed.length <= 200;
}

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

function isCancelText(text: string): boolean {
  return text.trim().toLowerCase() === "cancel";
}

function normalizeDecisionText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ");
}

export function isFinishRegistrationText(text: string): boolean {
  const normalized = normalizeDecisionText(text);
  return (
    normalized === "done" ||
    normalized === "finish" ||
    normalized === "finished" ||
    normalized === "register" ||
    normalized === "proceed" ||
    normalized === "that's all" ||
    normalized === "thats all" ||
    normalized === "no more" ||
    normalized === "enough"
  );
}

export function isChooseAnotherSeminarText(text: string): boolean {
  const normalized = normalizeDecisionText(text);
  return (
    normalized === "more" ||
    normalized === "another" ||
    normalized === "choose another" ||
    normalized === "one more" ||
    normalized === "show more"
  );
}

export function isRestartRegistrationText(text: string): boolean {
  const normalized = normalizeDecisionText(text);
  return (
    normalized === "restart" ||
    normalized === "start over" ||
    normalized === "reset"
  );
}

function isFinishSeminarInteractiveId(interactiveId: string | undefined): boolean {
  return (
    interactiveId === REGISTRATION_INTERACTIVE_IDS.FINISH ||
    interactiveId === REGISTRATION_INTERACTIVE_IDS.FINISH_LEGACY
  );
}

function isChooseAnotherSeminarInteractiveId(
  interactiveId: string | undefined
): boolean {
  return interactiveId === REGISTRATION_INTERACTIVE_IDS.CHOOSE_ANOTHER;
}

function remainingSeminarOptions(
  seminarOptions: SeminarOption[],
  selectedSeminarIds: string[]
): SeminarOption[] {
  return seminarOptions.filter(
    (seminar) => !selectedSeminarIds.includes(seminar.id)
  );
}

function welcomeActions(): WhatsAppBotAction[] {
  return [
    {
      type: "BUTTONS",
      body: `👋 Welcome to Career Uttsav!

Career Uttsav is a career discovery platform for students after 10th & 12th, helping you explore the right courses, careers, institutions, and opportunities for your future.

Let's get you registered for the event. It'll only take a minute.`,
      buttons: [
        {
          id: REGISTRATION_INTERACTIVE_IDS.START,
          title: "Start Registration",
        },
      ],
    },
  ];
}

function nameStepActions(): WhatsAppBotAction[] {
  return [
    {
      type: "TEXT",
      body: `Before we begin, if you make a mistake while entering your details, just type *cancel*.

We'll pause this registration and you can start afresh by sending *Hi*.`,
    },
    {
      type: "TEXT",
      body: "*What is your full name?*",
    },
  ];
}

function cancelledActions(): WhatsAppBotAction[] {
  return [
    {
      type: "TEXT",
      body: `Your registration has been paused.

To start afresh, please send *Hi*.`,
    },
  ];
}

function completedCancelBlockedActions(): WhatsAppBotAction[] {
  return [
    {
      type: "TEXT",
      body: `Your registration is already complete. Your Registration ID and QR code have already been generated, so it can't be cancelled from WhatsApp.`,
    },
  ];
}

function beginNameStep(
  conversation: WhatsAppConversationState,
  seminarOptions: SeminarOption[]
): ConversationTurnResult {
  return {
    conversation: {
      ...conversation,
      status: "ACTIVE",
      currentStep: "AWAITING_NAME",
    },
    actions: nameStepActions(),
    refreshExpiry: true,
  };
}

export function buildWelcomeBackPromptActions(
  conversation: WhatsAppConversationState
): WhatsAppBotAction[] {
  return [
    {
      type: "BUTTONS",
      body: `Welcome back 👋

We've saved your Career Uttsav registration progress.

${resumeProgressContextLine(conversation)}

Would you like to continue where you left off?`,
      buttons: [
        {
          id: REGISTRATION_INTERACTIVE_IDS.CONTINUE,
          title: "Continue",
        },
        {
          id: REGISTRATION_INTERACTIVE_IDS.RESTART,
          title: "Start over",
        },
      ],
    },
  ];
}

function recentGreetingRepromptResult(
  conversation: WhatsAppConversationState,
  seminarOptions: SeminarOption[],
  seminarDayCatalog: WhatsAppSeminarDayCatalog,
  completedRegistrationNumber?: string | null
): ConversationTurnResult {
  if (isLegacySeminarSelectionState(conversation)) {
    return migrateLegacySeminarFlow(conversation, seminarDayCatalog);
  }

  const staleRecovery = recoverIfStaleSeminarSelections(
    conversation,
    seminarDayCatalog
  );
  if (staleRecovery) {
    return staleRecovery;
  }

  return {
    conversation,
    actions: promptForStep(
      conversation.currentStep,
      seminarOptions,
      conversation,
      completedRegistrationNumber,
      seminarDayCatalog
    ),
    refreshExpiry: true,
  };
}

function isGreetingOrStartResumeMessage(
  text: string,
  interactiveId: string | undefined
): boolean {
  return (
    (text !== "" && isGreetingText(text)) ||
    interactiveId === REGISTRATION_INTERACTIVE_IDS.START
  );
}

export function resumeProgressContextLine(
  conversation: WhatsAppConversationState
): string {
  if (conversation.status === "READY_TO_REGISTER") {
    const count = conversation.selectedSeminarIds.length;
    if (count === 1) {
      return "Seminars selected: 1";
    }
    if (count === 2) {
      return "Seminars selected: 2";
    }
    if (count >= WHATSAPP_SEMINAR_SELECTION_MAX) {
      return "Seminars selected: 3";
    }
    return "Next step: Complete registration";
  }

  switch (conversation.currentStep) {
    case "AWAITING_NAME":
      return "Next step: Full name";
    case "AWAITING_EMAIL":
      return "Next step: Email";
    case "AWAITING_CLASS":
      return "Next step: Class";
    case "AWAITING_GENDER":
      return "Next step: Gender";
    case "AWAITING_BOARD":
      return "Next step: Board";
    case "AWAITING_STREAM":
      return "Next step: Stream";
    case "AWAITING_COLLEGE":
      return "Next step: College";
    case "AWAITING_CITY":
      return "Next step: City";
    case "AWAITING_SEMINARS":
      return "Next step: Seminar selection";
    case "AWAITING_SEMINAR_FINISH": {
      const count = conversation.selectedSeminarIds.length;
      if (count === 1) {
        return "Seminars selected: 1";
      }
      if (count === 2) {
        return "Seminars selected: 2";
      }
      if (count >= WHATSAPP_SEMINAR_SELECTION_MAX) {
        return "Seminars selected: 3";
      }
      return "Next step: Finish registration";
    }
    default:
      return "Next step: Continue registration";
  }
}

function performRegistrationRestart(
  conversation: WhatsAppConversationState
): ConversationTurnResult {
  if (
    conversation.status === "COMPLETED" &&
    conversation.completedRegistrationId
  ) {
    return {
      conversation,
      actions: completedCancelBlockedActions(),
      refreshExpiry: false,
    };
  }

  const reset = resetConversationAnswers(conversation);
  return {
    conversation: reset,
    actions: [
      {
        type: "TEXT",
        body: "Let's start again. Please enter your full name.",
      },
    ],
    refreshExpiry: true,
    resetReminderTracking: true,
  };
}

export function buildInvalidSeminarRecoveryResult(
  conversation: WhatsAppConversationState,
  seminarDayCatalog: WhatsAppSeminarDayCatalog
): ConversationTurnResult {
  return {
    conversation: {
      ...conversation,
      status: "ACTIVE",
      currentStep: "AWAITING_SEMINARS",
      selectedSeminarIds: [],
    },
    actions: [
      { type: "TEXT", body: WHATSAPP_STALE_SEMINAR_RECOVERY_MESSAGE },
      ...combinedSeminarSelectionActions(seminarDayCatalog),
    ],
    refreshExpiry: true,
  };
}

function recoverIfStaleSeminarSelections(
  conversation: WhatsAppConversationState,
  seminarDayCatalog: WhatsAppSeminarDayCatalog
): ConversationTurnResult | null {
  if (
    conversation.currentStep !== "AWAITING_SEMINAR_FINISH" &&
    conversation.currentStep !== "READY_TO_REGISTER"
  ) {
    return null;
  }

  if (conversation.selectedSeminarIds.length === 0) {
    return null;
  }

  if (
    selectedSeminarsStillValidInCatalog(
      conversation.selectedSeminarIds,
      seminarDayCatalog
    )
  ) {
    return null;
  }

  return buildInvalidSeminarRecoveryResult(conversation, seminarDayCatalog);
}

export function expiredSessionNoticeAction(): WhatsAppBotAction {
  return {
    type: "TEXT",
    body: "Your previous registration session expired, so we'll start a fresh one.",
  };
}

function classListActions(): WhatsAppBotAction[] {
  return [
    {
      type: "LIST",
      body: "Please select your class.",
      buttonText: "Select Class",
      sections: [
        {
          title: "Class",
          rows: REGISTRATION_CLASS_OPTIONS.map((classLabel) => ({
            id: classInteractiveId(classLabel),
            title: classLabel,
          })),
        },
      ],
    },
  ];
}

function genderButtonActions(): WhatsAppBotAction[] {
  return [
    {
      type: "BUTTONS",
      body: "Please select your gender.",
      buttons: WHATSAPP_GENDER_OPTIONS.map((gender) => ({
        id: genderInteractiveId(gender),
        title: gender,
      })),
    },
  ];
}

function boardListActions(): WhatsAppBotAction[] {
  return [
    {
      type: "LIST",
      body: "Please select your board.",
      buttonText: "Select Board",
      sections: [
        {
          title: "Board",
          rows: REGISTRATION_BOARD_OPTIONS.map((board) => ({
            id: boardInteractiveId(board),
            title: board,
          })),
        },
      ],
    },
  ];
}

function streamButtonActions(): WhatsAppBotAction[] {
  return [
    {
      type: "BUTTONS",
      body: "Please select your stream / interest.",
      buttons: REGISTRATION_STREAM_OPTIONS.map((stream) => ({
        id: streamInteractiveId(stream),
        title: stream,
      })),
    },
  ];
}

export function seminarListPageForSeminar(
  seminarOptions: SeminarOption[],
  seminarId: string
): number {
  if (seminarOptions.length <= WHATSAPP_SEMINAR_LIST_ROW_LIMIT) {
    return 0;
  }

  const index = seminarOptions.findIndex((seminar) => seminar.id === seminarId);
  if (index < 0) {
    return 0;
  }

  return Math.floor(index / WHATSAPP_SEMINAR_LIST_PAGE_SIZE);
}

function toSeminarListRow(
  seminar: SeminarOption,
  globalIndex: number,
  selectedSeminarIds: string[]
): WhatsAppBotListRow {
  const { title, description } = formatNumberedSeminarListRow({
    displayNumber: globalIndex + 1,
    fullTitle: seminar.title,
    selected: selectedSeminarIds.includes(seminar.id),
  });

  return {
    id: seminarInteractiveId(seminar.id),
    title,
    description,
  };
}

export function buildSeminarListRows(
  seminarOptions: SeminarOption[],
  selectedSeminarIds: string[],
  listPage = 0
): WhatsAppBotListRow[] {
  if (seminarOptions.length <= WHATSAPP_SEMINAR_LIST_ROW_LIMIT) {
    return seminarOptions.map((seminar, index) =>
      toSeminarListRow(seminar, index, selectedSeminarIds)
    );
  }

  const totalPages = Math.ceil(
    seminarOptions.length / WHATSAPP_SEMINAR_LIST_PAGE_SIZE
  );
  const safePage = Math.min(Math.max(listPage, 0), totalPages - 1);
  const start = safePage * WHATSAPP_SEMINAR_LIST_PAGE_SIZE;
  const pageSeminars = seminarOptions.slice(
    start,
    start + WHATSAPP_SEMINAR_LIST_PAGE_SIZE
  );

  const rows: WhatsAppBotListRow[] = pageSeminars.map((seminar, pageIndex) =>
    toSeminarListRow(seminar, start + pageIndex, selectedSeminarIds)
  );

  if (safePage > 0) {
    rows.push({
      id: seminarPageInteractiveId(safePage - 1),
      title: "← Previous",
    });
  }
  if (safePage < totalPages - 1) {
    rows.push({
      id: seminarPageInteractiveId(safePage + 1),
      title: "More seminars →",
    });
  }

  return rows.slice(0, WHATSAPP_SEMINAR_LIST_ROW_LIMIT);
}

function seminarTitleForOption(
  seminarOptions: SeminarOption[],
  seminarId: string
): string {
  return seminarOptions.find((seminar) => seminar.id === seminarId)?.title ?? "";
}

function seminarTitlesForIds(
  seminarOptions: SeminarOption[],
  selectedSeminarIds: string[]
): string[] {
  return selectedSeminarIds.map((seminarId) =>
    seminarTitleForOption(seminarOptions, seminarId)
  );
}

function seminarFinishButtonActions(
  body: string = WHATSAPP_SEMINAR_FINISH_PROMPT
): WhatsAppBotAction[] {
  return [
    {
      type: "BUTTONS",
      body,
      buttons: [
        {
          id: REGISTRATION_INTERACTIVE_IDS.FINISH,
          title: "Finish registration",
        },
      ],
    },
  ];
}

function seminarFinishReminderButtonActions(): WhatsAppBotAction[] {
  return seminarFinishButtonActions(WHATSAPP_SEMINAR_FINISH_ALREADY_SAVED_PROMPT);
}

function isLegacySeminarSelectionState(
  conversation: WhatsAppConversationState
): boolean {
  return (
    conversation.currentStep === "AWAITING_SEMINARS" &&
    conversation.selectedSeminarIds.length > 0
  );
}

function migrateLegacySeminarFlow(
  conversation: WhatsAppConversationState,
  seminarDayCatalog: WhatsAppSeminarDayCatalog
): ConversationTurnResult {
  return {
    conversation: {
      ...conversation,
      status: "ACTIVE",
      currentStep: "AWAITING_SEMINARS",
      selectedSeminarIds: [],
    },
    actions: [
      {
        type: "TEXT",
        body: WHATSAPP_LEGACY_SEMINAR_MIGRATION_MESSAGE,
      },
      ...combinedSeminarSelectionActions(seminarDayCatalog),
    ],
    refreshExpiry: true,
  };
}

function transitionToSeminarFinish(
  conversation: WhatsAppConversationState,
  seminarIds: string[]
): ConversationTurnResult {
  return {
    conversation: {
      ...conversation,
      status: "ACTIVE",
      currentStep: "AWAITING_SEMINAR_FINISH",
      selectedSeminarIds: seminarIds,
    },
    actions: seminarFinishButtonActions(),
    refreshExpiry: true,
  };
}

function transitionToReadyToRegisterAfterFinish(
  conversation: WhatsAppConversationState,
  seminarOptions: SeminarOption[],
  seminarDayCatalog: WhatsAppSeminarDayCatalog
): ConversationTurnResult {
  return {
    conversation: {
      ...conversation,
      status: "READY_TO_REGISTER",
      currentStep: "READY_TO_REGISTER",
    },
    actions: [
      {
        type: "TEXT",
        body: buildSeminarFinishSummaryBody(
          seminarDayCatalog,
          conversation.selectedSeminarIds,
          seminarOptions
        ),
      },
    ],
    refreshExpiry: true,
  };
}

function alreadyRegisteredActions(
  registrationNumber?: string | null
): WhatsAppBotAction[] {
  const actions: WhatsAppBotAction[] = [
    {
      type: "TEXT",
      body: "You're already registered for Career Uttsav.",
    },
  ];
  if (registrationNumber) {
    actions.push({
      type: "TEXT",
      body: `Registration Number:\n${registrationNumber}`,
    });
  }
  return actions;
}

function promptForStep(
  step: WhatsAppConversationStep,
  seminarOptions: SeminarOption[],
  conversation: WhatsAppConversationState,
  completedRegistrationNumber?: string | null,
  seminarDayCatalog?: WhatsAppSeminarDayCatalog
): WhatsAppBotAction[] {
  switch (step) {
    case "AWAITING_START":
      return welcomeActions();
    case "AWAITING_NAME":
      return [{ type: "TEXT", body: "*What is your full name?*" }];
    case "AWAITING_EMAIL":
      return [
        {
          type: "TEXT",
          body: "Please enter your email address.",
        },
      ];
    case "AWAITING_CLASS":
      return classListActions();
    case "AWAITING_GENDER":
      return genderButtonActions();
    case "AWAITING_BOARD":
      return boardListActions();
    case "AWAITING_STREAM":
      return streamButtonActions();
    case "AWAITING_COLLEGE":
      return [
        {
          type: "TEXT",
          body: "Please enter your school or college name.",
        },
      ];
    case "AWAITING_CITY":
      return [{ type: "TEXT", body: WHATSAPP_CITY_PROMPT }];
    case "AWAITING_SEMINARS":
      return seminarDayCatalog
        ? combinedSeminarSelectionActions(seminarDayCatalog)
        : [];
    case "AWAITING_SEMINAR_FINISH":
      return seminarFinishButtonActions();
    case "READY_TO_REGISTER":
      return [];
    case "COMPLETED":
      return alreadyRegisteredActions(completedRegistrationNumber);
    case "CANCELLED":
      return cancelledActions();
    default:
      return [];
  }
}

function withStep(
  conversation: WhatsAppConversationState,
  step: WhatsAppConversationStep,
  seminarOptions: SeminarOption[],
  refreshExpiry = true,
  completedRegistrationNumber?: string | null,
  seminarDayCatalog?: WhatsAppSeminarDayCatalog
): ConversationTurnResult {
  const next: WhatsAppConversationState = {
    ...conversation,
    currentStep: step,
    status:
      step === "READY_TO_REGISTER"
        ? "READY_TO_REGISTER"
        : step === "COMPLETED"
          ? "COMPLETED"
          : step === "CANCELLED"
            ? "CANCELLED"
            : "ACTIVE",
  };
  return {
    conversation: next,
    actions: promptForStep(
      step,
      seminarOptions,
      next,
      completedRegistrationNumber,
      seminarDayCatalog
    ),
    refreshExpiry,
  };
}

function handleGlobalControls(
  conversation: WhatsAppConversationState,
  message: IncomingConversationMessage,
  seminarOptions: SeminarOption[],
  seminarDayCatalog: WhatsAppSeminarDayCatalog,
  completedRegistrationNumber?: string | null,
  previousActivityAt?: Date | null
): ConversationTurnResult | null {
  const text = message.text?.trim() ?? "";
  const interactiveId = message.interactiveId;

  if (
    interactiveId === REGISTRATION_INTERACTIVE_IDS.CANCEL ||
    (text && isCancelText(text))
  ) {
    if (
      conversation.status === "COMPLETED" &&
      conversation.completedRegistrationId
    ) {
      return {
        conversation,
        actions: completedCancelBlockedActions(),
        refreshExpiry: false,
      };
    }

    return {
      conversation: {
        ...conversation,
        status: "CANCELLED",
        currentStep: "CANCELLED",
      },
      actions: cancelledActions(),
      refreshExpiry: true,
    };
  }

  if (interactiveId === REGISTRATION_INTERACTIVE_IDS.RESTART) {
    if (conversation.status === "COMPLETED") {
      return {
        conversation,
        actions: promptForStep(
          conversation.currentStep,
          seminarOptions,
          conversation,
          completedRegistrationNumber
        ),
        refreshExpiry: false,
      };
    }
    return performRegistrationRestart(conversation);
  }

  if (text && isRestartRegistrationText(text)) {
    return performRegistrationRestart(conversation);
  }

  if (interactiveId === REGISTRATION_INTERACTIVE_IDS.CONTINUE) {
    if (isLegacySeminarSelectionState(conversation)) {
      return migrateLegacySeminarFlow(conversation, seminarDayCatalog);
    }

    const staleRecovery = recoverIfStaleSeminarSelections(
      conversation,
      seminarDayCatalog
    );
    if (staleRecovery) {
      return staleRecovery;
    }

    return {
      conversation,
      actions: promptForStep(
        conversation.currentStep,
        seminarOptions,
        conversation,
        completedRegistrationNumber,
        seminarDayCatalog
      ),
      refreshExpiry: true,
    };
  }

  if (conversation.status === "CANCELLED") {
    if (interactiveId === REGISTRATION_INTERACTIVE_IDS.START) {
      const reset = createInitialConversationState(conversation.waId);
      return beginNameStep(reset, seminarOptions);
    }
    if (text && isGreetingText(text)) {
      const reset = createInitialConversationState(conversation.waId);
      return {
        conversation: reset,
        actions: welcomeActions(),
        refreshExpiry: true,
      };
    }
    return {
      conversation,
      actions: welcomeActions(),
      refreshExpiry: false,
    };
  }

  if (
    conversation.status === "ACTIVE" &&
    conversation.currentStep !== "AWAITING_START" &&
    isGreetingOrStartResumeMessage(text, interactiveId)
  ) {
    const staleRecovery = recoverIfStaleSeminarSelections(
      conversation,
      seminarDayCatalog
    );
    if (staleRecovery) {
      return staleRecovery;
    }

    if (conversation.currentStep === "AWAITING_SEMINAR_FINISH") {
      return {
        conversation,
        actions: seminarFinishReminderButtonActions(),
        refreshExpiry: true,
      };
    }

    if (isReturningUserInactivity(previousActivityAt)) {
      return {
        conversation,
        actions: buildWelcomeBackPromptActions(conversation),
        refreshExpiry: true,
      };
    }
    return recentGreetingRepromptResult(
      conversation,
      seminarOptions,
      seminarDayCatalog,
      completedRegistrationNumber
    );
  }

  if (
    conversation.status === "READY_TO_REGISTER" ||
    conversation.status === "COMPLETED"
  ) {
    if (conversation.status === "READY_TO_REGISTER") {
      const staleRecovery = recoverIfStaleSeminarSelections(
        conversation,
        seminarDayCatalog
      );
      if (staleRecovery) {
        return staleRecovery;
      }
    }

    if (
      conversation.status === "COMPLETED" &&
      isGreetingOrStartResumeMessage(text, interactiveId)
    ) {
      return {
        conversation,
        actions: alreadyRegisteredActions(completedRegistrationNumber),
        refreshExpiry: false,
      };
    }

    if (
      conversation.status === "READY_TO_REGISTER" &&
      isGreetingOrStartResumeMessage(text, interactiveId) &&
      isReturningUserInactivity(previousActivityAt)
    ) {
      return {
        conversation,
        actions: buildWelcomeBackPromptActions(conversation),
        refreshExpiry: true,
      };
    }

    return {
      conversation,
      actions: promptForStep(
        conversation.currentStep,
        seminarOptions,
        conversation,
        completedRegistrationNumber,
        seminarDayCatalog
      ),
      refreshExpiry: true,
    };
  }

  return null;
}

export function processRegistrationConversationTurn(input: {
  conversation: WhatsAppConversationState | null;
  message: IncomingConversationMessage;
  seminarOptions: SeminarOption[];
  seminarDayCatalog: WhatsAppSeminarDayCatalog;
  waId: string;
  completedRegistrationNumber?: string | null;
  sessionExpired?: boolean;
  previousActivityAt?: Date | null;
}): ConversationTurnResult {
  const normalizedWaId = normalizeWaId(input.waId);
  const sessionExpired = input.sessionExpired ?? false;
  let conversation =
    input.conversation ?? createInitialConversationState(normalizedWaId);

  if (conversation.waId !== normalizedWaId) {
    conversation = { ...conversation, waId: normalizedWaId };
  }

  const text = input.message.text?.trim();
  const interactiveId = input.message.interactiveId;

  const global = handleGlobalControls(
    conversation,
    input.message,
    input.seminarOptions,
    input.seminarDayCatalog,
    input.completedRegistrationNumber,
    input.previousActivityAt
  );
  if (global) {
    return global;
  }

  if (conversation.currentStep === "AWAITING_START") {
    if (interactiveId === REGISTRATION_INTERACTIVE_IDS.START) {
      return beginNameStep(conversation, input.seminarOptions);
    }
    if (text && isGreetingText(text)) {
      const reset = createInitialConversationState(conversation.waId);
      const actions = welcomeActions();
      if (sessionExpired) {
        actions.unshift(expiredSessionNoticeAction());
      }
      return {
        conversation: reset,
        actions,
        refreshExpiry: true,
      };
    }
    const actions = welcomeActions();
    if (sessionExpired) {
      actions.unshift(expiredSessionNoticeAction());
    }
    return {
      conversation,
      actions,
      refreshExpiry: true,
    };
  }

  if (conversation.currentStep === "AWAITING_NAME") {
    if (!text || !isValidName(text)) {
      return {
        conversation,
        actions: [
          {
            type: "TEXT",
            body: "Please enter a valid name (at least 2 characters).",
          },
        ],
        refreshExpiry: false,
      };
    }
    return withStep(
      { ...conversation, studentName: text.trim() },
      "AWAITING_EMAIL",
      input.seminarOptions
    );
  }

  if (conversation.currentStep === "AWAITING_EMAIL") {
    if (!text || !isValidEmail(text)) {
      return {
        conversation,
        actions: [
          {
            type: "TEXT",
            body: "Please enter a valid email address.",
          },
        ],
        refreshExpiry: false,
      };
    }
    return withStep(
      { ...conversation, email: text.trim().toLowerCase() },
      "AWAITING_CLASS",
      input.seminarOptions
    );
  }

  if (conversation.currentStep === "AWAITING_CLASS") {
    const classLabel = interactiveId
      ? parseClassInteractiveId(interactiveId)
      : null;
    if (!classLabel) {
      return {
        conversation,
        actions: [
          {
            type: "TEXT",
            body: "Please choose your class from the list.",
          },
          ...classListActions(),
        ],
        refreshExpiry: false,
      };
    }
    return withStep(
      { ...conversation, classLabel },
      "AWAITING_GENDER",
      input.seminarOptions
    );
  }

  if (conversation.currentStep === "AWAITING_GENDER") {
    const gender = interactiveId ? parseGenderInteractiveId(interactiveId) : null;
    if (!gender) {
      return {
        conversation,
        actions: [
          {
            type: "TEXT",
            body: "Please choose Male or Female.",
          },
          ...genderButtonActions(),
        ],
        refreshExpiry: false,
      };
    }
    return withStep(
      { ...conversation, gender },
      "AWAITING_BOARD",
      input.seminarOptions
    );
  }

  if (conversation.currentStep === "AWAITING_BOARD") {
    const board = interactiveId ? parseBoardInteractiveId(interactiveId) : null;
    if (!board) {
      return {
        conversation,
        actions: [
          {
            type: "TEXT",
            body: "Please choose your board from the list.",
          },
          ...boardListActions(),
        ],
        refreshExpiry: false,
      };
    }
    return withStep(
      { ...conversation, board },
      "AWAITING_STREAM",
      input.seminarOptions
    );
  }

  if (conversation.currentStep === "AWAITING_STREAM") {
    const stream = interactiveId ? parseStreamInteractiveId(interactiveId) : null;
    if (!stream) {
      return {
        conversation,
        actions: [
          {
            type: "TEXT",
            body: "Please choose Science, Commerce, or Arts.",
          },
          ...streamButtonActions(),
        ],
        refreshExpiry: false,
      };
    }
    return withStep(
      { ...conversation, interestedStream: stream },
      "AWAITING_COLLEGE",
      input.seminarOptions
    );
  }

  if (conversation.currentStep === "AWAITING_COLLEGE") {
    if (!text || !isValidPlaceName(text)) {
      return {
        conversation,
        actions: [
          {
            type: "TEXT",
            body: "Please enter your school or college name.",
          },
        ],
        refreshExpiry: false,
      };
    }
    return withStep(
      { ...conversation, college: text.trim() },
      "AWAITING_CITY",
      input.seminarOptions
    );
  }

  if (conversation.currentStep === "AWAITING_CITY") {
    if (!text || !isValidPlaceName(text)) {
      return {
        conversation,
        actions: [{ type: "TEXT", body: WHATSAPP_CITY_PROMPT }],
        refreshExpiry: false,
      };
    }
    return {
      conversation: {
        ...conversation,
        city: text.trim(),
        status: "ACTIVE",
        currentStep: "AWAITING_SEMINARS",
      },
      actions: combinedSeminarSelectionActions(input.seminarDayCatalog),
      refreshExpiry: true,
    };
  }

  if (conversation.currentStep === "AWAITING_SEMINARS") {
    if (isLegacySeminarSelectionState(conversation)) {
      return migrateLegacySeminarFlow(conversation, input.seminarDayCatalog);
    }

    if (interactiveId && !text) {
      return {
        conversation,
        actions: seminarSelectionErrorActions("EMPTY_OR_MALFORMED"),
        refreshExpiry: false,
      };
    }

    if (!text) {
      return {
        conversation,
        actions: combinedSeminarSelectionActions(input.seminarDayCatalog),
        refreshExpiry: false,
      };
    }

    const parsed = parseSeminarSelectionInput(text, input.seminarDayCatalog);
    if (!parsed.ok) {
      return {
        conversation,
        actions: seminarSelectionErrorActions(parsed.error),
        refreshExpiry: false,
      };
    }

    return transitionToSeminarFinish(conversation, parsed.seminarIds);
  }

  if (conversation.currentStep === "AWAITING_SEMINAR_FINISH") {
    const staleRecovery = recoverIfStaleSeminarSelections(
      conversation,
      input.seminarDayCatalog
    );
    if (staleRecovery) {
      return staleRecovery;
    }

    if (
      isFinishSeminarInteractiveId(interactiveId) ||
      (text && isFinishRegistrationText(text))
    ) {
      return transitionToReadyToRegisterAfterFinish(
        conversation,
        input.seminarOptions,
        input.seminarDayCatalog
      );
    }

    return {
      conversation,
      actions: seminarFinishReminderButtonActions(),
      refreshExpiry: false,
    };
  }

  return {
    conversation,
    actions: promptForStep(
      conversation.currentStep,
      input.seminarOptions,
      conversation,
      input.completedRegistrationNumber,
      input.seminarDayCatalog
    ),
    refreshExpiry: false,
  };
}

export function isSupportedConversationMessageType(type: string): boolean {
  return type === "text" || type === "interactive";
}
