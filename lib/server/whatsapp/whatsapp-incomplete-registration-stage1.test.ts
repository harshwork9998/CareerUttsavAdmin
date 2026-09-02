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
  WHATSAPP_CONVERSATION_TTL_MS,
  buildInvalidSeminarRecoveryResult,
  createInitialConversationState,
  isRestartRegistrationText,
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
  } = {}
) {
  return processRegistrationConversationTurn({
    conversation,
    message,
    seminarOptions: options.seminarOptions ?? seminarOptions,
    waId: options.waId ?? "919876543210",
    completedRegistrationNumber: options.completedRegistrationNumber,
    sessionExpired: options.sessionExpired,
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

function advanceToSeminarsStep(selectedIds: string[] = []) {
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
  conversation = turn(conversation, {
    interactiveId: streamInteractiveId("Science"),
  }).conversation;
  conversation = turn(conversation, { text: "National Public School" }).conversation;
  conversation = turn(conversation, { text: "Bangalore" }).conversation;
  conversation = turn(conversation, { text: "show seminars" }).conversation;
  for (const seminarId of selectedIds) {
    conversation = turn(conversation, {
      interactiveId: seminarInteractiveId(seminarId),
    }).conversation;
  }
  return conversation;
}

describe("Stage 1 incomplete registration TTL helpers", () => {
  it("uses a 7-day TTL constant", () => {
    expect(WHATSAPP_CONVERSATION_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("refreshes expiry on handled greeting during incomplete flow", () => {
    const conversation = advanceToEmailStep();
    const result = turn(conversation, { text: "hello" });
    expect(result.refreshExpiry).toBe(true);
    expect(
      resolveConversationRefreshExpiry(result.conversation, result.refreshExpiry)
    ).toBe(true);
  });

  it("refreshes expiry on Continue", () => {
    const conversation = advanceToEmailStep();
    const result = turn(conversation, {
      interactiveId: REGISTRATION_INTERACTIVE_IDS.CONTINUE,
    });
    expect(result.refreshExpiry).toBe(true);
    expect(
      resolveConversationRefreshExpiry(result.conversation, result.refreshExpiry)
    ).toBe(true);
  });

  it("refreshes expiry on invalid re-prompt interactions", () => {
    const conversation = advanceToEmailStep();
    const result = turn(conversation, { text: "not-an-email" });
    expect(result.refreshExpiry).toBe(false);
    expect(
      resolveConversationRefreshExpiry(result.conversation, result.refreshExpiry)
    ).toBe(true);
  });

  it("does not refresh expiry for completed conversations", () => {
    const completed: WhatsAppConversationState = {
      ...createInitialConversationState("919876543210"),
      status: "COMPLETED",
      currentStep: "COMPLETED",
      completedRegistrationId: "reg-001",
    };
    expect(
      resolveConversationRefreshExpiry(completed, true)
    ).toBe(false);
  });
});

describe("Stage 1 welcome-back and resume", () => {
  it("shows welcome-back instead of parsing hi as email", () => {
    const conversation = advanceToEmailStep();
    const result = turn(conversation, { text: "hi" });
    expect(result.conversation.currentStep).toBe("AWAITING_EMAIL");
    expect(result.conversation.email).toBeNull();
    expect(
      result.actions.some(
        (action) =>
          action.type === "BUTTONS" && action.body.includes("Welcome back")
      )
    ).toBe(true);
  });

  it("shows next step Email in welcome-back context", () => {
    const conversation = advanceToEmailStep();
    const result = turn(conversation, { text: "namaste" });
    expect(
      result.actions.some(
        (action) =>
          action.type === "BUTTONS" && action.body.includes("Next step: Email")
      )
    ).toBe(true);
  });

  it("shows one seminar selected in welcome-back context", () => {
    const conversation = advanceToSeminarsStep(["sem-001"]);
    expect(resumeProgressContextLine(conversation)).toBe("Seminars selected: 1");
    const result = turn(conversation, { text: "hey" });
    expect(
      result.actions.some(
        (action) =>
          action.type === "BUTTONS" &&
          action.body.includes("Seminars selected: 1")
      )
    ).toBe(true);
  });

  it("shows two seminars selected in welcome-back context", () => {
    const conversation = advanceToSeminarsStep(["sem-001", "sem-002"]);
    expect(resumeProgressContextLine(conversation)).toBe("Seminars selected: 2");
    const result = turn(conversation, { text: "hello" });
    expect(
      result.actions.some(
        (action) =>
          action.type === "BUTTONS" &&
          action.body.includes("Seminars selected: 2")
      )
    ).toBe(true);
  });

  it("Continue returns the exact pending prompt", () => {
    const conversation = advanceToEmailStep();
    const result = turn(conversation, {
      interactiveId: REGISTRATION_INTERACTIVE_IDS.CONTINUE,
    });
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("Please enter your email address")
      )
    ).toBe(true);
  });

  it("Continue preserves stored answers", () => {
    const conversation = advanceToEmailStep();
    const result = turn(conversation, {
      interactiveId: REGISTRATION_INTERACTIVE_IDS.CONTINUE,
    });
    expect(result.conversation.studentName).toBe("Aarav Sharma");
    expect(result.conversation.email).toBeNull();
  });

  it("still accepts a valid direct answer without welcome-back", () => {
    const conversation = advanceToEmailStep();
    const result = turn(conversation, { text: "aarav@example.com" });
    expect(result.conversation.currentStep).toBe("AWAITING_CLASS");
    expect(result.conversation.email).toBe("aarav@example.com");
  });

  it("shows expired session notice on fresh greeting after expiry", () => {
    const result = turn(null, { text: "hi" }, { sessionExpired: true });
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("previous registration session expired")
      )
    ).toBe(true);
  });
});

describe("Stage 1 restart and invalid seminar recovery", () => {
  it("supports Start Again during ACTIVE", () => {
    const conversation = advanceToEmailStep();
    const result = turn(conversation, {
      interactiveId: REGISTRATION_INTERACTIVE_IDS.RESTART,
    });
    expect(result.conversation.currentStep).toBe("AWAITING_NAME");
    expect(result.conversation.studentName).toBeNull();
  });

  it.each(["restart", "start over", "reset"])(
    "supports %s text during ACTIVE",
    (text) => {
      expect(isRestartRegistrationText(text)).toBe(true);
      const conversation = advanceToEmailStep();
      const result = turn(conversation, { text });
      expect(result.conversation.currentStep).toBe("AWAITING_NAME");
      expect(result.conversation.studentName).toBeNull();
    }
  );

  it("supports restart from READY_TO_REGISTER", () => {
    const conversation: WhatsAppConversationState = {
      ...readyConversation,
      selectedSeminarIds: ["sem-001"],
    };
    const result = turn(conversation, { text: "restart" });
    expect(result.conversation.status).toBe("ACTIVE");
    expect(result.conversation.currentStep).toBe("AWAITING_NAME");
    expect(result.conversation.selectedSeminarIds).toEqual([]);
    expect(result.conversation.email).toBeNull();
  });

  it("clears stored answers and seminars on restart", () => {
    const conversation = advanceToSeminarsStep(["sem-001", "sem-002"]);
    const result = turn(conversation, { text: "reset" });
    expect(result.conversation.studentName).toBeNull();
    expect(result.conversation.selectedSeminarIds).toEqual([]);
    expect(result.conversation.currentStep).toBe("AWAITING_NAME");
  });

  it("does not restart COMPLETED conversations", () => {
    const completed: WhatsAppConversationState = {
      ...createInitialConversationState("919876543210"),
      status: "COMPLETED",
      currentStep: "COMPLETED",
      completedRegistrationId: "reg-001",
    };
    const result = turn(
      completed,
      { interactiveId: REGISTRATION_INTERACTIVE_IDS.RESTART },
      { completedRegistrationNumber: "CU-BLR-2026-00042" }
    );
    expect(result.conversation.status).toBe("COMPLETED");
    expect(result.conversation.completedRegistrationId).toBe("reg-001");
  });

  it("removes invalid seminar IDs and preserves valid selections", () => {
    const recovery = buildInvalidSeminarRecoveryResult(
      readyConversation,
      seminarOptions,
      ["sem-001"]
    );
    expect(recovery.conversation.selectedSeminarIds).toEqual(["sem-001"]);
    expect(recovery.conversation.status).toBe("ACTIVE");
    expect(recovery.conversation.currentStep).toBe("AWAITING_SEMINARS");
    expect(
      recovery.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("kept your other selections")
      )
    ).toBe(true);
  });

  it("shows current seminar options after invalid seminar recovery", () => {
    const recovery = buildInvalidSeminarRecoveryResult(
      { ...readyConversation, selectedSeminarIds: ["sem-stale"] },
      seminarOptions,
      []
    );
    expect(
      recovery.actions.some(
        (action) =>
          action.type === "LIST" &&
          action.body.includes("Choose up to 3 seminars")
      )
    ).toBe(true);
  });

  it("excludes already-valid selections when choosing another seminar", () => {
    const conversation = advanceToSeminarsStep(["sem-001"]);
    const result = turn(conversation, {
      interactiveId: REGISTRATION_INTERACTIVE_IDS.CHOOSE_ANOTHER,
    });
    const listAction = result.actions.find((action) => action.type === "LIST");
    expect(listAction?.type).toBe("LIST");
    if (listAction?.type !== "LIST") return;
    const rowIds = listAction.sections.flatMap((section) =>
      section.rows.map((row) => row.id)
    );
    expect(rowIds).not.toContain(seminarInteractiveId("sem-001"));
    expect(rowIds).toContain(seminarInteractiveId("sem-002"));
  });

  it("does not leave repaired conversations in READY_TO_REGISTER", () => {
    const recovery = buildInvalidSeminarRecoveryResult(
      readyConversation,
      seminarOptions,
      ["sem-001"]
    );
    expect(recovery.conversation.status).toBe("ACTIVE");
    expect(recovery.conversation.currentStep).toBe("AWAITING_SEMINARS");
    expect(recovery.refreshExpiry).toBe(true);
  });
});

describe("Stage 1 completed-user behavior", () => {
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
