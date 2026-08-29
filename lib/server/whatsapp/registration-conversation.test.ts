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
  seminarPageInteractiveId,
  streamInteractiveId,
} from "@/lib/server/whatsapp/registration-interactive-ids";
import {
  createInitialConversationState,
  processRegistrationConversationTurn,
  resetConversationAnswers,
  buildSeminarListRows,
  type SeminarOption,
  type WhatsAppConversationState,
} from "@/lib/server/whatsapp/registration-conversation";
import {
  WHATSAPP_SEMINAR_LIST_DESCRIPTION_LIMIT,
} from "@/lib/server/whatsapp/seminar-list-display";
import { CAREER_UTTSAV_SEMINARS } from "@/features/dashboard/seminars";

const seminarOptions: SeminarOption[] = [
  { id: "sem-001", title: "AI Careers" },
  { id: "sem-002", title: "Design Thinking" },
  { id: "sem-003", title: "Startup Skills" },
];

function buildSeminarOptions(count: number): SeminarOption[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `sem-${String(index + 1).padStart(3, "0")}`,
    title: `Seminar ${index + 1}`,
  }));
}

function advanceToSeminarsStep(options: SeminarOption[] = seminarOptions) {
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
  return turn(conversation, { text: "show seminars" }, "919876543210", null, options)
    .conversation;
}

function expectNoDoneSelecting(actions: ReturnType<typeof turn>["actions"]) {
  expect(
    actions.some(
      (action) =>
        action.type === "BUTTONS" &&
        action.buttons.some(
          (button) => button.id === REGISTRATION_INTERACTIVE_IDS.FINISH
        )
    )
  ).toBe(false);
}

function selectSeminar(
  conversation: WhatsAppConversationState,
  seminarId: string,
  options: SeminarOption[] = seminarOptions
) {
  return turn(
    conversation,
    { interactiveId: seminarInteractiveId(seminarId) },
    "919876543210",
    null,
    options
  );
}

function completeThreeSeminarSelections(
  conversation: WhatsAppConversationState,
  seminarIds: string[] = ["sem-001", "sem-002", "sem-003"],
  options: SeminarOption[] = seminarOptions
) {
  let state = conversation;
  let lastResult = selectSeminar(state, seminarIds[0]!, options);
  state = lastResult.conversation;
  for (const seminarId of seminarIds.slice(1)) {
    lastResult = selectSeminar(state, seminarId, options);
    state = lastResult.conversation;
  }
  return lastResult;
}

function turn(
  conversation: WhatsAppConversationState | null,
  message: { text?: string; interactiveId?: string },
  waId = "919876543210",
  completedRegistrationNumber?: string | null,
  options: SeminarOption[] = seminarOptions
) {
  return processRegistrationConversationTurn({
    conversation,
    message,
    seminarOptions: options,
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
  expect(actions).toHaveLength(1);
  const welcome = actions[0];
  expect(welcome?.type).toBe("BUTTONS");
  if (welcome?.type !== "BUTTONS") return;
  expect(welcome.body).toContain("Welcome to Career Uttsav");
  expect(welcome.body).toContain(
    "Career Uttsav is a career discovery platform for students after 10th & 12th"
  );
  expect(welcome.body).toContain(
    "Let's get you registered for the event. It'll only take a minute."
  );
  expect(welcome.buttons).toEqual([
    {
      id: REGISTRATION_INTERACTIVE_IDS.START,
      title: "Start Registration",
    },
  ]);
}

function expectNameStepActions(actions: ReturnType<typeof turn>["actions"]) {
  expect(actions).toHaveLength(2);
  const guidance = actions[0];
  const namePrompt = actions[1];
  expect(guidance?.type).toBe("TEXT");
  expect(namePrompt?.type).toBe("TEXT");
  if (guidance?.type !== "TEXT" || namePrompt?.type !== "TEXT") return;
  expect(guidance.body).toBe(
    `Before we begin, if you make a mistake while entering your details, just type *cancel*.

We'll pause this registration and you can start afresh by sending *Hi*.`
  );
  expect(guidance.body).not.toContain("Registration ID");
  expect(guidance.body).not.toContain("QR");
  expect(namePrompt.body).toBe("*What is your full name?*");
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

function expectCancelledActions(actions: ReturnType<typeof turn>["actions"]) {
  expect(actions).toHaveLength(1);
  const message = actions[0];
  expect(message?.type).toBe("TEXT");
  if (message?.type !== "TEXT") return;
  expect(message.body).toBe(
    `Your registration has been paused.

To start afresh, please send *Hi*.`
  );
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
    expectNameStepActions(started.actions);
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

  it("keeps duplicate seminar selections and prompts the user to choose another", () => {
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
    expect(duplicate.conversation.currentStep).toBe("AWAITING_SEMINARS");
    expect(
      duplicate.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body ===
            "You have already selected this seminar. Please choose another."
      )
    ).toBe(true);
    expect(duplicate.actions.some((action) => action.type === "LIST")).toBe(
      true
    );

    const second = turn(duplicate.conversation, {
      interactiveId: seminarInteractiveId("sem-002"),
    });
    expect(second.conversation.selectedSeminarIds).toEqual([
      "sem-001",
      "sem-002",
    ]);
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

  it("reaches READY_TO_REGISTER after the third seminar selection", () => {
    let conversation = advanceToSeminarsStep();
    const result = completeThreeSeminarSelections(conversation);
    expect(result.conversation.status).toBe("READY_TO_REGISTER");
    expect(result.conversation.currentStep).toBe("READY_TO_REGISTER");
    expect(result.conversation.selectedSeminarIds).toEqual([
      "sem-001",
      "sem-002",
      "sem-003",
    ]);
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("3 of 3 selected")
      )
    ).toBe(true);
    expectNoDoneSelecting(result.actions);
    expect(
      result.actions.some((action) => action.type === "LIST")
    ).toBe(false);
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

  it("cancel during name step pauses the journey", () => {
    const started = turn(createInitialConversationState("919876543210"), {
      interactiveId: REGISTRATION_INTERACTIVE_IDS.START,
    }).conversation;
    const result = turn(started, { text: "cancel" });
    expect(result.conversation.status).toBe("CANCELLED");
    expectCancelledActions(result.actions);
  });

  it("cancel during email step pauses the journey", () => {
    let conversation = beginAtNameStep();
    conversation = turn(conversation, { text: "Aarav Sharma" }).conversation;
    const result = turn(conversation, { text: "cancel" });
    expect(result.conversation.status).toBe("CANCELLED");
    expectCancelledActions(result.actions);
  });

  it("cancel during seminar selection pauses the journey", () => {
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
    const result = turn(conversation, { text: "cancel" });
    expect(result.conversation.status).toBe("CANCELLED");
    expectCancelledActions(result.actions);
  });

  it("does not cancel a completed registration", () => {
    const completed = {
      ...createInitialConversationState("919876543210"),
      status: "COMPLETED" as const,
      currentStep: "COMPLETED" as const,
      completedRegistrationId: "reg-001",
    };
    const result = turn(
      completed,
      { text: "cancel" },
      "919876543210",
      "CU-BLR-2026-00042"
    );
    expect(result.conversation.status).toBe("COMPLETED");
    expect(result.conversation.completedRegistrationId).toBe("reg-001");
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("already complete")
      )
    ).toBe(true);
  });

  it("recommends top 3 seminars and guides the user through three selections", () => {
    let conversation = advanceToSeminarsStep();

    const initial = turn(conversation, { text: "show seminars" });
    expect(
      initial.actions.some(
        (action) =>
          action.type === "LIST" &&
          action.body.includes("Choose your seminar interests") &&
          action.body.includes("Please select your *top 3 seminars* from the list below.")
      )
    ).toBe(true);
    expectNoDoneSelecting(initial.actions);

    const first = selectSeminar(conversation, "sem-001");
    conversation = first.conversation;
    expect(conversation.selectedSeminarIds).toEqual(["sem-001"]);
    expect(conversation.currentStep).toBe("AWAITING_SEMINARS");
    expect(
      first.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("1 of 3 selected") &&
          action.body.includes("AI Careers") &&
          action.body.includes("2 more seminars")
      )
    ).toBe(true);
    expect(first.actions.some((action) => action.type === "LIST")).toBe(true);
    expectNoDoneSelecting(first.actions);

    const second = selectSeminar(conversation, "sem-002");
    conversation = second.conversation;
    expect(conversation.selectedSeminarIds).toEqual(["sem-001", "sem-002"]);
    expect(
      second.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("2 of 3 selected") &&
          action.body.includes("Design Thinking") &&
          action.body.includes("1 more seminar")
      )
    ).toBe(true);
    expect(second.actions.some((action) => action.type === "LIST")).toBe(true);

    const duplicate = selectSeminar(conversation, "sem-002");
    expect(duplicate.conversation.selectedSeminarIds).toEqual([
      "sem-001",
      "sem-002",
    ]);
    expect(duplicate.conversation.currentStep).toBe("AWAITING_SEMINARS");
    expect(
      duplicate.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body ===
            "You have already selected this seminar. Please choose another."
      )
    ).toBe(true);
    expect(duplicate.actions.some((action) => action.type === "LIST")).toBe(
      true
    );

    const third = selectSeminar(conversation, "sem-003");
    expect(third.conversation.selectedSeminarIds).toEqual([
      "sem-001",
      "sem-002",
      "sem-003",
    ]);
    expect(third.conversation.currentStep).toBe("READY_TO_REGISTER");
    expect(
      third.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("3 of 3 selected") &&
          action.body.includes("Your seminar preferences are saved.")
      )
    ).toBe(true);
    expect(third.actions.some((action) => action.type === "LIST")).toBe(false);
  });

  it("keeps seminar:finish available for stale Done Selecting messages", () => {
    const extendedSeminars = [
      ...seminarOptions,
      { id: "sem-004", title: "Entrepreneurship" },
    ];
    let conversation = advanceToSeminarsStep(extendedSeminars);
    conversation = selectSeminar(conversation, "sem-001", extendedSeminars).conversation;
    conversation = selectSeminar(conversation, "sem-002", extendedSeminars).conversation;

    const finished = turn(
      conversation,
      { interactiveId: REGISTRATION_INTERACTIVE_IDS.FINISH },
      "919876543210",
      null,
      extendedSeminars
    );
    expect(finished.conversation.selectedSeminarIds).toEqual([
      "sem-001",
      "sem-002",
    ]);
    expect(finished.conversation.currentStep).toBe("READY_TO_REGISTER");
  });

  it("paginates seminar lists when more than 10 live seminars exist", () => {
    const manySeminars = buildSeminarOptions(12);

    const pageZeroRows = buildSeminarListRows(manySeminars, [], 0);
    expect(pageZeroRows).toHaveLength(9);
    expect(pageZeroRows.at(-1)?.id).toBe("seminar-page:1");

    const pageOneRows = buildSeminarListRows(manySeminars, ["sem-001"], 1);
    expect(pageOneRows.some((row) => row.id === "seminar-page:0")).toBe(true);
    expect(
      pageOneRows.some((row) => row.id === seminarInteractiveId("sem-009"))
    ).toBe(true);
  });

  it("exposes every configured seminar across paginated list pages", () => {
    const manySeminars = buildSeminarOptions(12);
    const reachableIds = new Set<string>();

    for (let page = 0; page < 2; page += 1) {
      for (const row of buildSeminarListRows(manySeminars, [], page)) {
        if (row.id.startsWith("seminar:") && !row.id.startsWith("seminar-page:")) {
          reachableIds.add(row.id);
        }
      }
    }

    expect(reachableIds.size).toBe(12);
    expect([...reachableIds].sort()).toEqual(
      manySeminars.map((seminar) => seminarInteractiveId(seminar.id)).sort()
    );
  });

  it("does not arbitrarily limit seminar list rows to 4", () => {
    const eightSeminars = buildSeminarOptions(8);
    const rows = buildSeminarListRows(eightSeminars, []);
    expect(rows).toHaveLength(8);
    expect(rows.map((row) => row.id)).toEqual(
      eightSeminars.map((seminar) => seminarInteractiveId(seminar.id))
    );
  });

  it("uses numbered row titles and full titles in descriptions", () => {
    const rows = buildSeminarListRows(
      [
        {
          id: "sem-ai",
          title: "Real Careers with Artificial Intelligence",
        },
      ],
      []
    );

    expect(rows[0]?.title).toBe("Seminar 1");
    expect(rows[0]?.description).toBe(
      "Real Careers with Artificial Intelligence"
    );
    expect(rows[0]?.description?.length).toBeLessThanOrEqual(
      WHATSAPP_SEMINAR_LIST_DESCRIPTION_LIMIT
    );
    expect(rows[0]?.id).toBe(seminarInteractiveId("sem-ai"));
  });

  it("marks selected seminars in the description without changing the numbered title", () => {
    const rows = buildSeminarListRows(
      [
        {
          id: "sem-ai",
          title: "Real Careers with Artificial Intelligence",
        },
      ],
      ["sem-ai"]
    );

    expect(rows[0]?.title).toBe("Seminar 1");
    expect(rows[0]?.description).toBe(
      "✓ Selected · Real Careers with Artificial Intelligence"
    );
  });

  it("keeps global numbering across paginated pages for 20 seminars", () => {
    const twentySeminars: SeminarOption[] = CAREER_UTTSAV_SEMINARS.map(
      (title, index) => ({
        id: `sem-${String(index + 1).padStart(3, "0")}`,
        title,
      })
    );

    const pageZeroRows = buildSeminarListRows(twentySeminars, [], 0);
    const pageOneRows = buildSeminarListRows(twentySeminars, [], 1);
    const pageTwoRows = buildSeminarListRows(twentySeminars, [], 2);

    expect(pageZeroRows[0]?.title).toBe("Seminar 1");
    expect(pageZeroRows[7]?.title).toBe("Seminar 8");
    expect(pageOneRows[0]?.title).toBe("Seminar 9");
    expect(pageOneRows[7]?.title).toBe("Seminar 16");
    expect(pageTwoRows[0]?.title).toBe("Seminar 17");
    expect(pageTwoRows[3]?.title).toBe("Seminar 20");

    const reachableIds = new Set<string>();
    for (let page = 0; page < 3; page += 1) {
      for (const row of buildSeminarListRows(twentySeminars, [], page)) {
        if (row.id.startsWith("seminar:")) {
          reachableIds.add(row.id);
        }
      }
    }
    expect(reachableIds.size).toBe(20);
  });

  it("auto-completes after the third cross-page seminar selection", () => {
    const twentySeminars: SeminarOption[] = Array.from({ length: 20 }, (_, index) => ({
      id: `sem-${String(index + 1).padStart(3, "0")}`,
      title: `Seminar ${index + 1}`,
    }));
    let conversation = advanceToSeminarsStep(twentySeminars);

    conversation = selectSeminar(conversation, "sem-002", twentySeminars).conversation;
    conversation = turn(
      conversation,
      { interactiveId: seminarPageInteractiveId(1) },
      "919876543210",
      null,
      twentySeminars
    ).conversation;
    conversation = selectSeminar(conversation, "sem-011", twentySeminars).conversation;
    conversation = turn(
      conversation,
      { interactiveId: seminarPageInteractiveId(2) },
      "919876543210",
      null,
      twentySeminars
    ).conversation;

    const finished = selectSeminar(conversation, "sem-019", twentySeminars);

    expect(finished.conversation.selectedSeminarIds).toEqual([
      "sem-002",
      "sem-011",
      "sem-019",
    ]);
    expect(finished.conversation.currentStep).toBe("READY_TO_REGISTER");
    expect(
      finished.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("3 of 3 selected")
      )
    ).toBe(true);
    expect(finished.actions.some((action) => action.type === "LIST")).toBe(false);
  });

  it("cancel after one seminar selection pauses the journey", () => {
    let conversation = advanceToSeminarsStep();
    conversation = selectSeminar(conversation, "sem-001").conversation;
    const result = turn(conversation, { text: "cancel" });
    expect(result.conversation.status).toBe("CANCELLED");
    expect(result.conversation.selectedSeminarIds).toEqual(["sem-001"]);
    expectCancelledActions(result.actions);
  });

  it("cancel after two seminar selections pauses the journey", () => {
    let conversation = advanceToSeminarsStep();
    conversation = selectSeminar(conversation, "sem-001").conversation;
    conversation = selectSeminar(conversation, "sem-002").conversation;
    const result = turn(conversation, { text: "cancel" });
    expect(result.conversation.status).toBe("CANCELLED");
    expect(result.conversation.selectedSeminarIds).toEqual([
      "sem-001",
      "sem-002",
    ]);
    expectCancelledActions(result.actions);
  });

  it("cancel marks the conversation cancelled", () => {
    let conversation = beginAtNameStep();
    const result = turn(conversation, { text: "cancel" });
    expect(result.conversation.status).toBe("CANCELLED");
    expect(result.conversation.currentStep).toBe("CANCELLED");
    expectCancelledActions(result.actions);
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
    conversation = selectSeminar(conversation, "sem-001").conversation;
    conversation = selectSeminar(conversation, "sem-002").conversation;
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
    expectNameStepActions(result.actions);
  });
});
