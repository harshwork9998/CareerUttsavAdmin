import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WhatsAppConversationState } from "@/lib/server/whatsapp/registration-conversation";

const claimMock = vi.fn();
const markProcessedMock = vi.fn();
const loadConversationMock = vi.fn();
const saveConversationMock = vi.fn();
const deleteExpiredMock = vi.fn();
const getSeminarsMock = vi.fn();
const dispatchMock = vi.fn();
const processTurnMock = vi.fn();

vi.mock("@/lib/server/whatsapp/whatsapp-inbound-message-store", () => ({
  claimWhatsAppInboundMessage: (...args: unknown[]) => claimMock(...args),
  markWhatsAppInboundMessageProcessed: (...args: unknown[]) =>
    markProcessedMock(...args),
}));

vi.mock("@/lib/server/whatsapp/whatsapp-conversation-store", () => ({
  loadWhatsAppConversationForWaId: (...args: unknown[]) =>
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

vi.mock("@/lib/server/whatsapp/registration-conversation", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/server/whatsapp/registration-conversation")
  >("@/lib/server/whatsapp/registration-conversation");
  return {
    ...actual,
    processRegistrationConversationTurn: (...args: unknown[]) =>
      processTurnMock(...args),
  };
});

import { processVerifiedWhatsAppWebhook } from "@/lib/server/whatsapp/whatsapp-webhook-processor";

const baseConversation: WhatsAppConversationState = {
  waId: "919876543210",
  status: "ACTIVE",
  currentStep: "AWAITING_EMAIL",
  studentName: "Aarav Sharma",
  email: null,
  classLabel: null,
  gender: null,
  board: null,
  interestedStream: null,
  college: null,
  city: null,
  selectedSeminarIds: [],
};

function buildTextWebhook(messageId: string, body: string) {
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
                  from: "919876543210",
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

describe("whatsapp webhook processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    claimMock.mockResolvedValue("new");
    markProcessedMock.mockResolvedValue(undefined);
    loadConversationMock.mockResolvedValue(null);
    saveConversationMock.mockImplementation(async (state: WhatsAppConversationState) => state);
    deleteExpiredMock.mockResolvedValue(undefined);
    getSeminarsMock.mockResolvedValue([{ id: "sem-001", title: "AI Careers" }]);
    processTurnMock.mockReturnValue({
      conversation: baseConversation,
      actions: [{ type: "TEXT", body: "Please enter your email address." }],
      refreshExpiry: true,
    });
  });

  it("deduplicates repeated Meta messageId without mutating conversation twice", async () => {
    claimMock.mockResolvedValueOnce("new").mockResolvedValueOnce("duplicate");
    const rawBody = buildTextWebhook("wamid.duplicate-test", "aarav@example.com");

    await processVerifiedWhatsAppWebhook(rawBody);
    await processVerifiedWhatsAppWebhook(rawBody);

    expect(processTurnMock).toHaveBeenCalledTimes(1);
    expect(saveConversationMock).toHaveBeenCalledTimes(1);
    expect(markProcessedMock).toHaveBeenCalledTimes(1);
  });

  it("ignores unsupported message types without conversation mutation", async () => {
    const rawBody = JSON.stringify({
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
                    id: "wamid.audio",
                    timestamp: "1504902988",
                    type: "audio",
                  },
                ],
              },
              field: "messages",
            },
          ],
        },
      ],
    });

    await processVerifiedWhatsAppWebhook(rawBody);

    expect(processTurnMock).not.toHaveBeenCalled();
    expect(saveConversationMock).not.toHaveBeenCalled();
    expect(markProcessedMock).toHaveBeenCalledWith("wamid.audio");
  });

  it("does not enter the conversation engine for status-only payloads", async () => {
    const rawBody = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                statuses: [
                  {
                    id: "wamid.status",
                    status: "delivered",
                    timestamp: "1504902988",
                    recipient_id: "919876543210",
                  },
                ],
              },
              field: "messages",
            },
          ],
        },
      ],
    });

    await processVerifiedWhatsAppWebhook(rawBody);

    expect(claimMock).not.toHaveBeenCalled();
    expect(processTurnMock).not.toHaveBeenCalled();
  });

  it("processes a text message through the conversation engine", async () => {
    await processVerifiedWhatsAppWebhook(
      buildTextWebhook("wamid.text", "aarav@example.com")
    );

    expect(claimMock).toHaveBeenCalledWith({
      messageId: "wamid.text",
      waId: "919876543210",
      messageType: "text",
    });
    expect(processTurnMock).toHaveBeenCalledOnce();
    expect(dispatchMock).toHaveBeenCalledOnce();
    expect(markProcessedMock).toHaveBeenCalledWith("wamid.text");
  });

  it("does not log full phone numbers or message bodies", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    await processVerifiedWhatsAppWebhook(
      buildTextWebhook("wamid.privacy", "secret-body-text")
    );
    const serialized = JSON.stringify(infoSpy.mock.calls);
    expect(serialized).not.toContain("secret-body-text");
    expect(serialized).not.toContain("919876543210");
    infoSpy.mockRestore();
  });
});
