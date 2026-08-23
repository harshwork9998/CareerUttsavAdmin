import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/server/prisma";

export type InboundMessageClaimResult = "new" | "duplicate";

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function claimWhatsAppInboundMessage(input: {
  messageId: string;
  waId: string;
  messageType: string;
}): Promise<InboundMessageClaimResult> {
  try {
    await prisma.whatsAppInboundMessage.create({
      data: {
        messageId: input.messageId,
        waId: input.waId,
        messageType: input.messageType,
      },
    });
    return "new";
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return "duplicate";
    }
    throw error;
  }
}

export async function markWhatsAppInboundMessageProcessed(
  messageId: string
): Promise<void> {
  await prisma.whatsAppInboundMessage.updateMany({
    where: { messageId, processedAt: null },
    data: { processedAt: new Date() },
  });
}
