import { CURRENT_EVENT_ID } from "@/lib/current-events";
import { requireIndianMobile } from "@/lib/indian-mobile";
import {
  getRegistrationForApi,
  resolveStudentRegistrationDuplicate,
} from "@/lib/server/registration-service";
import {
  createInitialConversationState,
  type WhatsAppConversationState,
} from "@/lib/server/whatsapp/registration-conversation";

export async function registrationExistsForConversationLink(
  registrationId: string | null | undefined
): Promise<boolean> {
  if (!registrationId) {
    return false;
  }
  const registration = await getRegistrationForApi(registrationId);
  return Boolean(registration);
}

export async function resolveCompletedRegistrationNumberForConversation(
  conversation: WhatsAppConversationState | null | undefined
): Promise<string | null> {
  if (!conversation?.completedRegistrationId) {
    return null;
  }
  const registration = await getRegistrationForApi(
    conversation.completedRegistrationId
  );
  return registration?.registrationNumber ?? null;
}

/**
 * Ensures a COMPLETED conversation still points at a live Registration.
 * Heals to another same-phone registration when one exists, otherwise resets
 * the conversation so the student can register again.
 */
export async function reconcileCompletedWhatsAppConversation(
  conversation: WhatsAppConversationState
): Promise<WhatsAppConversationState> {
  if (conversation.status !== "COMPLETED") {
    return conversation;
  }

  if (conversation.completedRegistrationId) {
    const stillExists = await registrationExistsForConversationLink(
      conversation.completedRegistrationId
    );
    if (stillExists) {
      return conversation;
    }
  }

  const phoneResult = requireIndianMobile(
    conversation.waId,
    "WhatsApp mobile number"
  );
  if (phoneResult.ok) {
    const duplicate = await resolveStudentRegistrationDuplicate({
      eventId: CURRENT_EVENT_ID,
      phone: phoneResult.mobile,
    });
    if (
      duplicate?.resolution?.outcome === "phone" ||
      duplicate?.resolution?.outcome === "both"
    ) {
      return {
        ...createInitialConversationState(conversation.waId),
        status: "COMPLETED",
        currentStep: "COMPLETED",
        completedRegistrationId: duplicate.resolution.registration.id,
      };
    }
  }

  return createInitialConversationState(conversation.waId);
}
