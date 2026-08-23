import { Prisma } from "@/lib/generated/prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();
const updateManyMock = vi.fn();

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    whatsAppInboundMessage: {
      create: (...args: unknown[]) => createMock(...args),
      updateMany: (...args: unknown[]) => updateManyMock(...args),
    },
  },
}));

import {
  claimWhatsAppInboundMessage,
  markWhatsAppInboundMessageProcessed,
} from "@/lib/server/whatsapp/whatsapp-inbound-message-store";

describe("whatsapp inbound message store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateManyMock.mockResolvedValue({ count: 1 });
  });

  it("claims a new message id", async () => {
    createMock.mockResolvedValue({ id: "inbound-1" });
    const result = await claimWhatsAppInboundMessage({
      messageId: "wamid.new",
      waId: "919876543210",
      messageType: "text",
    });
    expect(result).toBe("new");
    expect(createMock).toHaveBeenCalledWith({
      data: {
        messageId: "wamid.new",
        waId: "919876543210",
        messageType: "text",
      },
    });
  });

  it("returns duplicate for unique constraint violations", async () => {
    createMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "test",
      })
    );
    const result = await claimWhatsAppInboundMessage({
      messageId: "wamid.duplicate",
      waId: "919876543210",
      messageType: "text",
    });
    expect(result).toBe("duplicate");
  });

  it("does not persist message body content", async () => {
    createMock.mockResolvedValue({ id: "inbound-1" });
    await claimWhatsAppInboundMessage({
      messageId: "wamid.new",
      waId: "919876543210",
      messageType: "text",
    });
    expect(JSON.stringify(createMock.mock.calls[0])).not.toContain("body");
    expect(JSON.stringify(createMock.mock.calls[0])).not.toContain("textBody");
  });

  it("marks processed timestamps", async () => {
    await markWhatsAppInboundMessageProcessed("wamid.new");
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { messageId: "wamid.new", processedAt: null },
      data: { processedAt: expect.any(Date) },
    });
  });
});
