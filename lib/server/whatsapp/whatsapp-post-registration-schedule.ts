import { normalizeWaId } from "@/lib/server/whatsapp/registration-conversation";
import type { WhatsAppConversationState } from "@/lib/server/whatsapp/registration-conversation";
import {
  postRegistrationGrowthDueAt,
  type PostRegistrationGrowthKind,
} from "@/lib/server/whatsapp/whatsapp-post-registration-messages";
import { insertPostRegistrationGrowthTriggers } from "@/lib/server/whatsapp/whatsapp-post-registration-store";
import { startPostRegistrationGrowthWorker } from "@/lib/server/whatsapp/whatsapp-post-registration-worker";

const GROWTH_KINDS: PostRegistrationGrowthKind[] = [
  "INSTAGRAM",
  "PARENT_INVITE",
  "FRIEND_INVITE",
];

export function postRegistrationGrowthScheduleBlockReason(input: {
  waId: string;
  registrationId: string;
  conversation: WhatsAppConversationState | null;
}): string | null {
  if (!normalizeWaId(input.waId)) return "missing_wa_id";
  if (!input.registrationId.trim()) return "missing_registration";
  if (!input.conversation) return "missing_conversation";
  if (input.conversation.status === "CANCELLED") return "cancelled";
  if (
    input.conversation.status !== "COMPLETED" ||
    input.conversation.currentStep !== "COMPLETED"
  ) {
    return "not_completed";
  }
  if (input.conversation.completedRegistrationId !== input.registrationId) {
    return "registration_mismatch";
  }
  return null;
}

export async function schedulePostRegistrationGrowthTriggers(input: {
  waId: string;
  registrationId: string;
  completedAt: Date;
  conversation: WhatsAppConversationState | null;
}): Promise<{ scheduled: boolean; reason?: string }> {
  const reason = postRegistrationGrowthScheduleBlockReason(input);
  if (reason) {
    return { scheduled: false, reason };
  }

  const dueAt = postRegistrationGrowthDueAt(input.completedAt);
  const waId = normalizeWaId(input.waId);
  await insertPostRegistrationGrowthTriggers(
    GROWTH_KINDS.map((kind) => ({
      waId,
      registrationId: input.registrationId,
      kind,
      dueAt: dueAt[kind],
    }))
  );
  if (process.env.VITEST !== "true") {
    startPostRegistrationGrowthWorker();
  }
  return { scheduled: true };
}
