import { CURRENT_EVENT_ID } from "@/lib/current-events";
import { requireIndianMobile } from "@/lib/indian-mobile";
import { resolveStudentRegistrationDuplicate } from "@/lib/server/registration-service";
import {
  promptForStep,
  type SeminarOption,
  type WhatsAppBotAction,
  type WhatsAppConversationState,
  type WhatsAppConversationStep,
} from "@/lib/server/whatsapp/registration-conversation";
import type { WhatsAppSeminarDayCatalog } from "@/lib/server/whatsapp/whatsapp-seminar-day-catalog";
import { buildWhatsAppSeminarPickerMediaAction } from "@/lib/server/whatsapp/whatsapp-artwork-seminar-catalog";
import {
  generateWhatsAppEntryPassPngBase64,
  seminarTitlesForEventPass,
} from "@/lib/server/whatsapp/event-pass";
import { getRegistrationForApi } from "@/lib/server/registration-service";
import {
  buildWhatsAppEventVenueLocationAction,
  isWhatsAppEventVenueLocationEnabled,
} from "@/lib/server/whatsapp/whatsapp-event-venue-location";
import { buildWhatsAppAlreadyRegisteredActions } from "@/lib/server/whatsapp/whatsapp-registration-bot-actions";
import {
  isWhatsAppFaqAiEnabled,
  isWhatsAppFaqAllowedForWaId,
  isWhatsAppFaqEnabled,
} from "@/lib/server/whatsapp/faq/whatsapp-faq-config";
import {
  reserveWhatsAppFaqAiCall,
  settleWhatsAppFaqAiReservation,
} from "@/lib/server/whatsapp/faq/whatsapp-faq-budget";
import { matchWhatsAppFaqLocally } from "@/lib/server/whatsapp/faq/whatsapp-faq-local-match";
import {
  actionsFromFaqEntries,
  answerWhatsAppFaqWithAi,
  whatsAppFaqAiReservationUsd,
} from "@/lib/server/whatsapp/faq/whatsapp-faq-openai";
import { redactWhatsAppFaqText } from "@/lib/server/whatsapp/faq/whatsapp-faq-redact";
import type { WhatsAppFaqAction, WhatsAppFaqEntry } from "@/lib/server/whatsapp/faq/whatsapp-faq-knowledge";

const QUESTION_START =
  /^(what|when|where|who|why|how|can|could|is|are|do|does|will|should|tell|send|share|which)\b/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEMINAR_NUMBERS = /^\d{1,2}(\s*,\s*\d{1,2}){0,3}$/;
const GREETING = /^(hi|hii|hello|hey|namaste|start|register)$/i;

const recentTopics = new Map<string, { ids: string[]; at: number }>();
const TOPIC_TTL_MS = 20 * 60 * 1000;
const MAX_TOPIC_USERS = 500;

function rememberTopics(waId: string, ids: string[]): void {
  if (ids.length === 0) return;
  const now = Date.now();
  for (const [key, row] of recentTopics) {
    if (now - row.at > TOPIC_TTL_MS) recentTopics.delete(key);
  }
  recentTopics.delete(waId);
  recentTopics.set(waId, { ids, at: now });
  while (recentTopics.size > MAX_TOPIC_USERS) {
    const oldest = recentTopics.keys().next().value;
    if (!oldest) break;
    recentTopics.delete(oldest);
  }
}

function previousTopics(waId: string): string[] {
  const row = recentTopics.get(waId);
  if (!row || Date.now() - row.at > TOPIC_TTL_MS) {
    if (row) recentTopics.delete(waId);
    return [];
  }
  return row.ids;
}

export function looksLikeRegistrationAnswer(
  step: WhatsAppConversationStep,
  text: string
): boolean {
  const trimmed = text.trim();
  if (!trimmed || QUESTION_START.test(trimmed) || trimmed.includes("?")) return false;
  if (step === "AWAITING_EMAIL") return EMAIL.test(trimmed);
  if (step === "AWAITING_NAME") return trimmed.split(/\s+/).length <= 5 && trimmed.length <= 60;
  if (step === "AWAITING_SEMINARS") return SEMINAR_NUMBERS.test(trimmed);
  if (step === "AWAITING_COLLEGE" || step === "AWAITING_CITY") return trimmed.length <= 80;
  return false;
}

function looksLikeFaq(step: WhatsAppConversationStep, text: string): boolean {
  if (GREETING.test(text.trim())) return false;
  if (looksLikeRegistrationAnswer(step, text)) return false;
  if (QUESTION_START.test(text.trim()) || text.includes("?")) return true;
  return text.trim().split(/\s+/).length >= 4;
}

async function actionsForAllowlist(
  actions: WhatsAppFaqAction[],
  conversation: WhatsAppConversationState
): Promise<WhatsAppBotAction[]> {
  const outbound: WhatsAppBotAction[] = [];
  for (const action of actions) {
    if (action === "SEND_SEMINAR_POSTER") {
      outbound.push(buildWhatsAppSeminarPickerMediaAction());
    }
    if (action === "SEND_VENUE_LOCATION" && isWhatsAppEventVenueLocationEnabled()) {
      outbound.push(buildWhatsAppEventVenueLocationAction());
    }
    if (action === "RESEND_ENTRY_PASS") {
      const phone = requireIndianMobile(conversation.waId, "WhatsApp mobile number");
      if (!phone.ok) continue;
      const duplicate = await resolveStudentRegistrationDuplicate({
        eventId: CURRENT_EVENT_ID,
        phone: phone.mobile,
      });
      if (duplicate.resolution.outcome !== "phone" && duplicate.resolution.outcome !== "both") {
        outbound.push({
          type: "TEXT",
          body: "I can't find a completed registration on this WhatsApp number yet.",
        });
        continue;
      }
      if (
        conversation.completedRegistrationId &&
        conversation.completedRegistrationId !== duplicate.resolution.registration.id
      ) {
        outbound.push({
          type: "TEXT",
          body: "I can only resend the pass linked to this WhatsApp number.",
        });
        continue;
      }
      const registration = await getRegistrationForApi(duplicate.resolution.registration.id);
      const qrPngBase64 = await generateWhatsAppEntryPassPngBase64({
        registrationId: duplicate.resolution.registration.registrationNumber,
        seminarTitles: seminarTitlesForEventPass(
          registration && registration.kind === "student" ? registration : null
        ),
      });
      outbound.push(
        ...buildWhatsAppAlreadyRegisteredActions({
          registrationNumber: duplicate.resolution.registration.registrationNumber,
          qrPngBase64,
        })
      );
    }
  }
  return outbound;
}

function resumePrompt(
  conversation: WhatsAppConversationState,
  seminarOptions: SeminarOption[],
  seminarDayCatalog?: WhatsAppSeminarDayCatalog
): WhatsAppBotAction[] {
  if (conversation.status !== "ACTIVE" && conversation.status !== "READY_TO_REGISTER") {
    return [];
  }
  if (conversation.currentStep === "AWAITING_START" || conversation.currentStep === "COMPLETED") {
    return [];
  }
  return promptForStep(
    conversation.currentStep,
    seminarOptions,
    conversation,
    null,
    seminarDayCatalog
  );
}

export async function tryAnswerWhatsAppFaq(input: {
  conversation: WhatsAppConversationState;
  text?: string;
  interactiveId?: string;
  seminarOptions: SeminarOption[];
  seminarDayCatalog?: WhatsAppSeminarDayCatalog;
}): Promise<{ actions: WhatsAppBotAction[] } | null> {
  if (!isWhatsAppFaqEnabled()) return null;
  if (!isWhatsAppFaqAllowedForWaId(input.conversation.waId)) return null;
  if (input.interactiveId) return null;
  const text = input.text?.trim() ?? "";
  if (!text || !looksLikeFaq(input.conversation.currentStep, text)) return null;

  let entries: WhatsAppFaqEntry[] = [];
  let reply = "";
  const local = matchWhatsAppFaqLocally(text);
  if (local?.reliable) {
    entries = [local.entry];
    reply = local.entry.answer;
    console.info("[whatsapp-faq] local", { faqId: local.entry.id, score: local.score });
  } else if (
    isWhatsAppFaqAiEnabled()
  ) {
    const redactedText = redactWhatsAppFaqText(text);
    const previousFaqIds = previousTopics(input.conversation.waId);
    const reserveUsd = whatsAppFaqAiReservationUsd({ redactedText, previousFaqIds });
    const reservation =
      reserveUsd == null
        ? { allowed: false as const, reason: "model_unpriced" }
        : await reserveWhatsAppFaqAiCall({
            waId: input.conversation.waId,
            reserveUsd,
          });
    if (!reservation.allowed) {
      console.info("[whatsapp-faq] ai skipped", { reason: reservation.reason });
      reply = "I can help with confirmed event questions, but the assistant limit is reached for now. Please contact Chirag Jain on 6364224321.";
    } else {
      try {
        const ai = await answerWhatsAppFaqWithAi({
          redactedText,
          previousFaqIds,
        });
        await settleWhatsAppFaqAiReservation({
          id: reservation.id,
          waId: input.conversation.waId,
          inputTokens: ai.inputTokens,
          outputTokens: ai.outputTokens,
        });
        entries = ai.entries;
        reply = ai.reply || "I don't have a confirmed answer for that yet. Please contact Chirag Jain on 6364224321.";
        console.info("[whatsapp-faq] ai", {
          faqIds: entries.map((entry) => entry.id),
          inputTokens: ai.inputTokens,
          outputTokens: ai.outputTokens,
        });
      } catch (error) {
        console.info("[whatsapp-faq] ai failed", {
          reason: error instanceof Error ? error.message : "unknown",
        });
        try {
          await settleWhatsAppFaqAiReservation({
            id: reservation.id,
            waId: input.conversation.waId,
            inputTokens: 4000,
            outputTokens: 0,
          });
        } catch {
          // The usage file is already fail-closed for the next call.
        }
        reply = "I couldn't look that up just now. Please contact Chirag Jain on 6364224321, or continue your registration.";
      }
    }
  } else if (local) {
    entries = [local.entry];
    reply = local.entry.answer;
  } else {
    return null;
  }

  rememberTopics(input.conversation.waId, entries.map((entry) => entry.id));
  const actions: WhatsAppBotAction[] = [];
  if (reply) actions.push({ type: "TEXT", body: reply });
  actions.push(...(await actionsForAllowlist(actionsFromFaqEntries(entries), input.conversation)));
  if (!entries.some((entry) => entry.actions.includes("SEND_SEMINAR_POSTER"))) {
    actions.push(...resumePrompt(input.conversation, input.seminarOptions, input.seminarDayCatalog));
  }
  return actions.length > 0 ? { actions } : null;
}
