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
  streamInteractiveId,
} from "@/lib/server/whatsapp/registration-interactive-ids";
import {
  buildInvalidSeminarRecoveryResult,
  buildWelcomeBackPromptActions,
  isRestartRegistrationText,
  processRegistrationConversationTurn,
  resetConversationAnswers,
  resumeProgressContextLine,
  type SeminarOption,
  type WhatsAppConversationState,
} from "@/lib/server/whatsapp/registration-conversation";
import {
  WHATSAPP_STALE_SEMINAR_RECOVERY_MESSAGE,
  formatCombinedSeminarSelectionMessage,
} from "@/lib/server/whatsapp/whatsapp-seminar-day-catalog";
import {
  buildTestSeminarDayCatalog,
  buildTestSeminarOptions,
  seminarTurnContext,
} from "@/lib/server/whatsapp/whatsapp-seminar-test-fixtures";

const { seminarOptions, seminarDayCatalog } = seminarTurnContext();

function turn(
  conversation: WhatsAppConversationState | null,
  message: { text?: string; interactiveId?: string },
  options: SeminarOption[] = seminarOptions,
  catalog = seminarDayCatalog
) {
  return processRegistrationConversationTurn({
    conversation,
    message,
    seminarOptions: options,
    seminarDayCatalog: catalog,
    waId: "919876543210",
  });
}

function advanceToSeminarSelectionStep() {
  let conversation = turn(null, { text: "hi" }).conversation;
  conversation = turn(conversation, {
    interactiveId: REGISTRATION_INTERACTIVE_IDS.START,
  }).conversation;
  conversation = turn(conversation, { text: "Aarav Sharma" }).conversation;
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
  conversation = turn(conversation, {
    interactiveId: streamInteractiveId("Science"),
  }).conversation;
  conversation = turn(conversation, { text: "National Public School" }).conversation;
  return turn(conversation, { text: "Bangalore" }).conversation;
}

describe("WhatsApp comma-separated seminar flow", () => {
  it("shows the combined seminar list when entering seminar selection", () => {
    const result = turn(advanceToSeminarSelectionStep(), {
      interactiveId: REGISTRATION_INTERACTIVE_IDS.CONTINUE,
    });
    expect(result.conversation.currentStep).toBe("AWAITING_SEMINARS");
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("Seminar Preferences")
      )
    ).toBe(true);
  });

  it("moves to Finish Registration after a valid selection without auto-completing", () => {
    const conversation = advanceToSeminarSelectionStep();
    const result = turn(conversation, { text: "2,b" });
    expect(result.conversation.currentStep).toBe("AWAITING_SEMINAR_FINISH");
    expect(result.conversation.status).toBe("ACTIVE");
    expect(result.conversation.selectedSeminarIds).toEqual([
      "sem-d1-2",
      "sem-d2-2",
    ]);
    expect(
      result.actions.some(
        (action) =>
          action.type === "BUTTONS" &&
          action.buttons.some(
            (button) => button.id === REGISTRATION_INTERACTIVE_IDS.FINISH
          )
      )
    ).toBe(true);
  });

  it("shows grouped summary only after Finish Registration", () => {
    let conversation = advanceToSeminarSelectionStep();
    conversation = turn(conversation, { text: "1,2,b" }).conversation;
    const finished = turn(conversation, {
      interactiveId: REGISTRATION_INTERACTIVE_IDS.FINISH,
    });
    expect(finished.conversation.currentStep).toBe("READY_TO_REGISTER");
    expect(
      finished.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("Seminar preferences selected") &&
          action.body.includes("Day 1") &&
          action.body.includes("Day 2") &&
          action.body.includes("Completing your registration")
      )
    ).toBe(true);
    expect(
      finished.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("Your registration details are ready")
      )
    ).toBe(false);
  });

  it("resumes the combined seminar list before selection", () => {
    const conversation = advanceToSeminarSelectionStep();
    const resumed = turn(conversation, {
      interactiveId: REGISTRATION_INTERACTIVE_IDS.CONTINUE,
    });
    expect(resumed.conversation.currentStep).toBe("AWAITING_SEMINARS");
    expect(
      resumed.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("Seminar Preferences")
      )
    ).toBe(true);
  });

  it("resumes Finish Registration after a valid selection", () => {
    let conversation = advanceToSeminarSelectionStep();
    conversation = turn(conversation, { text: "2" }).conversation;
    const resumed = turn(conversation, {
      interactiveId: REGISTRATION_INTERACTIVE_IDS.CONTINUE,
    });
    expect(resumed.conversation.currentStep).toBe("AWAITING_SEMINAR_FINISH");
    expect(
      resumed.actions.some((action) => action.type === "BUTTONS")
    ).toBe(true);
  });

  it("re-prompts the correct seminar phase after a recent greeting", () => {
    let conversation = advanceToSeminarSelectionStep();
    conversation = turn(conversation, { text: "2" }).conversation;
    const result = turn(
      conversation,
      { text: "hi" },
      seminarOptions,
      seminarDayCatalog
    );
    expect(result.conversation.currentStep).toBe("AWAITING_SEMINAR_FINISH");
    expect(
      result.actions.some((action) => action.type === "BUTTONS")
    ).toBe(true);
  });

  it("preserves selections in welcome-back context", () => {
    const conversation = {
      ...advanceToSeminarSelectionStep(),
      selectedSeminarIds: ["sem-d1-2"],
      currentStep: "AWAITING_SEMINAR_FINISH" as const,
    };
    const actions = buildWelcomeBackPromptActions(conversation);
    expect(actions[0]?.type).toBe("BUTTONS");
    if (actions[0]?.type === "BUTTONS") {
      expect(actions[0].body).toContain("Seminars selected: 1");
    }
    expect(resumeProgressContextLine(conversation)).toBe("Seminars selected: 1");
  });

  it("clears seminar progress on restart", () => {
    let conversation = advanceToSeminarSelectionStep();
    conversation = turn(conversation, { text: "2,b" }).conversation;
    const restarted = turn(conversation, { text: "restart" });
    expect(isRestartRegistrationText("restart")).toBe(true);
    expect(restarted.conversation.selectedSeminarIds).toEqual([]);
    expect(restarted.conversation.currentStep).toBe("AWAITING_NAME");
    expect(resetConversationAnswers(restarted.conversation).selectedSeminarIds).toEqual(
      []
    );
  });

  it("migrates legacy AWAITING_SEMINARS selections safely", () => {
    const legacy = {
      ...advanceToSeminarSelectionStep(),
      selectedSeminarIds: ["sem-001", "sem-002"],
    };
    const migrated = turn(legacy, { text: "1" });
    expect(migrated.conversation.selectedSeminarIds).toEqual([]);
    expect(migrated.conversation.currentStep).toBe("AWAITING_SEMINARS");
    expect(
      migrated.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("seminar options have been updated")
      )
    ).toBe(true);
    expect(
      migrated.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("Seminar Preferences")
      )
    ).toBe(true);
  });
});

describe("WhatsApp stale seminar recovery", () => {
  const baseConversation = {
    ...advanceToSeminarSelectionStep(),
    studentName: "Aarav Sharma",
    email: "aarav@example.com",
    classLabel: "Class 10",
    gender: "Male" as const,
    board: "CBSE",
    interestedStream: "Science",
    college: "National Public School",
    city: "Bangalore",
    status: "ACTIVE" as const,
  };

  it("clears all selections when 1 of 3 selected seminars becomes stale", () => {
    const recovery = buildInvalidSeminarRecoveryResult(
      {
        ...baseConversation,
        currentStep: "READY_TO_REGISTER",
        selectedSeminarIds: ["sem-d1-1", "sem-d1-2", "sem-stale"],
      },
      seminarDayCatalog
    );

    expect(recovery.conversation.currentStep).toBe("AWAITING_SEMINARS");
    expect(recovery.conversation.selectedSeminarIds).toEqual([]);
    expect(recovery.conversation.studentName).toBe("Aarav Sharma");
    expect(recovery.conversation.email).toBe("aarav@example.com");
    expect(recovery.conversation.city).toBe("Bangalore");
    expect(
      recovery.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body === WHATSAPP_STALE_SEMINAR_RECOVERY_MESSAGE
      )
    ).toBe(true);
    expect(
      recovery.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body === formatCombinedSeminarSelectionMessage(seminarDayCatalog)
      )
    ).toBe(true);
    expect(recovery.actions.some((action) => action.type === "BUTTONS")).toBe(
      false
    );
  });

  it("clears all selections when 1 of 2 selected seminars becomes stale", () => {
    const recovery = buildInvalidSeminarRecoveryResult(
      {
        ...baseConversation,
        currentStep: "AWAITING_SEMINAR_FINISH",
        selectedSeminarIds: ["sem-d1-1", "sem-stale"],
      },
      seminarDayCatalog
    );

    expect(recovery.conversation.currentStep).toBe("AWAITING_SEMINARS");
    expect(recovery.conversation.selectedSeminarIds).toEqual([]);
    expect(recovery.actions.some((action) => action.type === "BUTTONS")).toBe(
      false
    );
  });

  it("recovers stale selections on recent greeting re-prompt", () => {
    const staleCatalog = buildTestSeminarDayCatalog([
      { id: "sem-d1-1", title: "Day 1 Seminar 1", date: "2026-08-15", startTime: "10:00" },
    ]);
    const conversation = {
      ...baseConversation,
      currentStep: "AWAITING_SEMINAR_FINISH" as const,
      selectedSeminarIds: ["sem-d1-1", "sem-d2-2"],
    };

    const result = turn(conversation, { text: "hi" }, seminarOptions, staleCatalog);

    expect(result.conversation.currentStep).toBe("AWAITING_SEMINARS");
    expect(result.conversation.selectedSeminarIds).toEqual([]);
    expect(result.actions.some((action) => action.type === "BUTTONS")).toBe(false);
  });

  it("recovers stale READY_TO_REGISTER conversations on greeting", () => {
    const conversation = {
      ...baseConversation,
      status: "READY_TO_REGISTER" as const,
      currentStep: "READY_TO_REGISTER" as const,
      selectedSeminarIds: ["sem-d1-1", "sem-stale"],
    };

    const result = turn(conversation, { text: "hello" });

    expect(result.conversation.currentStep).toBe("AWAITING_SEMINARS");
    expect(result.conversation.selectedSeminarIds).toEqual([]);
    expect(result.conversation.studentName).toBe("Aarav Sharma");
    expect(result.actions.some((action) => action.type === "BUTTONS")).toBe(false);
  });

  it("recovers stale AWAITING_SEMINAR_FINISH conversations on Continue", () => {
    const staleCatalog = buildTestSeminarDayCatalog([
      { id: "sem-d1-1", title: "Day 1 Seminar 1", date: "2026-08-15", startTime: "10:00" },
    ]);
    const conversation = {
      ...baseConversation,
      currentStep: "AWAITING_SEMINAR_FINISH" as const,
      selectedSeminarIds: ["sem-d1-1", "sem-d2-2"],
    };

    const result = turn(
      conversation,
      { interactiveId: REGISTRATION_INTERACTIVE_IDS.CONTINUE },
      seminarOptions,
      staleCatalog
    );

    expect(result.conversation.currentStep).toBe("AWAITING_SEMINARS");
    expect(result.conversation.selectedSeminarIds).toEqual([]);
    expect(result.actions.some((action) => action.type === "BUTTONS")).toBe(
      false
    );
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body === WHATSAPP_STALE_SEMINAR_RECOVERY_MESSAGE
      )
    ).toBe(true);
  });

  it("does not alter COMPLETED registrations", () => {
    const completed = {
      ...createCompletedConversation(),
      selectedSeminarIds: ["sem-stale"],
    };
    const result = turn(
      completed,
      { text: "hello" },
      seminarOptions,
      seminarDayCatalog
    );

    expect(result.conversation.status).toBe("COMPLETED");
    expect(result.conversation.selectedSeminarIds).toEqual(["sem-stale"]);
  });
});

function createCompletedConversation(): WhatsAppConversationState {
  return {
    waId: "919876543210",
    status: "COMPLETED",
    currentStep: "COMPLETED",
    studentName: "Aarav Sharma",
    email: "aarav@example.com",
    classLabel: "Class 10",
    gender: "Male",
    board: "CBSE",
    interestedStream: "Science",
    college: "National Public School",
    city: "Bangalore",
    selectedSeminarIds: ["sem-d1-1"],
    completedRegistrationId: "reg-001",
  };
}
