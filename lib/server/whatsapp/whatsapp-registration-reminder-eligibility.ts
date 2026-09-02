import {
  computePreviousActivityAtFromExpiresAt,
  type WhatsAppConversationState,
} from "@/lib/server/whatsapp/registration-conversation";
import {
  WHATSAPP_REMINDER_2H_MS,
  WHATSAPP_REMINDER_6H_MS,
  WHATSAPP_REMINDER_24H_MS,
  WHATSAPP_REMINDER_RETRY_THROTTLE_MS,
} from "@/lib/server/whatsapp/whatsapp-registration-reminder-config";

const CORE_FIELD_KEYS = [
  "studentName",
  "email",
  "classLabel",
  "gender",
  "board",
  "interestedStream",
  "college",
  "city",
] as const satisfies readonly (keyof WhatsAppConversationState)[];

export function countCompletedCoreFields(
  conversation: WhatsAppConversationState
): number {
  let count = 0;
  for (const key of CORE_FIELD_KEYS) {
    const value = conversation[key];
    if (typeof value === "string" && value.trim()) {
      count += 1;
    } else if (value) {
      count += 1;
    }
  }
  return count;
}

export function isEligibleForRegistrationReminder(
  conversation: WhatsAppConversationState,
  expiresAt: Date,
  nowMs = Date.now()
): boolean {
  if (conversation.status !== "ACTIVE") {
    return false;
  }
  if (conversation.currentStep === "AWAITING_START") {
    return false;
  }
  if (expiresAt.getTime() <= nowMs) {
    return false;
  }
  return countCompletedCoreFields(conversation) >= 4;
}

export function effectiveLastInboundAt(
  lastInboundAt: Date | null,
  expiresAt: Date
): Date {
  return (
    lastInboundAt ?? computePreviousActivityAtFromExpiresAt(expiresAt)
  );
}

export function determineReminderStageToSend(
  inactivityMs: number,
  highestReminderStageSent: number
): 2 | 6 | 24 | null {
  if (inactivityMs >= WHATSAPP_REMINDER_24H_MS) {
    if (highestReminderStageSent >= 24) {
      return null;
    }
    return 24;
  }
  if (inactivityMs >= WHATSAPP_REMINDER_6H_MS) {
    if (highestReminderStageSent >= 6) {
      return null;
    }
    return 6;
  }
  if (inactivityMs >= WHATSAPP_REMINDER_2H_MS) {
    if (highestReminderStageSent >= 2) {
      return null;
    }
    return 2;
  }
  return null;
}

export function isReminderRetryThrottled(
  lastReminderAttemptAt: Date | null,
  nowMs = Date.now()
): boolean {
  if (!lastReminderAttemptAt) {
    return false;
  }
  return (
    nowMs - lastReminderAttemptAt.getTime() < WHATSAPP_REMINDER_RETRY_THROTTLE_MS
  );
}
