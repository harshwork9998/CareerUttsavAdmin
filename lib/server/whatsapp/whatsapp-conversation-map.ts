import type {
  WhatsAppConversationState,
  WhatsAppConversationStatus,
  WhatsAppConversationStep,
} from "@/lib/server/whatsapp/registration-conversation";
import type {
  WhatsAppConversationStatus as PrismaWhatsAppConversationStatus,
  WhatsAppConversationStep as PrismaWhatsAppConversationStep,
  Gender,
} from "@/lib/generated/prisma/client";
import type { WhatsAppRegistrationConversation } from "@/lib/generated/prisma/client";

function parseSelectedSeminarIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

export function mapPrismaConversationToState(
  record: WhatsAppRegistrationConversation
): WhatsAppConversationState {
  return {
    waId: record.waId,
    status: record.status as WhatsAppConversationStatus,
    currentStep: record.currentStep as WhatsAppConversationStep,
    studentName: record.studentName,
    email: record.email,
    classLabel: record.classLabel,
    gender:
      record.gender === "Male" || record.gender === "Female"
        ? record.gender
        : null,
    board: record.board,
    interestedStream: record.interestedStream,
    college: record.college,
    city: record.city,
    selectedSeminarIds: parseSelectedSeminarIds(record.selectedSeminarIds),
    completedRegistrationId: record.completedRegistrationId,
  };
}

export function mapStateToPrismaConversationData(
  state: WhatsAppConversationState,
  expiresAt: Date
) {
  return {
    waId: state.waId,
    status: state.status as PrismaWhatsAppConversationStatus,
    currentStep: state.currentStep as PrismaWhatsAppConversationStep,
    studentName: state.studentName,
    email: state.email,
    classLabel: state.classLabel,
    gender: state.gender as Gender | null,
    board: state.board,
    interestedStream: state.interestedStream,
    college: state.college,
    city: state.city,
    selectedSeminarIds: state.selectedSeminarIds,
    completedRegistrationId: state.completedRegistrationId ?? null,
    expiresAt,
  };
}
