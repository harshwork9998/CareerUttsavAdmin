import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WhatsAppConversationState } from "@/lib/server/whatsapp/registration-conversation";
import { resetWaIdSerializerForTests } from "@/lib/server/whatsapp/whatsapp-wa-id-serializer";

const claimMock = vi.fn();
const markProcessedMock = vi.fn();
const loadConversationMock = vi.fn();
const saveConversationMock = vi.fn();
const deleteExpiredMock = vi.fn();
const getSeminarsMock = vi.fn();
const dispatchMock = vi.fn();
const processTurnMock = vi.fn();
const completeMock = vi.fn();

vi.mock("@/lib/server/whatsapp/whatsapp-inbound-message-store", () => ({
  claimWhatsAppInboundMessage: (...args: unknown[]) => claimMock(...args),
  markWhatsAppInboundMessageProcessed: (...args: unknown[]) =>
    markProcessedMock(...args),
}));

vi.mock("@/lib/server/whatsapp/whatsapp-conversation-store", () => ({
  loadWhatsAppConversationTurnContext: (...args: unknown[]) =>
    loadConversationMock(...args),
  saveWhatsAppConversationState: (...args: unknown[]) =>
    saveConversationMock(...args),
  deleteExpiredWhatsAppConversation: (...args: unknown[]) =>
    deleteExpiredMock(...args),
}));

vi.mock("@/lib/server/whatsapp/whatsapp-seminar-context", () => ({
  getWhatsAppSeminarOptions: (...args: unknown[]) => getSeminarsMock(...args),
}));

vi.mock("@/lib/server/whatsapp/whatsapp-bot-dispatcher", () => ({
  dispatchWhatsAppBotActions: (...args: unknown[]) => dispatchMock(...args),
}));

vi.mock("@/lib/server/whatsapp/whatsapp-registration-duplicate-flow", () => ({
  processWhatsAppRegistrationConversationTurnAsync: (...args: unknown[]) =>
    processTurnMock(...args),
}));

vi.mock("@/lib/server/registration-service", () => ({
  getRegistrationForApi: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/server/whatsapp/whatsapp-registration-completion", () => ({
  completeWhatsAppRegistrationForConversation: (...args: unknown[]) =>
    completeMock(...args),
}));

import { processVerifiedWhatsAppWebhook } from "@/lib/server/whatsapp/whatsapp-webhook-processor";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildTextWebhook(messageId: string, body: string, from = "919876543210") {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              messages: [
                {
                  from,
                  id: messageId,
                  timestamp: "1504902988",
                  type: "text",
                  text: { body },
                },
              ],
            },
            field: "messages",
          },
        ],
      },
    ],
  });
}

const collegeStepConversation: WhatsAppConversationState = {
  waId: "919876543210",
  status: "ACTIVE",
  currentStep: "AWAITING_COLLEGE",
  studentName: "Aarav Sharma",
  email: "aarav@example.com",
  classLabel: "Class 10",
  gender: "Male",
  board: "CBSE",
  interestedStream: "Commerce",
  college: null,
  city: null,
  selectedSeminarIds: [],
  completedRegistrationId: null,
};

describe("whatsapp webhook processor same-waId serialization", () => {
  let storedConversation: WhatsAppConversationState;

  beforeEach(() => {
    vi.clearAllMocks();
    resetWaIdSerializerForTests();
    storedConversation = { ...collegeStepConversation };
    claimMock.mockResolvedValue("new");
    markProcessedMock.mockResolvedValue(undefined);
    deleteExpiredMock.mockResolvedValue(false);
    getSeminarsMock.mockResolvedValue([{ id: "sem-001", title: "AI Careers" }]);
    loadConversationMock.mockImplementation(async () => ({
      conversation: storedConversation,
      previousActivityAt: new Date(Date.now() - 10_000),
    }));
    saveConversationMock.mockImplementation(
      async (state: WhatsAppConversationState) => {
        storedConversation = state;
        return state;
      }
    );
    dispatchMock.mockResolvedValue({ dispatched: 1, failed: 0, results: [] });
    completeMock.mockResolvedValue({
      status: "SUCCESS",
      actions: [],
      conversation: storedConversation,
    });
  });

  afterEach(() => {
    resetWaIdSerializerForTests();
  });

  it("serializes two different messageIds for the same waId", async () => {
    const claimOrder: string[] = [];
    claimMock.mockImplementation(async (input: { messageId: string }) => {
      claimOrder.push(input.messageId);
      if (input.messageId === "wamid-a") {
        await delay(40);
      }
      return "new";
    });

    processTurnMock.mockResolvedValue({
      conversation: storedConversation,
      actions: [{ type: "TEXT", body: "ok" }],
      refreshExpiry: true,
    });

    await Promise.all([
      processVerifiedWhatsAppWebhook(buildTextWebhook("wamid-a", "first")),
      processVerifiedWhatsAppWebhook(buildTextWebhook("wamid-b", "second")),
    ]);

    expect(claimOrder).toEqual(["wamid-a", "wamid-b"]);
  });

  it("lets the second message load state saved by the first", async () => {
    const loadedSteps: string[] = [];
    loadConversationMock.mockImplementation(async () => {
      loadedSteps.push(storedConversation.currentStep);
      return {
        conversation: storedConversation,
        previousActivityAt: new Date(Date.now() - 10_000),
      };
    });

    processTurnMock.mockImplementation(
      async (input: {
        message: { text?: string };
        conversation: WhatsAppConversationState | null;
      }) => {
        const current = input.conversation ?? storedConversation;
        if (
          current.currentStep === "AWAITING_COLLEGE" &&
          input.message.text === "VGS Public School"
        ) {
          return {
            conversation: {
              ...current,
              college: "VGS Public School",
              currentStep: "AWAITING_CITY",
            },
            actions: [{ type: "TEXT", body: "prompt-city" }],
            refreshExpiry: true,
          };
        }
        if (
          current.currentStep === "AWAITING_CITY" &&
          input.message.text === "Bengaluru"
        ) {
          return {
            conversation: {
              ...current,
              city: "Bengaluru",
              currentStep: "AWAITING_SEMINARS",
            },
            actions: [{ type: "TEXT", body: "prompt-seminars" }],
            refreshExpiry: true,
          };
        }
        throw new Error(
          `unexpected turn for ${current.currentStep} / ${input.message.text}`
        );
      }
    );

    await Promise.all([
      processVerifiedWhatsAppWebhook(
        buildTextWebhook("wamid-college", "VGS Public School")
      ),
      processVerifiedWhatsAppWebhook(buildTextWebhook("wamid-city", "Bengaluru")),
    ]);

    expect(loadedSteps).toEqual(["AWAITING_COLLEGE", "AWAITING_CITY"]);
    expect(storedConversation.college).toBe("VGS Public School");
    expect(storedConversation.city).toBe("Bengaluru");
    expect(storedConversation.currentStep).toBe("AWAITING_SEMINARS");
  });

  it("dispatches outbound actions in message order for the same waId", async () => {
    const dispatchBodies: string[] = [];

    processTurnMock.mockImplementation(
      async (input: { message: { text?: string } }) => {
        if (input.message.text === "VGS Public School") {
          await delay(30);
          return {
            conversation: {
              ...storedConversation,
              college: "VGS Public School",
              currentStep: "AWAITING_CITY",
            },
            actions: [{ type: "TEXT", body: "outbound-college-step" }],
            refreshExpiry: true,
          };
        }
        return {
          conversation: {
            ...storedConversation,
            city: "Bengaluru",
            currentStep: "AWAITING_SEMINARS",
          },
          actions: [{ type: "TEXT", body: "outbound-city-step" }],
          refreshExpiry: true,
        };
      }
    );

    dispatchMock.mockImplementation(
      async (_waId: string, actions: Array<{ body?: string }>) => {
        for (const action of actions) {
          if (action.body) {
            dispatchBodies.push(action.body);
          }
        }
        await delay(10);
        return { dispatched: actions.length, failed: 0, results: [] };
      }
    );

    await Promise.all([
      processVerifiedWhatsAppWebhook(
        buildTextWebhook("wamid-college", "VGS Public School")
      ),
      processVerifiedWhatsAppWebhook(buildTextWebhook("wamid-city", "Bengaluru")),
    ]);

    expect(dispatchBodies).toEqual(["outbound-college-step", "outbound-city-step"]);
  });

  it("preserves two rapid seminar selections uniquely", async () => {
    storedConversation = {
      ...collegeStepConversation,
      currentStep: "AWAITING_SEMINARS",
      college: "VGS Public School",
      city: "Bengaluru",
    };

    processTurnMock.mockImplementation(
      async (input: {
        message: { interactiveId?: string };
        conversation: WhatsAppConversationState | null;
      }) => {
        const current = input.conversation ?? storedConversation;
        const seminarId = input.message.interactiveId?.replace("seminar:", "");
        if (!seminarId) {
          throw new Error("expected seminar interactive id");
        }
        const selectedSeminarIds = current.selectedSeminarIds.includes(seminarId)
          ? current.selectedSeminarIds
          : [...current.selectedSeminarIds, seminarId];
        return {
          conversation: { ...current, selectedSeminarIds },
          actions: [{ type: "TEXT", body: `selected-${seminarId}` }],
          refreshExpiry: true,
        };
      }
    );

    await Promise.all([
      processVerifiedWhatsAppWebhook(
        JSON.stringify({
          object: "whatsapp_business_account",
          entry: [
            {
              changes: [
                {
                  value: {
                    messaging_product: "whatsapp",
                    messages: [
                      {
                        from: "919876543210",
                        id: "wamid-sem-1",
                        timestamp: "1504902988",
                        type: "interactive",
                        interactive: {
                          type: "list_reply",
                          list_reply: { id: "seminar:sem-001", title: "AI Careers" },
                        },
                      },
                    ],
                  },
                  field: "messages",
                },
              ],
            },
          ],
        })
      ),
      processVerifiedWhatsAppWebhook(
        JSON.stringify({
          object: "whatsapp_business_account",
          entry: [
            {
              changes: [
                {
                  value: {
                    messaging_product: "whatsapp",
                    messages: [
                      {
                        from: "919876543210",
                        id: "wamid-sem-2",
                        timestamp: "1504902989",
                        type: "interactive",
                        interactive: {
                          type: "list_reply",
                          list_reply: {
                            id: "seminar:sem-002",
                            title: "Design Thinking",
                          },
                        },
                      },
                    ],
                  },
                  field: "messages",
                },
              ],
            },
          ],
        })
      ),
    ]);

    expect(storedConversation.selectedSeminarIds).toEqual(["sem-001", "sem-002"]);
  });

  it("serializes READY_TO_REGISTER completion calls for the same waId", async () => {
    let completionActive = 0;
    let maxConcurrentCompletions = 0;

    processTurnMock.mockResolvedValue({
      conversation: {
        ...storedConversation,
        status: "READY_TO_REGISTER",
        currentStep: "READY_TO_REGISTER",
      },
      actions: [],
      refreshExpiry: true,
    });

    completeMock.mockImplementation(async () => {
      completionActive += 1;
      maxConcurrentCompletions = Math.max(
        maxConcurrentCompletions,
        completionActive
      );
      await delay(30);
      completionActive -= 1;
      return {
        status: "SUCCESS",
        actions: [{ type: "TEXT", body: "registered" }],
        conversation: {
          ...storedConversation,
          status: "COMPLETED",
          currentStep: "COMPLETED",
          completedRegistrationId: "reg-001",
        },
      };
    });

    await Promise.all([
      processVerifiedWhatsAppWebhook(buildTextWebhook("wamid-ready-1", "finish-1")),
      processVerifiedWhatsAppWebhook(buildTextWebhook("wamid-ready-2", "finish-2")),
    ]);

    expect(maxConcurrentCompletions).toBe(1);
    expect(completeMock).toHaveBeenCalledTimes(2);
  });

  it("still ignores duplicate identical messageIds", async () => {
    claimMock.mockResolvedValueOnce("new").mockResolvedValueOnce("duplicate");
    processTurnMock.mockResolvedValue({
      conversation: storedConversation,
      actions: [{ type: "TEXT", body: "ok" }],
      refreshExpiry: true,
    });

    const rawBody = buildTextWebhook("wamid-dup", "hello");
    await processVerifiedWhatsAppWebhook(rawBody);
    await processVerifiedWhatsAppWebhook(rawBody);

    expect(processTurnMock).toHaveBeenCalledTimes(1);
    expect(markProcessedMock).toHaveBeenCalledTimes(1);
  });

  it("serializes two simultaneous first messages with no existing conversation row", async () => {
    storedConversation = {
      waId: "919876543210",
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

    const claimOrder: string[] = [];
    claimMock.mockImplementation(async (input: { messageId: string }) => {
      claimOrder.push(input.messageId);
      if (input.messageId === "wamid-first-a") {
        await delay(25);
      }
      return "new";
    });

    processTurnMock.mockImplementation(
      async (input: {
        message: { text?: string };
        conversation: WhatsAppConversationState | null;
      }) => {
        if (input.message.text === "hi") {
          return {
            conversation: storedConversation,
            actions: [{ type: "TEXT", body: "welcome-back-or-welcome" }],
            refreshExpiry: true,
          };
        }
        return {
          conversation: {
            ...storedConversation,
            currentStep: "AWAITING_NAME",
          },
          actions: [{ type: "TEXT", body: "name-step" }],
          refreshExpiry: true,
        };
      }
    );

    await Promise.all([
      processVerifiedWhatsAppWebhook(buildTextWebhook("wamid-first-a", "hi")),
      processVerifiedWhatsAppWebhook(buildTextWebhook("wamid-first-b", "hello")),
    ]);

    expect(claimOrder).toEqual(["wamid-first-a", "wamid-first-b"]);
    expect(processTurnMock).toHaveBeenCalledTimes(2);
  });

  it("serializes restart followed immediately by an answer", async () => {
    storedConversation = {
      ...collegeStepConversation,
      currentStep: "AWAITING_EMAIL",
      studentName: "Aarav Sharma",
    };

    const turnLog: string[] = [];
    processTurnMock.mockImplementation(
      async (input: {
        message: { text?: string };
        conversation: WhatsAppConversationState | null;
      }) => {
        const current = input.conversation ?? storedConversation;
        turnLog.push(`${current.currentStep}:${input.message.text ?? ""}`);
        if (input.message.text === "restart") {
          return {
            conversation: {
              ...current,
              status: "ACTIVE",
              currentStep: "AWAITING_NAME",
              studentName: null,
              email: null,
              selectedSeminarIds: [],
            },
            actions: [{ type: "TEXT", body: "restart-name-step" }],
            refreshExpiry: true,
          };
        }
        if (
          current.currentStep === "AWAITING_NAME" &&
          input.message.text === "New Name"
        ) {
          return {
            conversation: { ...current, studentName: "New Name", currentStep: "AWAITING_EMAIL" },
            actions: [{ type: "TEXT", body: "email-step" }],
            refreshExpiry: true,
          };
        }
        throw new Error(`unexpected ${current.currentStep} / ${input.message.text}`);
      }
    );

    await Promise.all([
      processVerifiedWhatsAppWebhook(buildTextWebhook("wamid-restart", "restart")),
      processVerifiedWhatsAppWebhook(buildTextWebhook("wamid-name", "New Name")),
    ]);

    expect(turnLog).toEqual(["AWAITING_EMAIL:restart", "AWAITING_NAME:New Name"]);
    expect(storedConversation.studentName).toBe("New Name");
    expect(storedConversation.currentStep).toBe("AWAITING_EMAIL");
  });

  it("serializes finish with a concurrent stale follow-up action", async () => {
    storedConversation = {
      ...collegeStepConversation,
      currentStep: "AWAITING_SEMINARS",
      college: "VGS Public School",
      city: "Bengaluru",
      selectedSeminarIds: ["sem-001"],
    };

    processTurnMock.mockImplementation(
      async (input: {
        message: { text?: string; interactiveId?: string };
        conversation: WhatsAppConversationState | null;
      }) => {
        const current = input.conversation ?? storedConversation;
        if (input.message.text === "done") {
          await delay(25);
          return {
            conversation: {
              ...current,
              status: "READY_TO_REGISTER",
              currentStep: "READY_TO_REGISTER",
            },
            actions: [],
            refreshExpiry: true,
          };
        }
        if (input.message.interactiveId === "seminar:sem-002") {
          return {
            conversation: {
              ...current,
              selectedSeminarIds: [...current.selectedSeminarIds, "sem-002"],
            },
            actions: [{ type: "TEXT", body: "added-sem-002" }],
            refreshExpiry: true,
          };
        }
        throw new Error("unexpected concurrent action");
      }
    );

    completeMock.mockResolvedValue({
      status: "SUCCESS",
      actions: [{ type: "TEXT", body: "registered" }],
      conversation: {
        ...storedConversation,
        status: "COMPLETED",
        currentStep: "COMPLETED",
        completedRegistrationId: "reg-001",
      },
    });

    await Promise.all([
      processVerifiedWhatsAppWebhook(buildTextWebhook("wamid-finish", "done")),
      processVerifiedWhatsAppWebhook(
        JSON.stringify({
          object: "whatsapp_business_account",
          entry: [
            {
              changes: [
                {
                  value: {
                    messaging_product: "whatsapp",
                    messages: [
                      {
                        from: "919876543210",
                        id: "wamid-sem-followup",
                        timestamp: "1504902988",
                        type: "interactive",
                        interactive: {
                          type: "list_reply",
                          list_reply: { id: "seminar:sem-002", title: "Design Thinking" },
                        },
                      },
                    ],
                  },
                  field: "messages",
                },
              ],
            },
          ],
        })
      ),
    ]);

    expect(storedConversation.status).toBe("COMPLETED");
    expect(completeMock).toHaveBeenCalledTimes(1);
  });

  it("does not block different waIds", async () => {
    const events: string[] = [];
    claimMock.mockImplementation(async (input: { messageId: string; waId: string }) => {
      events.push(`claim-start:${input.waId}:${input.messageId}`);
      if (input.waId === "919876543210") {
        await delay(40);
      }
      events.push(`claim-end:${input.waId}:${input.messageId}`);
      return "new";
    });
    processTurnMock.mockResolvedValue({
      conversation: storedConversation,
      actions: [{ type: "TEXT", body: "ok" }],
      refreshExpiry: true,
    });

    await Promise.all([
      processVerifiedWhatsAppWebhook(
        buildTextWebhook("wamid-slow", "slow", "919876543210")
      ),
      processVerifiedWhatsAppWebhook(
        buildTextWebhook("wamid-fast", "fast", "919999999999")
      ),
    ]);

    expect(events.indexOf("claim-end:919999999999:wamid-fast")).toBeLessThan(
      events.indexOf("claim-end:919876543210:wamid-slow")
    );
  });
});
