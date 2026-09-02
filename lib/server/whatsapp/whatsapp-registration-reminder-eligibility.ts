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

export function hasReminderEligibleStudentName(
  conversation: WhatsAppConversationState
): boolean {
  return Boolean(conversation.studentName?.trim());
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
  return hasReminderEligibleStudentName(conversation);
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
