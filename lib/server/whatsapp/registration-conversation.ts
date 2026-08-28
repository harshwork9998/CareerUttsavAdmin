import {
  MAX_SEMINAR_INTERESTS,
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
  parseStreamInteractiveId,
  seminarInteractiveId,
  streamInteractiveId,
} from "@/lib/server/whatsapp/registration-interactive-ids";

export const WHATSAPP_CONVERSATION_TTL_MS = 24 * 60 * 60 * 1000;

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

function welcomeActions(): WhatsAppBotAction[] {
  return [
    {
      type: "TEXT",
      body: `👋 Welcome to Career Uttsav!

Career Uttsav is a career discovery platform for students after 10th & 12th, helping you explore the right courses, careers, institutions, and opportunities for your future.

Let's get you registered for the event. It'll only take a minute.`,
    },
    {
      type: "BUTTONS",
      body: "Let's get you registered.",
      buttons: [
        {
          id: REGISTRATION_INTERACTIVE_IDS.START,
          title: "Start Registration",
        },
      ],
    },
  ];
}

function resumePromptActions(): WhatsAppBotAction[] {
  return [
    {
      type: "BUTTONS",
      body: "You already have a registration in progress.",
      buttons: [
        {
          id: REGISTRATION_INTERACTIVE_IDS.CONTINUE,
          title: "Continue",
        },
        {
          id: REGISTRATION_INTERACTIVE_IDS.RESTART,
          title: "Start Again",
        },
      ],
    },
  ];
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

function seminarSelectionActions(
  seminarOptions: SeminarOption[],
  selectedSeminarIds: string[]
): WhatsAppBotAction[] {
  const available = seminarOptions.filter(
    (seminar) => !selectedSeminarIds.includes(seminar.id)
  );

  const actions: WhatsAppBotAction[] = [];

  if (selectedSeminarIds.length === 0) {
    actions.push({
      type: "TEXT",
      body: "Please select at least one seminar interest.",
    });
  } else {
    actions.push({
      type: "TEXT",
      body: `You have selected ${selectedSeminarIds.length} seminar${
        selectedSeminarIds.length === 1 ? "" : "s"
      }.`,
    });
  }

  if (available.length > 0 && selectedSeminarIds.length < MAX_SEMINAR_INTERESTS) {
    actions.push({
      type: "LIST",
      body: "Choose a seminar interest.",
      buttonText: "Select Seminar",
      sections: [
        {
          title: "Seminars",
          rows: available.map((seminar) => ({
            id: seminarInteractiveId(seminar.id),
            title: seminar.title,
          })),
        },
      ],
    });
  }

  if (selectedSeminarIds.length > 0) {
    actions.push({
      type: "BUTTONS",
      body: "When you are done selecting seminars, finish registration.",
      buttons: [
        {
          id: REGISTRATION_INTERACTIVE_IDS.FINISH,
          title: "Finish Registration",
        },
      ],
    });
  }

  return actions;
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
      return [{ type: "TEXT", body: "What is your full name?" }];
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
      return welcomeActions();
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
  completedRegistrationNumber?: string | null
): ConversationTurnResult | null {
  const text = message.text?.trim() ?? "";
  const interactiveId = message.interactiveId;

  if (
    interactiveId === REGISTRATION_INTERACTIVE_IDS.CANCEL ||
    (text && isCancelText(text))
  ) {
    return withStep(
      { ...conversation, status: "CANCELLED" },
      "CANCELLED",
      seminarOptions
    );
  }

  if (interactiveId === REGISTRATION_INTERACTIVE_IDS.RESTART) {
    if (
      conversation.status === "READY_TO_REGISTER" ||
      conversation.status === "COMPLETED"
    ) {
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
    const reset = resetConversationAnswers(conversation);
    return {
      conversation: reset,
      actions: [{ type: "TEXT", body: "Let's start again. Please enter your full name." }],
      refreshExpiry: true,
    };
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
      return withStep(reset, "AWAITING_NAME", seminarOptions);
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
    ((text && isGreetingText(text)) ||
      interactiveId === REGISTRATION_INTERACTIVE_IDS.START)
  ) {
    return {
      conversation,
      actions: resumePromptActions(),
      refreshExpiry: false,
    };
  }

  if (
    conversation.status === "READY_TO_REGISTER" ||
    conversation.status === "COMPLETED"
  ) {
    if (
      conversation.status === "COMPLETED" &&
      ((text && isGreetingText(text)) ||
        interactiveId === REGISTRATION_INTERACTIVE_IDS.START)
    ) {
      return {
        conversation,
        actions: alreadyRegisteredActions(completedRegistrationNumber),
        refreshExpiry: false,
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
      refreshExpiry: false,
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
}): ConversationTurnResult {
  const normalizedWaId = normalizeWaId(input.waId);
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
    input.completedRegistrationNumber
  );
  if (global) {
    return global;
  }

  if (conversation.currentStep === "AWAITING_START") {
    if (interactiveId === REGISTRATION_INTERACTIVE_IDS.START) {
      return withStep(conversation, "AWAITING_NAME", input.seminarOptions);
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
    if (interactiveId === REGISTRATION_INTERACTIVE_IDS.FINISH) {
      if (conversation.selectedSeminarIds.length === 0) {
        return {
          conversation,
          actions: [
            {
              type: "TEXT",
              body: "Please select at least one seminar before finishing.",
            },
            ...seminarSelectionActions(
              input.seminarOptions,
              conversation.selectedSeminarIds
            ),
          ],
          refreshExpiry: false,
        };
      }
      return withStep(
        conversation,
        "READY_TO_REGISTER",
        input.seminarOptions
      );
    }

    const seminarId = interactiveId
      ? parseSeminarInteractiveId(interactiveId)
      : null;
    if (!seminarId) {
      return {
        conversation,
        actions: seminarSelectionActions(
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
          ...seminarSelectionActions(
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
        actions: seminarSelectionActions(
          input.seminarOptions,
          conversation.selectedSeminarIds
        ),
        refreshExpiry: false,
      };
    }

    if (conversation.selectedSeminarIds.length >= MAX_SEMINAR_INTERESTS) {
      return {
        conversation,
        actions: [
          {
            type: "TEXT",
            body: `You can select at most ${MAX_SEMINAR_INTERESTS} seminars.`,
          },
          ...seminarSelectionActions(
            input.seminarOptions,
            conversation.selectedSeminarIds
          ),
        ],
        refreshExpiry: false,
      };
    }

    const updated = {
      ...conversation,
      selectedSeminarIds: [...conversation.selectedSeminarIds, seminarId],
    };
    return {
      conversation: updated,
      actions: seminarSelectionActions(
        input.seminarOptions,
        updated.selectedSeminarIds
      ),
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
