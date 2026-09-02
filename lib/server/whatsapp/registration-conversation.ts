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

export const WHATSAPP_CONVERSATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const WHATSAPP_RESUME_INACTIVITY_MS = 30 * 60 * 1000;
export const WHATSAPP_SEMINAR_LIST_ROW_LIMIT = 10;
export const WHATSAPP_SEMINAR_LIST_PAGE_SIZE = 8;
export const WHATSAPP_SEMINAR_SELECTION_MIN = 1;
export const WHATSAPP_SEMINAR_SELECTION_MAX = 3;
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
  completedRegistrationNumber?: string | null
): ConversationTurnResult {
  return {
    conversation,
    actions: promptForStep(
      conversation.currentStep,
      seminarOptions,
      conversation,
      completedRegistrationNumber
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
    case "AWAITING_SEMINARS": {
      const count = conversation.selectedSeminarIds.length;
      if (count === 1) {
        return "Seminars selected: 1";
      }
      if (count === 2) {
        return "Seminars selected: 2";
      }
      return "Next step: Seminar selection";
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
  };
}

export function buildInvalidSeminarRecoveryResult(
  conversation: WhatsAppConversationState,
  seminarOptions: SeminarOption[],
  validSeminarIds: string[]
): ConversationTurnResult {
  const repairedConversation: WhatsAppConversationState = {
    ...conversation,
    status: "ACTIVE",
    currentStep: "AWAITING_SEMINARS",
    selectedSeminarIds: validSeminarIds,
  };

  const recoveryMessage =
    validSeminarIds.length > 0
      ? `One of your selected seminars is no longer available.

We've kept your other selections. Please choose from the current seminars.`
      : `Your previously selected seminar is no longer available.

Please choose from the current seminars.`;

  const followUpActions =
    validSeminarIds.length === 0
      ? seminarFirstPickListActions(seminarOptions)
      : validSeminarIds.length === 1
        ? seminarDecisionActions(
            1,
            seminarTitlesForIds(seminarOptions, validSeminarIds),
            "Choose another"
          )
        : seminarDecisionActions(
            2,
            seminarTitlesForIds(seminarOptions, validSeminarIds),
            "Choose one more"
          );

  return {
    conversation: repairedConversation,
    actions: [{ type: "TEXT", body: recoveryMessage }, ...followUpActions],
    refreshExpiry: true,
  };
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

function seminarSelectionIntroBody(): string {
  return `Choose up to 3 seminars you'd like to attend.

Start by choosing your first seminar 👇`;
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

function seminarFirstPickListActions(
  seminarOptions: SeminarOption[],
  listPage = 0
): WhatsAppBotAction[] {
  return [
    {
      type: "LIST",
      body: seminarSelectionIntroBody(),
      buttonText: "Select Seminar",
      sections: [
        {
          title: "Seminars",
          rows: buildSeminarListRows(seminarOptions, [], listPage),
        },
      ],
    },
  ];
}

function seminarRemainingListActions(
  seminarOptions: SeminarOption[],
  selectedSeminarIds: string[],
  listPage = 0
): WhatsAppBotAction[] {
  const remaining = remainingSeminarOptions(seminarOptions, selectedSeminarIds);
  if (remaining.length === 0) {
    return seminarDecisionActions(
      selectedSeminarIds.length === 1 ? 1 : 2,
      seminarTitlesForIds(seminarOptions, selectedSeminarIds),
      selectedSeminarIds.length === 1 ? "Choose another" : "Choose one more"
    );
  }

  return [
    {
      type: "LIST",
      body: "Choose your next seminar 👇",
      buttonText: "Select Seminar",
      sections: [
        {
          title: "Seminars",
          rows: buildSeminarListRows(remaining, [], listPage),
        },
      ],
    },
  ];
}

function seminarDecisionActions(
  count: 1 | 2,
  selectedTitles: string[],
  chooseAnotherLabel: string
): WhatsAppBotAction[] {
  const summaryBody =
    count === 1
      ? `✅ *1 seminar selected*

${selectedTitles[0]}

Would you like to choose another seminar or finish your registration?`
      : `✅ *2 seminars selected*

1. ${selectedTitles[0]}
2. ${selectedTitles[1]}

You can choose one more seminar or finish your registration.`;

  return [
    {
      type: "BUTTONS",
      body: summaryBody,
      buttons: [
        {
          id: REGISTRATION_INTERACTIVE_IDS.CHOOSE_ANOTHER,
          title: chooseAnotherLabel,
        },
        {
          id: REGISTRATION_INTERACTIVE_IDS.FINISH,
          title: "Finish registration",
        },
      ],
    },
  ];
}

function threeSeminarAutoCompleteBody(selectedTitles: string[]): string {
  return `✅ *3 seminars selected*

1. ${selectedTitles[0]}
2. ${selectedTitles[1]}
3. ${selectedTitles[2]}

Your seminar preferences are saved. Completing your registration...`;
}

function zeroSeminarFinishActions(
  seminarOptions: SeminarOption[]
): WhatsAppBotAction[] {
  return [
    {
      type: "TEXT",
      body: "Please choose at least one seminar before completing your registration.",
    },
    ...seminarFirstPickListActions(seminarOptions),
  ];
}

const DUPLICATE_SEMINAR_MESSAGE = `✅ You've already selected that seminar.

Please choose another one or finish your registration.`;

function seminarSelectionActionsForCount(
  seminarOptions: SeminarOption[],
  selectedSeminarIds: string[],
  listPage = 0
): WhatsAppBotAction[] {
  const count = selectedSeminarIds.length;
  if (count === 0) {
    return seminarFirstPickListActions(seminarOptions, listPage);
  }
  if (count >= WHATSAPP_SEMINAR_SELECTION_MAX) {
    return [];
  }
  return seminarDecisionActions(
    count === 1 ? 1 : 2,
    seminarTitlesForIds(seminarOptions, selectedSeminarIds),
    count === 1 ? "Choose another" : "Choose one more"
  );
}

function transitionToReadyToRegister(
  conversation: WhatsAppConversationState,
  seminarOptions: SeminarOption[]
): ConversationTurnResult {
  return withStep(conversation, "READY_TO_REGISTER", seminarOptions);
}

function transitionToReadyToRegisterAfterThirdSelection(
  conversation: WhatsAppConversationState,
  seminarOptions: SeminarOption[]
): ConversationTurnResult {
  const selectedTitles = seminarTitlesForIds(
    seminarOptions,
    conversation.selectedSeminarIds
  );
  return {
    conversation: {
      ...conversation,
      status: "READY_TO_REGISTER",
      currentStep: "READY_TO_REGISTER",
    },
    actions: [
      {
        type: "TEXT",
        body: threeSeminarAutoCompleteBody(selectedTitles),
      },
    ],
    refreshExpiry: true,
  };
}

function duplicateSeminarSelectionActions(
  conversation: WhatsAppConversationState,
  seminarOptions: SeminarOption[]
): WhatsAppBotAction[] {
  const count = conversation.selectedSeminarIds.length;
  if (count === 0) {
    return [
      { type: "TEXT", body: DUPLICATE_SEMINAR_MESSAGE },
      ...seminarFirstPickListActions(seminarOptions),
    ];
  }
  if (count >= WHATSAPP_SEMINAR_SELECTION_MAX) {
    return [
      {
        type: "TEXT",
        body: threeSeminarAutoCompleteBody(
          seminarTitlesForIds(seminarOptions, conversation.selectedSeminarIds)
        ),
      },
    ];
  }
  return [
    { type: "TEXT", body: DUPLICATE_SEMINAR_MESSAGE },
    ...seminarDecisionActions(
      count === 1 ? 1 : 2,
      seminarTitlesForIds(seminarOptions, conversation.selectedSeminarIds),
      count === 1 ? "Choose another" : "Choose one more"
    ),
  ];
}

function seminarSelectionActions(
  seminarOptions: SeminarOption[],
  selectedSeminarIds: string[],
  listPage = 0
): WhatsAppBotAction[] {
  return seminarSelectionActionsForCount(
    seminarOptions,
    selectedSeminarIds,
    listPage
  );
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
  completedRegistrationNumber?: string | null
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
      return [{ type: "TEXT", body: "Please enter your city." }];
    case "AWAITING_SEMINARS":
      return seminarSelectionActions(
        seminarOptions,
        conversation.selectedSeminarIds
      );
    case "READY_TO_REGISTER":
      return [
        {
          type: "TEXT",
          body: "Your registration details are ready. We will complete your registration shortly.",
        },
      ];
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
  completedRegistrationNumber?: string | null
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
    actions: promptForStep(step, seminarOptions, next, completedRegistrationNumber),
    refreshExpiry,
  };
}

function handleGlobalControls(
  conversation: WhatsAppConversationState,
  message: IncomingConversationMessage,
  seminarOptions: SeminarOption[],
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
    return {
      conversation,
      actions: promptForStep(
        conversation.currentStep,
        seminarOptions,
        conversation,
        completedRegistrationNumber
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
      completedRegistrationNumber
    );
  }

  if (
    conversation.status === "READY_TO_REGISTER" ||
    conversation.status === "COMPLETED"
  ) {
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
        completedRegistrationNumber
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
        actions: [{ type: "TEXT", body: "Please enter your city." }],
        refreshExpiry: false,
      };
    }
    return withStep(
      { ...conversation, city: text.trim() },
      "AWAITING_SEMINARS",
      input.seminarOptions
    );
  }

  if (conversation.currentStep === "AWAITING_SEMINARS") {
    const selectedCount = conversation.selectedSeminarIds.length;

    if (selectedCount >= WHATSAPP_SEMINAR_SELECTION_MAX) {
      return transitionToReadyToRegisterAfterThirdSelection(
        conversation,
        input.seminarOptions
      );
    }

    if (
      isFinishSeminarInteractiveId(interactiveId) ||
      (text && isFinishRegistrationText(text))
    ) {
      if (selectedCount === 0) {
        return {
          conversation,
          actions: zeroSeminarFinishActions(input.seminarOptions),
          refreshExpiry: false,
        };
      }
      return transitionToReadyToRegister(conversation, input.seminarOptions);
    }

    if (
      isChooseAnotherSeminarInteractiveId(interactiveId) ||
      (text && isChooseAnotherSeminarText(text))
    ) {
      if (selectedCount === 0) {
        return {
          conversation,
          actions: seminarFirstPickListActions(input.seminarOptions),
          refreshExpiry: false,
        };
      }
      return {
        conversation,
        actions: seminarRemainingListActions(
          input.seminarOptions,
          conversation.selectedSeminarIds
        ),
        refreshExpiry: false,
      };
    }

    const listPage = interactiveId
      ? parseSeminarPageInteractiveId(interactiveId)
      : null;
    if (listPage !== null) {
      return {
        conversation,
        actions:
          selectedCount === 0
            ? seminarFirstPickListActions(input.seminarOptions, listPage)
            : seminarRemainingListActions(
                input.seminarOptions,
                conversation.selectedSeminarIds,
                listPage
              ),
        refreshExpiry: false,
      };
    }

    const seminarId = interactiveId
      ? parseSeminarInteractiveId(interactiveId)
      : null;
    if (!seminarId) {
      return {
        conversation,
        actions: seminarSelectionActionsForCount(
          input.seminarOptions,
          conversation.selectedSeminarIds
        ),
        refreshExpiry: false,
      };
    }

    const seminarExists = input.seminarOptions.some(
      (seminar) => seminar.id === seminarId
    );
    if (!seminarExists) {
      return {
        conversation,
        actions: [
          {
            type: "TEXT",
            body: "That seminar is not available. Please choose another option.",
          },
          ...seminarSelectionActionsForCount(
            input.seminarOptions,
            conversation.selectedSeminarIds
          ),
        ],
        refreshExpiry: false,
      };
    }

    if (conversation.selectedSeminarIds.includes(seminarId)) {
      return {
        conversation,
        actions: duplicateSeminarSelectionActions(
          conversation,
          input.seminarOptions
        ),
        refreshExpiry: false,
      };
    }

    if (selectedCount >= WHATSAPP_SEMINAR_SELECTION_MAX) {
      return transitionToReadyToRegisterAfterThirdSelection(
        conversation,
        input.seminarOptions
      );
    }

    const updated = {
      ...conversation,
      selectedSeminarIds: [...conversation.selectedSeminarIds, seminarId],
    };
    const selectionCount = updated.selectedSeminarIds.length;
    const selectedTitles = seminarTitlesForIds(
      input.seminarOptions,
      updated.selectedSeminarIds
    );

    if (selectionCount >= WHATSAPP_SEMINAR_SELECTION_MAX) {
      return transitionToReadyToRegisterAfterThirdSelection(
        updated,
        input.seminarOptions
      );
    }

    if (selectionCount === 1) {
      return {
        conversation: updated,
        actions: seminarDecisionActions(1, selectedTitles, "Choose another"),
        refreshExpiry: true,
      };
    }

    return {
      conversation: updated,
      actions: seminarDecisionActions(2, selectedTitles, "Choose one more"),
      refreshExpiry: true,
    };
  }

  return {
    conversation,
    actions: promptForStep(
      conversation.currentStep,
      input.seminarOptions,
      conversation
    ),
    refreshExpiry: false,
  };
}

export function isSupportedConversationMessageType(type: string): boolean {
  return type === "text" || type === "interactive";
}
