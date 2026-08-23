import { prisma } from "@/lib/server/prisma";
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
  return record.status === "ACTIVE" && record.expiresAt.getTime() <= Date.now();
}

export async function loadWhatsAppConversationRecordByWaId(
  waId: string
): Promise<WhatsAppConversationState | null> {
  const record = await prisma.whatsAppRegistrationConversation.findUnique({
    where: { waId },
  });

  if (!record) {
    return null;
  }

  if (isExpired(record)) {
    return null;
  }

  return mapPrismaConversationToState(record);
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

export async function finalizeWhatsAppConversationRegistration(input: {
  waId: string;
  registrationId: string;
}): Promise<WhatsAppConversationState | null> {
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
      status: "READY_TO_REGISTER",
    },
    data: {
      status: "CANCELLED",
      currentStep: "CANCELLED",
    },
  });

  return loadWhatsAppConversationRecordByWaId(waId);
}

export async function deleteExpiredWhatsAppConversation(waId: string): Promise<void> {
  const record = await prisma.whatsAppRegistrationConversation.findUnique({
    where: { waId },
  });
  if (!record) return;
  if (!isExpired(record)) return;
  await prisma.whatsAppRegistrationConversation.delete({ where: { waId } });
}
