import { describe, expect, it } from "vitest";

import {
  REGISTRATION_BOARD_OPTIONS,
  REGISTRATION_CLASS_OPTIONS,
  REGISTRATION_STREAM_OPTIONS,
  WHATSAPP_GENDER_OPTIONS,
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
  createInitialConversationState,
  processRegistrationConversationTurn,
  resetConversationAnswers,
  type SeminarOption,
  type WhatsAppConversationState,
} from "@/lib/server/whatsapp/registration-conversation";

const seminarOptions: SeminarOption[] = [
  { id: "sem-001", title: "AI Careers" },
  { id: "sem-002", title: "Design Thinking" },
  { id: "sem-003", title: "Startup Skills" },
];

function turn(
  conversation: WhatsAppConversationState | null,
  message: { text?: string; interactiveId?: string },
  waId = "919876543210",
  completedRegistrationNumber?: string | null
) {
  return processRegistrationConversationTurn({
    conversation,
    message,
    seminarOptions,
    waId,
    completedRegistrationNumber,
  });
}

function beginAtNameStep(conversation: WhatsAppConversationState | null = null) {
  let state = turn(conversation, { text: "hi" }).conversation;
  return turn(state, {
    interactiveId: REGISTRATION_INTERACTIVE_IDS.START,
  }).conversation;
}

function expectWelcomeActions(actions: ReturnType<typeof turn>["actions"]) {
  expect(
    actions.some(
      (action) =>
        action.type === "TEXT" &&
        action.body.includes("Welcome to Career Uttsav")
    )
  ).toBe(true);
  expect(
    actions.some(
      (action) =>
        action.type === "BUTTONS" &&
        action.buttons.some(
          (button) => button.id === REGISTRATION_INTERACTIVE_IDS.START
        )
    )
  ).toBe(true);
}

function expectNoFullNamePrompt(actions: ReturnType<typeof turn>["actions"]) {
  expect(
    actions.some(
      (action) =>
        action.type === "TEXT" &&
        action.body.toLowerCase().includes("full name")
    )
  ).toBe(false);
}

describe("whatsapp registration conversation engine", () => {
  it("starts a new sender at AWAITING_START before registration begins", () => {
    const initial = createInitialConversationState("919876543210");
    const result = turn(initial, { text: "help" });
    expect(result.conversation.currentStep).toBe("AWAITING_START");
  });

  it("keeps a brand-new sender on AWAITING_START after Hi", () => {
    const result = turn(null, { text: "hi" });
    expect(result.conversation.currentStep).toBe("AWAITING_START");
    expect(result.conversation.status).toBe("ACTIVE");
    expectWelcomeActions(result.actions);
    expectNoFullNamePrompt(result.actions);
  });

  it("shows Welcome and Start Registration for plain start on a fresh conversation", () => {
    const result = turn(null, { text: "start" });
    expect(result.conversation.currentStep).toBe("AWAITING_START");
    expectWelcomeActions(result.actions);
    expectNoFullNamePrompt(result.actions);
  });

  it("advances to AWAITING_NAME only after registration:start", () => {
    const started = turn(createInitialConversationState("919876543210"), {
      interactiveId: REGISTRATION_INTERACTIVE_IDS.START,
    });
    expect(started.conversation.currentStep).toBe("AWAITING_NAME");
    expect(
      started.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body === "What is your full name?"
      )
    ).toBe(true);
  });

  it("saves a valid name and advances to email", () => {
    const started = turn(createInitialConversationState("919876543210"), {
      interactiveId: REGISTRATION_INTERACTIVE_IDS.START,
    }).conversation;
    const result = turn(started, { text: "Aarav Sharma" });
    expect(result.conversation.studentName).toBe("Aarav Sharma");
    expect(result.conversation.currentStep).toBe("AWAITING_EMAIL");
  });

  it("keeps invalid email on the email step", () => {
    let conversation = beginAtNameStep();
    conversation = turn(conversation, { text: "Aarav Sharma" }).conversation;
    const result = turn(conversation, { text: "not-an-email" });
    expect(result.conversation.currentStep).toBe("AWAITING_EMAIL");
    expect(result.conversation.email).toBeNull();
  });

  it("accepts a valid email and advances to class", () => {
    let conversation = beginAtNameStep();
    conversation = turn(conversation, { text: "Aarav Sharma" }).conversation;
    const result = turn(conversation, { text: "aarav@example.com" });
    expect(result.conversation.email).toBe("aarav@example.com");
    expect(result.conversation.currentStep).toBe("AWAITING_CLASS");
  });

  it("accepts a valid class selection", () => {
    let conversation = beginAtNameStep();
    conversation = turn(conversation, { text: "Aarav Sharma" }).conversation;
    conversation = turn(conversation, { text: "aarav@example.com" }).conversation;
    const classLabel = REGISTRATION_CLASS_OPTIONS[0]!;
    const result = turn(conversation, {
      interactiveId: classInteractiveId(classLabel),
    });
    expect(result.conversation.classLabel).toBe(classLabel);
    expect(result.conversation.currentStep).toBe("AWAITING_GENDER");
  });

  it("rejects an invalid class interactive id", () => {
    let conversation = beginAtNameStep();
    conversation = turn(conversation, { text: "Aarav Sharma" }).conversation;
    conversation = turn(conversation, { text: "aarav@example.com" }).conversation;
    const result = turn(conversation, { interactiveId: "class:Invalid Class" });
    expect(result.conversation.classLabel).toBeNull();
    expect(result.conversation.currentStep).toBe("AWAITING_CLASS");
  });

  it("exposes only Male and Female gender options", () => {
    expect(WHATSAPP_GENDER_OPTIONS).toEqual(["Male", "Female"]);
    let conversation = beginAtNameStep();
    conversation = turn(conversation, { text: "Aarav Sharma" }).conversation;
    conversation = turn(conversation, { text: "aarav@example.com" }).conversation;
    conversation = turn(conversation, {
      interactiveId: classInteractiveId(REGISTRATION_CLASS_OPTIONS[0]!),
    }).conversation;
    const result = turn(conversation, { interactiveId: "gender:other" });
    expect(result.conversation.gender).toBeNull();
    expect(result.conversation.currentStep).toBe("AWAITING_GENDER");
  });

  it("uses supported board options", () => {
    let conversation = beginAtNameStep();
    conversation = turn(conversation, { text: "Aarav Sharma" }).conversation;
    conversation = turn(conversation, { text: "aarav@example.com" }).conversation;
    conversation = turn(conversation, {
      interactiveId: classInteractiveId(REGISTRATION_CLASS_OPTIONS[0]!),
    }).conversation;
    conversation = turn(conversation, {
      interactiveId: genderInteractiveId("Male"),
    }).conversation;
    const board = REGISTRATION_BOARD_OPTIONS[0]!;
    const result = turn(conversation, {
      interactiveId: boardInteractiveId(board),
    });
    expect(result.conversation.board).toBe(board);
    expect(result.conversation.currentStep).toBe("AWAITING_STREAM");
  });

  it("accepts Science, Commerce, and Arts streams", () => {
    for (const stream of REGISTRATION_STREAM_OPTIONS) {
      let conversation = beginAtNameStep();
      conversation = turn(conversation, { text: "Aarav Sharma" }).conversation;
      conversation = turn(conversation, { text: "aarav@example.com" }).conversation;
      conversation = turn(conversation, {
        interactiveId: classInteractiveId(REGISTRATION_CLASS_OPTIONS[0]!),
      }).conversation;
      conversation = turn(conversation, {
        interactiveId: genderInteractiveId("Female"),
      }).conversation;
      conversation = turn(conversation, {
        interactiveId: boardInteractiveId(REGISTRATION_BOARD_OPTIONS[0]!),
      }).conversation;
      const result = turn(conversation, {
        interactiveId: streamInteractiveId(stream),
      });
      expect(result.conversation.interestedStream).toBe(stream);
      expect(result.conversation.currentStep).toBe("AWAITING_COLLEGE");
    }
  });

  it("saves college and city", () => {
    let conversation = beginAtNameStep();
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
    const result = turn(conversation, { text: "Bangalore" });
    expect(result.conversation.college).toBe("National Public School");
    expect(result.conversation.city).toBe("Bangalore");
    expect(result.conversation.currentStep).toBe("AWAITING_SEMINARS");
  });

  it("stores seminar selections without duplication", () => {
    let conversation = beginAtNameStep();
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
    conversation = turn(conversation, { text: "Bangalore" }).conversation;

    conversation = turn(conversation, {
      interactiveId: seminarInteractiveId("sem-001"),
    }).conversation;
    const duplicate = turn(conversation, {
      interactiveId: seminarInteractiveId("sem-001"),
    });
    expect(duplicate.conversation.selectedSeminarIds).toEqual(["sem-001"]);

    const second = turn(conversation, {
      interactiveId: seminarInteractiveId("sem-002"),
    });
    expect(second.conversation.selectedSeminarIds).toEqual(["sem-001", "sem-002"]);
  });

  it("rejects finish without seminars", () => {
    let conversation = beginAtNameStep();
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
    conversation = turn(conversation, { text: "Bangalore" }).conversation;

    const result = turn(conversation, {
      interactiveId: REGISTRATION_INTERACTIVE_IDS.FINISH,
    });
    expect(result.conversation.currentStep).toBe("AWAITING_SEMINARS");
    expect(result.conversation.status).toBe("ACTIVE");
  });

  it("reaches READY_TO_REGISTER with at least one seminar", () => {
    let conversation = beginAtNameStep();
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
    conversation = turn(conversation, { text: "Bangalore" }).conversation;
    conversation = turn(conversation, {
      interactiveId: seminarInteractiveId("sem-001"),
    }).conversation;
    const result = turn(conversation, {
      interactiveId: REGISTRATION_INTERACTIVE_IDS.FINISH,
    });
    expect(result.conversation.status).toBe("READY_TO_REGISTER");
    expect(result.conversation.currentStep).toBe("READY_TO_REGISTER");
    expect(
      result.actions.some((action) =>
        action.type === "TEXT" && action.body.toLowerCase().includes("review")
      )
    ).toBe(false);
  });

  it("does not include a review step in the journey", () => {
    const steps = [
      "AWAITING_START",
      "AWAITING_NAME",
      "AWAITING_EMAIL",
      "AWAITING_CLASS",
      "AWAITING_GENDER",
      "AWAITING_BOARD",
      "AWAITING_STREAM",
      "AWAITING_COLLEGE",
      "AWAITING_CITY",
      "AWAITING_SEMINARS",
      "READY_TO_REGISTER",
    ];
    expect(steps).not.toContain("REVIEW");
  });

  it("does not collect parentPhone in conversation state", () => {
    const state = createInitialConversationState("919876543210");
    expect("parentPhone" in state).toBe(false);
  });

  it("preserves progress when user says hi during an active flow", () => {
    let conversation = beginAtNameStep();
    conversation = turn(conversation, { text: "Aarav Sharma" }).conversation;
    const result = turn(conversation, { text: "hello" });
    expect(result.conversation.studentName).toBe("Aarav Sharma");
    expect(result.conversation.currentStep).toBe("AWAITING_EMAIL");
    expect(
      result.actions.some(
        (action) =>
          action.type === "BUTTONS" &&
          action.body.includes("registration in progress")
      )
    ).toBe(true);
  });

  it("restart clears incomplete answers", () => {
    let conversation = beginAtNameStep();
    conversation = turn(conversation, { text: "Aarav Sharma" }).conversation;
    const restarted = turn(conversation, {
      interactiveId: REGISTRATION_INTERACTIVE_IDS.RESTART,
    });
    expect(restarted.conversation.studentName).toBeNull();
    expect(restarted.conversation.currentStep).toBe("AWAITING_NAME");
    expect(resetConversationAnswers(conversation).email).toBeNull();
  });

  it("cancel marks the conversation cancelled", () => {
    let conversation = beginAtNameStep();
    const result = turn(conversation, { text: "cancel" });
    expect(result.conversation.status).toBe("CANCELLED");
    expect(result.conversation.currentStep).toBe("CANCELLED");
  });

  it("does not silently restart COMPLETED conversations", () => {
    let conversation = beginAtNameStep();
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
    conversation = turn(conversation, { text: "Bangalore" }).conversation;
    conversation = turn(conversation, {
      interactiveId: seminarInteractiveId("sem-001"),
    }).conversation;
    conversation = turn(conversation, {
      interactiveId: REGISTRATION_INTERACTIVE_IDS.FINISH,
    }).conversation;

    const result = turn(conversation, { text: "hi" }, "919876543210", "CU-BLR-2026-00042");
    expect(result.conversation.status).toBe("READY_TO_REGISTER");
    expect(result.conversation.studentName).toBe("Aarav Sharma");
  });

  it("shows already registered messaging for COMPLETED conversations", () => {
    const completed = {
      ...createInitialConversationState("919876543210"),
      status: "COMPLETED" as const,
      currentStep: "COMPLETED" as const,
      completedRegistrationId: "reg-001",
    };
    const result = turn(
      completed,
      { text: "hello" },
      "919876543210",
      "CU-BLR-2026-00042"
    );
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("already registered")
      )
    ).toBe(true);
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("CU-BLR-2026-00042")
      )
    ).toBe(true);
    expect(result.conversation.status).toBe("COMPLETED");
  });

  it("returns a cancelled conversation to AWAITING_START after Hi", () => {
    const cancelled = {
      ...createInitialConversationState("919876543210"),
      status: "CANCELLED" as const,
      currentStep: "CANCELLED" as const,
      completedRegistrationId: null,
    };
    const result = turn(cancelled, { text: "hi" });
    expect(result.conversation.currentStep).toBe("AWAITING_START");
    expect(result.conversation.status).toBe("ACTIVE");
    expectWelcomeActions(result.actions);
    expectNoFullNamePrompt(result.actions);
  });

  it("allows a fresh registration after an email-duplicate cancellation", () => {
    const cancelled = {
      ...createInitialConversationState("919876543210"),
      status: "CANCELLED" as const,
      currentStep: "CANCELLED" as const,
      completedRegistrationId: null,
    };
    const result = turn(cancelled, {
      interactiveId: REGISTRATION_INTERACTIVE_IDS.START,
    });
    expect(result.conversation.currentStep).toBe("AWAITING_NAME");
    expect(result.conversation.status).toBe("ACTIVE");
  });
});
