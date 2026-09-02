import { describe, expect, it } from "vitest";

import {
  REGISTRATION_BOARD_OPTIONS,
  REGISTRATION_CLASS_OPTIONS,
} from "@/lib/server/whatsapp/registration-options";
import {
  REGISTRATION_INTERACTIVE_IDS,
  boardInteractiveId,
  classInteractiveId,
  genderInteractiveId,
  seminarInteractiveId,
  streamInteractiveId,
} from "@/lib/server/whatsapp/registration-interactive-ids";
import {
  META_BUTTON_TITLE_LIMIT,
  validateWhatsAppButtonAction,
} from "@/lib/server/whatsapp/meta-action-mapper";
import {
  WHATSAPP_CONVERSATION_TTL_MS,
  WHATSAPP_RESUME_INACTIVITY_MS,
  buildInvalidSeminarRecoveryResult,
  buildWelcomeBackPromptActions,
  computePreviousActivityAtFromExpiresAt,
  createInitialConversationState,
  isRestartRegistrationText,
  isReturningUserInactivity,
  processRegistrationConversationTurn,
  resolveConversationRefreshExpiry,
  resumeProgressContextLine,
  type SeminarOption,
  type WhatsAppConversationState,
} from "@/lib/server/whatsapp/registration-conversation";

const seminarOptions: SeminarOption[] = [
  { id: "sem-001", title: "AI Careers" },
  { id: "sem-002", title: "Design Thinking" },
  { id: "sem-003", title: "Startup Skills" },
];

const recentActivityAt = new Date(Date.now() - 10_000);
const returningActivityAt = new Date(
  Date.now() - WHATSAPP_RESUME_INACTIVITY_MS - 60_000
);

const readyConversation: WhatsAppConversationState = {
  waId: "919876543210",
  status: "READY_TO_REGISTER",
  currentStep: "READY_TO_REGISTER",
  studentName: "Aarav Sharma",
  email: "aarav@example.com",
  classLabel: "Class 10",
  gender: "Male",
  board: "CBSE",
  interestedStream: "Science",
  college: "National Public School",
  city: "Bangalore",
  selectedSeminarIds: ["sem-001", "sem-stale"],
  completedRegistrationId: null,
};

function turn(
  conversation: WhatsAppConversationState | null,
  message: { text?: string; interactiveId?: string },
  options: {
    waId?: string;
    completedRegistrationNumber?: string | null;
    sessionExpired?: boolean;
    seminarOptions?: SeminarOption[];
    previousActivityAt?: Date | null;
  } = {}
) {
  return processRegistrationConversationTurn({
    conversation,
    message,
    seminarOptions: options.seminarOptions ?? seminarOptions,
    waId: options.waId ?? "919876543210",
    completedRegistrationNumber: options.completedRegistrationNumber,
    sessionExpired: options.sessionExpired,
    previousActivityAt: options.previousActivityAt,
  });
}

function beginAtNameStep() {
  let state = turn(null, { text: "hi" }).conversation;
  return turn(state, {
    interactiveId: REGISTRATION_INTERACTIVE_IDS.START,
  }).conversation;
}

function advanceToEmailStep() {
  let conversation = beginAtNameStep();
  return turn(conversation, { text: "Aarav Sharma" }).conversation;
}

function advanceToCollegeStep() {
  let conversation = advanceToEmailStep();
  conversation = turn(conversation, { text: "aarav@example.com" }).conversation;
  conversation = turn(conversation, {
    interactiveId: classInteractiveId(REGISTRATION_CLASS_OPTIONS[0]!),
  }).conversation;
  conversation = turn(conversation, {
    interactiveId: genderInteractiveId("Male"),
  }).conversation;
  conversation = turn(conversation, {
    interactiveId: boardInteractiveId(REGISTRATION_BOARD_OPTIONS[0]!),
  }).conversation;
  return turn(conversation, {
    interactiveId: streamInteractiveId("Commerce"),
  }).conversation;
}

function advanceToCityStep() {
  return turn(advanceToCollegeStep(), {
    text: "VGS Public School",
  }).conversation;
}

function advanceToSeminarsStep(selectedIds: string[] = []) {
  let conversation = advanceToCityStep();
  conversation = turn(conversation, { text: "Bangalore" }).conversation;
  conversation = turn(conversation, { text: "show seminars" }).conversation;
  for (const seminarId of selectedIds) {
    conversation = turn(conversation, {
      interactiveId: seminarInteractiveId(seminarId),
    }).conversation;
  }
  return conversation;
}

describe("Stage 1.1 Meta button validation", () => {
  it("keeps welcome-back Continue button title within Meta limits", () => {
    const actions = buildWelcomeBackPromptActions(advanceToCollegeStep());
    const buttons = actions[0]?.type === "BUTTONS" ? actions[0].buttons : [];
    expect(buttons[0]?.title).toBe("Continue");
    expect(buttons[0]?.title.length).toBeLessThanOrEqual(META_BUTTON_TITLE_LIMIT);
  });

  it("passes actual Meta button validation for welcome-back actions", () => {
    const actions = buildWelcomeBackPromptActions(advanceToEmailStep());
    const buttonAction = actions[0];
    expect(buttonAction?.type).toBe("BUTTONS");
    if (buttonAction?.type !== "BUTTONS") return;
    expect(validateWhatsAppButtonAction(buttonAction).ok).toBe(true);
  });
});

describe("Stage 1.1 recent greeting re-prompt", () => {
  it("re-prompts college after recent hi without storing hi as college", () => {
    const conversation = advanceToCollegeStep();
    const result = turn(conversation, { text: "hi" }, { previousActivityAt: recentActivityAt });
    expect(result.conversation.currentStep).toBe("AWAITING_COLLEGE");
    expect(result.conversation.college).toBeNull();
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("Please enter your school or college name")
      )
    ).toBe(true);
    expect(
      result.actions.some((action) => action.type === "BUTTONS")
    ).toBe(false);
  });

  it("re-prompts email after recent hello without storing hello as email", () => {
    const conversation = advanceToEmailStep();
    const result = turn(conversation, { text: "hello" }, { previousActivityAt: recentActivityAt });
    expect(result.conversation.currentStep).toBe("AWAITING_EMAIL");
    expect(result.conversation.email).toBeNull();
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("Please enter your email address")
      )
    ).toBe(true);
  });

  it("re-prompts city after recent hi", () => {
    const conversation = advanceToCityStep();
    const result = turn(conversation, { text: "hi" }, { previousActivityAt: recentActivityAt });
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" && action.body.includes("Please enter your city")
      )
    ).toBe(true);
  });

  it("re-prompts seminar picker after recent hi with zero selections", () => {
    const conversation = advanceToSeminarsStep();
    const result = turn(conversation, { text: "hi" }, { previousActivityAt: recentActivityAt });
    expect(
      result.actions.some(
        (action) =>
          action.type === "LIST" &&
          action.body.includes("Choose up to 3 seminars")
      )
    ).toBe(true);
  });

  it("re-prompts one-selected seminar UX after recent hi", () => {
    const conversation = advanceToSeminarsStep(["sem-001"]);
    const result = turn(conversation, { text: "hi" }, { previousActivityAt: recentActivityAt });
    expect(
      result.actions.some(
        (action) =>
          action.type === "BUTTONS" &&
          action.body.includes("1 seminar selected")
      )
    ).toBe(true);
  });

  it("re-prompts two-selected seminar UX after recent hi", () => {
    const conversation = advanceToSeminarsStep(["sem-001", "sem-002"]);
    const result = turn(conversation, { text: "hi" }, { previousActivityAt: recentActivityAt });
    expect(
      result.actions.some(
        (action) =>
          action.type === "BUTTONS" &&
          action.body.includes("2 seminars selected")
      )
    ).toBe(true);
  });
});

describe("Stage 1.1 returning greeting welcome-back", () => {
  it("shows welcome-back after >=30 minutes of inactivity at college step", () => {
    const conversation = advanceToCollegeStep();
    const result = turn(conversation, { text: "hi" }, { previousActivityAt: returningActivityAt });
    expect(
      result.actions.some(
        (action) =>
          action.type === "BUTTONS" && action.body.includes("Welcome back")
      )
    ).toBe(true);
    expect(
      result.actions.some(
        (action) =>
          action.type === "BUTTONS" &&
          action.body.includes("Next step: College")
      )
    ).toBe(true);
  });

  it("preserves current step when Continue is chosen after welcome-back", () => {
    const conversation = advanceToCollegeStep();
    const welcome = turn(conversation, { text: "hi" }, { previousActivityAt: returningActivityAt });
    const continued = turn(welcome.conversation, {
      interactiveId: REGISTRATION_INTERACTIVE_IDS.CONTINUE,
    });
    expect(continued.conversation.currentStep).toBe("AWAITING_COLLEGE");
    expect(continued.conversation.interestedStream).toBe("Commerce");
  });
});

describe("Stage 1.1 direct answers after inactivity", () => {
  it("accepts a valid college answer after >=30 minutes without welcome-back", () => {
    const conversation = advanceToCollegeStep();
    const result = turn(
      conversation,
      { text: "VGS Public School" },
      { previousActivityAt: returningActivityAt }
    );
    expect(result.conversation.currentStep).toBe("AWAITING_CITY");
    expect(result.conversation.college).toBe("VGS Public School");
    expect(
      result.actions.some(
        (action) =>
          action.type === "BUTTONS" && action.body.includes("Welcome back")
      )
    ).toBe(false);
  });

  it("accepts a valid email after >=30 minutes without welcome-back", () => {
    const conversation = advanceToEmailStep();
    const result = turn(
      conversation,
      { text: "aarav@example.com" },
      { previousActivityAt: returningActivityAt }
    );
    expect(result.conversation.currentStep).toBe("AWAITING_CLASS");
    expect(result.conversation.email).toBe("aarav@example.com");
  });
});

describe("Stage 1.1 READY_TO_REGISTER and TTL helpers", () => {
  it("does not block READY_TO_REGISTER completion retry on recent greeting", () => {
    const result = turn(readyConversation, { text: "hi" }, { previousActivityAt: recentActivityAt });
    expect(result.conversation.status).toBe("READY_TO_REGISTER");
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("complete your registration shortly")
      )
    ).toBe(true);
    expect(
      result.actions.some(
        (action) =>
          action.type === "BUTTONS" && action.body.includes("Welcome back")
      )
    ).toBe(false);
  });

  it("still refreshes rolling expiry on recent greeting re-prompt", () => {
    const result = turn(advanceToCollegeStep(), { text: "hi" }, {
      previousActivityAt: recentActivityAt,
    });
    expect(result.refreshExpiry).toBe(true);
    expect(
      resolveConversationRefreshExpiry(result.conversation, result.refreshExpiry)
    ).toBe(true);
  });

  it("derives previous activity from pre-save expiresAt", () => {
    const expiresAt = new Date(Date.now() + WHATSAPP_CONVERSATION_TTL_MS);
    const previousActivityAt = computePreviousActivityAtFromExpiresAt(expiresAt);
    expect(Date.now() - previousActivityAt.getTime()).toBeLessThan(5_000);
    expect(isReturningUserInactivity(recentActivityAt)).toBe(false);
    expect(isReturningUserInactivity(returningActivityAt)).toBe(true);
  });
});

describe("Stage 1 restart and recovery regressions", () => {
  it("supports restart text during ACTIVE", () => {
    expect(isRestartRegistrationText("restart")).toBe(true);
    const conversation = advanceToEmailStep();
    const result = turn(conversation, { text: "restart" });
    expect(result.conversation.currentStep).toBe("AWAITING_NAME");
  });

  it("repairs invalid seminars without leaving READY_TO_REGISTER stuck", () => {
    const recovery = buildInvalidSeminarRecoveryResult(
      readyConversation,
      seminarOptions,
      ["sem-001"]
    );
    expect(recovery.conversation.status).toBe("ACTIVE");
    expect(recovery.conversation.currentStep).toBe("AWAITING_SEMINARS");
  });

  it("shows seminar context lines for welcome-back summaries", () => {
    expect(resumeProgressContextLine(advanceToEmailStep())).toBe("Next step: Email");
    expect(resumeProgressContextLine(advanceToSeminarsStep(["sem-001"]))).toBe(
      "Seminars selected: 1"
    );
  });
});

describe("Stage 1.1 completed-user behavior", () => {
  it("returns registration details for completed users", () => {
    const completed: WhatsAppConversationState = {
      ...createInitialConversationState("919876543210"),
      status: "COMPLETED",
      currentStep: "COMPLETED",
      completedRegistrationId: "reg-001",
    };
    const result = turn(
      completed,
      { text: "hello" },
      { completedRegistrationNumber: "CU-BLR-2026-00042" }
    );
    expect(result.conversation.status).toBe("COMPLETED");
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("CU-BLR-2026-00042")
      )
    ).toBe(true);
  });
});
