import { describe, expect, it } from "vitest";

import {
  REGISTRATION_BOARD_OPTIONS,
  REGISTRATION_CLASS_OPTIONS,
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
  META_BUTTON_TITLE_LIMIT,
  validateWhatsAppButtonAction,
} from "@/lib/server/whatsapp/meta-action-mapper";
import {
  buildWelcomeBackPromptActions,
  createInitialConversationState,
  processRegistrationConversationTurn,
  type SeminarOption,
  type WhatsAppBotAction,
  type WhatsAppConversationState,
} from "@/lib/server/whatsapp/registration-conversation";
import {
  buildTestSeminarDayCatalog,
  buildTestSeminarOptions,
} from "@/lib/server/whatsapp/whatsapp-seminar-test-fixtures";

const seminarOptions: SeminarOption[] = buildTestSeminarOptions();
const seminarDayCatalog = buildTestSeminarDayCatalog(seminarOptions);

function expectAllButtonsPassMetaValidation(actions: WhatsAppBotAction[]) {
  for (const action of actions) {
    if (action.type !== "BUTTONS") continue;
    for (const button of action.buttons) {
      expect(button.title.length).toBeLessThanOrEqual(META_BUTTON_TITLE_LIMIT);
    }
    expect(validateWhatsAppButtonAction(action).ok).toBe(true);
  }
}

function turn(
  conversation: WhatsAppConversationState | null,
  message: { text?: string; interactiveId?: string }
) {
  return processRegistrationConversationTurn({
    conversation,
    message,
    seminarOptions,
    seminarDayCatalog,
    waId: "919876543210",
  });
}

function advanceToSeminarsStep(selection?: string) {
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
  conversation = turn(conversation, { text: "Bangalore" }).conversation;
  if (selection) {
    conversation = turn(conversation, { text: selection }).conversation;
  }
  return conversation;
}

describe("registration conversation Meta button validation", () => {
  it("validates welcome-back actions for common resume steps", () => {
    const steps: WhatsAppConversationState[] = [
      {
        ...createInitialConversationState("919876543210"),
        status: "ACTIVE",
        currentStep: "AWAITING_EMAIL",
        studentName: "Aarav Sharma",
      },
      {
        ...createInitialConversationState("919876543210"),
        status: "ACTIVE",
        currentStep: "AWAITING_COLLEGE",
        studentName: "Aarav Sharma",
        email: "aarav@example.com",
        classLabel: "Class 10",
        gender: "Male",
        board: "CBSE",
        interestedStream: "Commerce",
      },
      {
        ...createInitialConversationState("919876543210"),
        status: "READY_TO_REGISTER",
        currentStep: "READY_TO_REGISTER",
        studentName: "Aarav Sharma",
        email: "aarav@example.com",
        classLabel: "Class 10",
        gender: "Male",
        board: "CBSE",
        interestedStream: "Commerce",
        college: "VGS Public School",
        city: "Bangalore",
        selectedSeminarIds: ["sem-001"],
      },
    ];

    for (const conversation of steps) {
      expectAllButtonsPassMetaValidation(
        buildWelcomeBackPromptActions(conversation)
      );
    }
  });

  it("uses Continue and Start over labels within Meta limits", () => {
    const actions = buildWelcomeBackPromptActions({
      ...createInitialConversationState("919876543210"),
      status: "ACTIVE",
      currentStep: "AWAITING_EMAIL",
      studentName: "Aarav Sharma",
    });
    const buttons =
      actions[0]?.type === "BUTTONS" ? actions[0].buttons : [];
    expect(buttons).toEqual([
      {
        id: REGISTRATION_INTERACTIVE_IDS.CONTINUE,
        title: "Continue",
      },
      {
        id: REGISTRATION_INTERACTIVE_IDS.RESTART,
        title: "Start over",
      },
    ]);
  });

  it("validates fresh-start welcome buttons", () => {
    const result = turn(createInitialConversationState("919876543210"), {
      text: "hello",
    });
    expectAllButtonsPassMetaValidation(result.actions);
  });

  it("validates gender and stream selection buttons", () => {
    let conversation = turn(null, { text: "hi" }).conversation;
    conversation = turn(conversation, {
      interactiveId: REGISTRATION_INTERACTIVE_IDS.START,
    }).conversation;
    conversation = turn(conversation, { text: "Aarav Sharma" }).conversation;
    conversation = turn(conversation, { text: "aarav@example.com" }).conversation;
    conversation = turn(conversation, {
      interactiveId: classInteractiveId(REGISTRATION_CLASS_OPTIONS[0]!),
    }).conversation;

    expectAllButtonsPassMetaValidation(
      turn(conversation, {
        interactiveId: REGISTRATION_INTERACTIVE_IDS.CONTINUE,
      }).actions
    );

    conversation = turn(conversation, {
      interactiveId: genderInteractiveId(WHATSAPP_GENDER_OPTIONS[0]!),
    }).conversation;
    conversation = turn(conversation, {
      interactiveId: boardInteractiveId(REGISTRATION_BOARD_OPTIONS[0]!),
    }).conversation;

    expectAllButtonsPassMetaValidation(
      turn(conversation, {
        interactiveId: REGISTRATION_INTERACTIVE_IDS.CONTINUE,
      }).actions
    );
  });

  it("validates Finish Registration button after seminar selection", () => {
    const oneSelected = advanceToSeminarsStep("1");
    expectAllButtonsPassMetaValidation(
      turn(oneSelected, {
        interactiveId: REGISTRATION_INTERACTIVE_IDS.CONTINUE,
      }).actions
    );

    const twoSelected = advanceToSeminarsStep("1,2");
    expectAllButtonsPassMetaValidation(
      turn(twoSelected, {
        interactiveId: REGISTRATION_INTERACTIVE_IDS.CONTINUE,
      }).actions
    );
  });
});
