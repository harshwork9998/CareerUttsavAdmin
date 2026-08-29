import { beforeEach, describe, expect, it, vi } from "vitest";

const updateManyMock = vi.fn();
const transactionMock = vi.fn();
const findUniqueMock = vi.fn();
const deleteMock = vi.fn();
const eventFindUniqueMock = vi.fn();
const eventUpdateMock = vi.fn();
const resetConversationsMock = vi.fn();

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    registration: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      delete: (...args: unknown[]) => deleteMock(...args),
    },
    event: {
      findUnique: (...args: unknown[]) => eventFindUniqueMock(...args),
      update: (...args: unknown[]) => eventUpdateMock(...args),
    },
    $transaction: (...args: unknown[]) => transactionMock(...args),
  },
}));

vi.mock("@/lib/server/whatsapp/whatsapp-conversation-store", () => ({
  resetWhatsAppConversationsForDeletedRegistration: (...args: unknown[]) =>
    resetConversationsMock(...args),
}));

import { deletePrismaRegistration } from "@/lib/server/registration-prisma-store";

describe("deletePrismaRegistration whatsapp cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUniqueMock.mockResolvedValue({
      id: "reg-001",
      eventId: "evt-001",
    });
    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<void>) =>
      callback({
        registration: { delete: deleteMock },
        event: {
          findUnique: eventFindUniqueMock,
          update: eventUpdateMock,
        },
      })
    );
    resetConversationsMock.mockResolvedValue(1);
    deleteMock.mockResolvedValue({ id: "reg-001" });
    eventFindUniqueMock.mockResolvedValue({ registrationCount: 3 });
    eventUpdateMock.mockResolvedValue({});
  });

  it("resets linked WhatsApp conversations before deleting the registration", async () => {
    const result = await deletePrismaRegistration("reg-001");

    expect(result).toEqual({
      success: true,
      id: "reg-001",
      eventId: "evt-001",
    });
    expect(resetConversationsMock).toHaveBeenCalledWith(
      "reg-001",
      expect.objectContaining({
        registration: expect.objectContaining({ delete: deleteMock }),
      })
    );
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "reg-001" } });
  });
});
