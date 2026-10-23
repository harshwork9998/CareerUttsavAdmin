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
  processRegistrationConversationTurn,
  type SeminarOption,
  type WhatsAppConversationState,
} from "@/lib/server/whatsapp/registration-conversation";
import {
  WHATSAPP_SEMINAR_FINISH_REMINDER_PROMPT,
  WHATSAPP_SEMINAR_FINISH_SAVED_ONE,
  WHATSAPP_SEMINAR_FINISH_SAVED_THREE,
  WHATSAPP_SEMINAR_FINISH_SAVED_TWO,
  WHATSAPP_SEMINAR_IMAGE_CAPTION,
  WHATSAPP_SEMINAR_TOO_MANY_SESSIONS_MESSAGE,
} from "@/lib/server/whatsapp/whatsapp-artwork-seminar-catalog";
import { WHATSAPP_STALE_SEMINAR_RECOVERY_MESSAGE } from "@/lib/server/whatsapp/whatsapp-seminar-day-catalog";
import { mapStateToPrismaConversationData } from "@/lib/server/whatsapp/whatsapp-conversation-map";
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
    eventArtworkSeminarOptions: options,
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

function expectFinishRegistrationActions(
  actions: ReturnType<typeof turn>["actions"],
  body: string
) {
  expect(
    actions.some(
      (action) =>
        action.type === "BUTTONS" &&
        action.body === body &&
        action.buttons.some(
          (button) =>
            button.id === REGISTRATION_INTERACTIVE_IDS.FINISH &&
            button.title === "Finish Registration"
        )
    )
  ).toBe(true);
}

describe("WhatsApp artwork seminar flow", () => {
  const awaitingSeminars = advanceToSeminarSelectionStep();

  it("shows seminar image when entering seminar selection", () => {
    const result = turn(awaitingSeminars, {
      interactiveId: REGISTRATION_INTERACTIVE_IDS.CONTINUE,
    });
    expect(result.conversation.currentStep).toBe("AWAITING_SEMINARS");
    expect(
      result.actions.some(
        (action) =>
          action.type === "MEDIA" &&
          action.caption === WHATSAPP_SEMINAR_IMAGE_CAPTION
      )
    ).toBe(true);
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("Seminar Preferences")
      )
    ).toBe(false);
  });

  it.each([
    ["2", ["sem-2026-02"], WHATSAPP_SEMINAR_FINISH_SAVED_ONE],
    ["2,8", ["sem-2026-02", "sem-2026-08"], WHATSAPP_SEMINAR_FINISH_SAVED_TWO],
    [
      "2,8,14",
      ["sem-2026-02", "sem-2026-08", "sem-2026-14"],
      WHATSAPP_SEMINAR_FINISH_SAVED_THREE,
    ],
    [
      "2, 8, 14",
      ["sem-2026-02", "sem-2026-08", "sem-2026-14"],
      WHATSAPP_SEMINAR_FINISH_SAVED_THREE,
    ],
  ])(
    "accepts %s and returns Finish Registration",
    (input, expectedIds, acknowledgement) => {
      const result = turn(awaitingSeminars, { text: input });
      expect(result.conversation.currentStep).toBe("AWAITING_SEMINAR_FINISH");
      expect(result.conversation.selectedSeminarIds).toEqual(expectedIds);
      expectFinishRegistrationActions(result.actions, acknowledgement);
    }
  );

  it("rejects >3 without resending image", () => {
    const result = turn(awaitingSeminars, { text: "1,2,3,4" });
    expect(result.conversation.currentStep).toBe("AWAITING_SEMINARS");
    expect(result.conversation.selectedSeminarIds).toEqual([]);
    expect(result.actions).toEqual([
      { type: "TEXT", body: WHATSAPP_SEMINAR_TOO_MANY_SESSIONS_MESSAGE },
    ]);
  });

  it("re-prompts Finish Registration on ordinary text", () => {
    const selected = turn(awaitingSeminars, { text: "2,8" });
    const hello = turn(selected.conversation, { text: "hello" });
    expect(hello.conversation.selectedSeminarIds).toEqual([
      "sem-2026-02",
      "sem-2026-08",
    ]);
    expectFinishRegistrationActions(
      hello.actions,
      WHATSAPP_SEMINAR_FINISH_REMINDER_PROMPT
    );
  });

  it("persists AWAITING_SEMINAR_FINISH directly", () => {
    const selected = turn(awaitingSeminars, { text: "2,8,14" });
    const prismaData = mapStateToPrismaConversationData(
      selected.conversation,
      new Date("2026-09-16T12:00:00.000Z")
    );
    expect(prismaData.currentStep).toBe("AWAITING_SEMINAR_FINISH");
    expect(prismaData.selectedSeminarIds).toEqual([
      "sem-2026-02",
      "sem-2026-08",
      "sem-2026-14",
    ]);
  });

  it("stale recovery clears selections and sends image", () => {
    const recovery = buildInvalidSeminarRecoveryResult({
      ...awaitingSeminars,
      currentStep: "READY_TO_REGISTER",
      selectedSeminarIds: ["sem-2026-01", "sem-stale"],
    });
    expect(recovery.conversation.currentStep).toBe("AWAITING_SEMINARS");
    expect(recovery.conversation.selectedSeminarIds).toEqual([]);
    expect(
      recovery.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body === WHATSAPP_STALE_SEMINAR_RECOVERY_MESSAGE
      )
    ).toBe(true);
    expect(recovery.actions.some((action) => action.type === "MEDIA")).toBe(
      true
    );
  });
});
