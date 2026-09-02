import { prisma } from "@/lib/server/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  WHATSAPP_CONVERSATION_TTL_MS,
  type WhatsAppConversationState,
} from "@/lib/server/whatsapp/registration-conversation";
import {
  mapPrismaConversationToState,
  mapStateToPrismaConversationData,
} from "@/lib/server/whatsapp/whatsapp-conversation-map";

function conversationExpiryFromNow(): Date {
  return new Date(Date.now() + WHATSAPP_CONVERSATION_TTL_MS);
}

function isExpired(record: { expiresAt: Date; status: string }): boolean {
  return (
    (record.status === "ACTIVE" || record.status === "READY_TO_REGISTER") &&
    record.expiresAt.getTime() <= Date.now()
  );
}

export async function loadWhatsAppConversationRecordByWaId(
  waId: string
): Promise<WhatsAppConversationState | null> {
  const loaded = await loadWhatsAppConversationTurnContext(waId);
  return loaded.conversation;
}

export async function loadWhatsAppConversationTurnContext(waId: string): Promise<{
  conversation: WhatsAppConversationState | null;
  previousActivityAt: Date | null;
}> {
  const record = await prisma.whatsAppRegistrationConversation.findUnique({
    where: { waId },
  });

  if (!record) {
    return { conversation: null, previousActivityAt: null };
  }

  if (isExpired(record)) {
    return { conversation: null, previousActivityAt: null };
  }

  return {
    conversation: mapPrismaConversationToState(record),
    previousActivityAt: new Date(
      record.expiresAt.getTime() - WHATSAPP_CONVERSATION_TTL_MS
    ),
  };
}

export async function loadWhatsAppConversationForWaId(
  waId: string
): Promise<WhatsAppConversationState | null> {
  return loadWhatsAppConversationRecordByWaId(waId);
}

export async function saveWhatsAppConversationState(
  state: WhatsAppConversationState,
  options: { refreshExpiry: boolean }
): Promise<WhatsAppConversationState> {
  const expiresAt = options.refreshExpiry
    ? conversationExpiryFromNow()
    : (
        await prisma.whatsAppRegistrationConversation.findUnique({
          where: { waId: state.waId },
          select: { expiresAt: true },
        })
      )?.expiresAt ?? conversationExpiryFromNow();

  const data = mapStateToPrismaConversationData(state, expiresAt);

  const saved = await prisma.whatsAppRegistrationConversation.upsert({
    where: { waId: state.waId },
    create: data,
    update: data,
  });

  return mapPrismaConversationToState(saved);
}

const clearedWhatsAppConversationForDeletedRegistration = {
  status: "CANCELLED" as const,
  currentStep: "CANCELLED" as const,
  completedRegistrationId: null,
  studentName: null,
  email: null,
  classLabel: null,
  gender: null,
  board: null,
  interestedStream: null,
  college: null,
  city: null,
  selectedSeminarIds: [] as string[],
};

export async function resetWhatsAppConversationsForDeletedRegistration(
  registrationId: string,
  tx: Prisma.TransactionClient = prisma
): Promise<number> {
  const result = await tx.whatsAppRegistrationConversation.updateMany({
    where: { completedRegistrationId: registrationId },
    data: clearedWhatsAppConversationForDeletedRegistration,
  });
  return result.count;
}

export async function linkWhatsAppConversationToRegistration(input: {
  waId: string;
  registrationId: string;
}): Promise<WhatsAppConversationState | null> {
  await prisma.whatsAppRegistrationConversation.updateMany({
    where: {
      waId: input.waId,
      completedRegistrationId: null,
      status: { not: "COMPLETED" },
    },
    data: {
      completedRegistrationId: input.registrationId,
      status: "COMPLETED",
      currentStep: "COMPLETED",
    },
  });

  return loadWhatsAppConversationRecordByWaId(input.waId);
}

export async function finalizeWhatsAppConversationRegistration(input: {
  waId: string;
  registrationId: string;
}): Promise<WhatsAppConversationState | null> {
  const linked = await linkWhatsAppConversationToRegistration(input);
  if (linked) {
    return linked;
  }

  const updated = await prisma.whatsAppRegistrationConversation.updateMany({
    where: {
      waId: input.waId,
      completedRegistrationId: null,
      status: "READY_TO_REGISTER",
    },
    data: {
      completedRegistrationId: input.registrationId,
      status: "COMPLETED",
      currentStep: "COMPLETED",
    },
  });

  if (updated.count === 0) {
    return null;
  }

  return loadWhatsAppConversationRecordByWaId(input.waId);
}

export async function cancelWhatsAppConversationForEmailDuplicate(
  waId: string
): Promise<WhatsAppConversationState | null> {
  await prisma.whatsAppRegistrationConversation.updateMany({
    where: {
      waId,
      completedRegistrationId: null,
      status: { not: "COMPLETED" },
    },
    data: {
      status: "CANCELLED",
      currentStep: "CANCELLED",
    },
  });

  return loadWhatsAppConversationRecordByWaId(waId);
}

export async function deleteExpiredWhatsAppConversation(
  waId: string
): Promise<boolean> {
  const record = await prisma.whatsAppRegistrationConversation.findUnique({
    where: { waId },
  });
  if (!record) return false;
  if (!isExpired(record)) return false;
  await prisma.whatsAppRegistrationConversation.delete({ where: { waId } });
  return true;
}
