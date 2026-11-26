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
  estimateWhatsAppFaqAiUsd,
  reserveWhatsAppFaqAiCall,
  settleWhatsAppFaqAiReservation,
} from "@/lib/server/whatsapp/faq/whatsapp-faq-budget";
import {
  readWhatsAppFaqContext,
  rememberWhatsAppFaqContext,
  topicForFaqEntry,
} from "@/lib/server/whatsapp/faq/whatsapp-faq-context";
import {
  classifyWhatsAppQrRequest,
  matchWhatsAppFaqIntent,
} from "@/lib/server/whatsapp/faq/whatsapp-faq-intents";
import { matchWhatsAppFaqLocally } from "@/lib/server/whatsapp/faq/whatsapp-faq-local-match";
import {
  actionsFromFaqEntries,
  answerWhatsAppFaqWithAi,
  whatsAppFaqAiCallCeiling,
} from "@/lib/server/whatsapp/faq/whatsapp-faq-openai";
import { redactWhatsAppFaqText } from "@/lib/server/whatsapp/faq/whatsapp-faq-redact";
import { findWhatsAppFaqEntry, type WhatsAppFaqAction, type WhatsAppFaqEntry } from "@/lib/server/whatsapp/faq/whatsapp-faq-knowledge";
import {
  adaptFaqAnswerForRegistration,
  completedEntryAnswer,
  faqFallbackText,
  qrRefusalAnswer,
  qrUnregisteredAnswer,
  storedFaqReply,
  whatsAppFaqRegistrationStance,
  type WhatsAppFaqRegistrationStance,
} from "@/lib/server/whatsapp/faq/whatsapp-faq-reply";

const QUESTION_START =
  /^(what|when|where|who|why|how|can|could|is|are|do|does|will|should|tell|send|share|which)\b/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEMINAR_NUMBERS = /^\d{1,2}(\s*,\s*\d{1,2}){0,3}$/;
const GREETING = /^(hi|hii|hello|hey|namaste|start|register)$/i;

export function looksLikeRegistrationAnswer(
  step: WhatsAppConversationStep,
  text: string
): boolean {
  const trimmed = text.trim();
  if (!trimmed || QUESTION_START.test(trimmed) || trimmed.includes("?")) return false;
  if (classifyWhatsAppQrRequest(trimmed)) return false;
  if (matchWhatsAppFaqIntent(trimmed)) return false;
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

function failureClass(error: unknown): "timeout" | "api_error" {
  const message = error instanceof Error ? error.message : "";
  const name = error instanceof Error ? error.name : "";
  if (name === "AbortError" || /aborted|timeout/i.test(message)) return "timeout";
  return "api_error";
}

async function passActions(conversation: WhatsAppConversationState): Promise<WhatsAppBotAction[]> {
  const phone = requireIndianMobile(conversation.waId, "WhatsApp mobile number");
  if (!phone.ok) {
    return [{ type: "TEXT", body: qrUnregisteredAnswer(whatsAppFaqRegistrationStance(conversation)) }];
  }
  const duplicate = await resolveStudentRegistrationDuplicate({
    eventId: CURRENT_EVENT_ID,
    phone: phone.mobile,
  });
  if (duplicate.resolution.outcome !== "phone" && duplicate.resolution.outcome !== "both") {
    console.info("[whatsapp-faq] qr", { outcome: "unregistered" });
    return [{ type: "TEXT", body: qrUnregisteredAnswer(whatsAppFaqRegistrationStance(conversation)) }];
  }
  if (
    conversation.completedRegistrationId &&
    conversation.completedRegistrationId !== duplicate.resolution.registration.id
  ) {
    console.info("[whatsapp-faq] qr", { outcome: "ownership_mismatch" });
    return [{ type: "TEXT", body: "I can only resend the pass linked to this WhatsApp number." }];
  }
  const registration = await getRegistrationForApi(duplicate.resolution.registration.id);
  const qrPngBase64 = await generateWhatsAppEntryPassPngBase64({
    registrationId: duplicate.resolution.registration.registrationNumber,
    seminarTitles: seminarTitlesForEventPass(
      registration && registration.kind === "student" ? registration : null
    ),
  });
  console.info("[whatsapp-faq] qr", { outcome: "sent" });
  return buildWhatsAppAlreadyRegisteredActions({
    registrationNumber: duplicate.resolution.registration.registrationNumber,
    qrPngBase64,
  });
}

async function actionsForEntries(
  actions: WhatsAppFaqAction[],
  conversation: WhatsAppConversationState
): Promise<WhatsAppBotAction[]> {
  const outbound: WhatsAppBotAction[] = [];
  for (const action of actions) {
    if (action === "SEND_SEMINAR_POSTER") {
      outbound.push(buildWhatsAppSeminarPickerMediaAction());
    }
    if (action === "SEND_VENUE_LOCATION" && isWhatsAppEventVenueLocationEnabled()) {
      outbound.push(buildWhatsAppEventVenueLocationAction("venue_faq"));
    }
    if (action === "RESEND_ENTRY_PASS") {
      outbound.push(...(await passActions(conversation)));
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

function localReply(entries: WhatsAppFaqEntry[], stance: WhatsAppFaqRegistrationStance): string {
  if (stance === "completed" && entries.length === 1 && entries[0]?.id === "CU-005") {
    return completedEntryAnswer();
  }
  if (entries.length === 1) return adaptFaqAnswerForRegistration(entries[0].answer, stance);
  return storedFaqReply(entries, stance);
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
  if (!text) return null;

  const stance = whatsAppFaqRegistrationStance(input.conversation);
  const context = readWhatsAppFaqContext(input.conversation.waId);
  const finish = async (
    entries: WhatsAppFaqEntry[],
    reply: string,
    extra: WhatsAppBotAction[] = []
  ) => {
    rememberWhatsAppFaqContext(input.conversation.waId, entries);
    const actions: WhatsAppBotAction[] = [];
    if (reply) actions.push({ type: "TEXT", body: reply });
    actions.push(...extra);
    actions.push(...(await actionsForEntries(actionsFromFaqEntries(entries), input.conversation)));
    if (!entries.some((entry) => entry.actions.includes("SEND_SEMINAR_POSTER"))) {
      actions.push(...resumePrompt(input.conversation, input.seminarOptions, input.seminarDayCatalog));
    }
    return actions.length > 0 ? { actions } : null;
  };

  const qr = classifyWhatsAppQrRequest(text);
  if (qr === "refuse") {
    console.info("[whatsapp-faq] qr", { outcome: "refused" });
    return finish([], qrRefusalAnswer());
  }
  if (qr === "send") {
    const extra = await passActions(input.conversation);
    const pass = findWhatsAppFaqEntry("CU-020");
    if (pass) rememberWhatsAppFaqContext(input.conversation.waId, [pass]);
    const actions = [...extra];
    if (!extra.some((action) => action.type === "MEDIA")) {
      actions.push(...resumePrompt(input.conversation, input.seminarOptions, input.seminarDayCatalog));
    }
    return actions.length > 0 ? { actions } : null;
  }

  if (!looksLikeFaq(input.conversation.currentStep, text)) return null;

  let entries: WhatsAppFaqEntry[] = [];
  let reply = "";
  const local = matchWhatsAppFaqLocally(text, context);
  if (local?.reliable) {
    entries = [local.entry];
    reply = localReply(entries, stance);
    console.info("[whatsapp-faq] local", {
      faqId: local.entry.id,
      score: local.score,
      topic: topicForFaqEntry(local.entry),
    });
  } else if (isWhatsAppFaqAiEnabled()) {
    const redactedText = redactWhatsAppFaqText(text);
    const ceiling = whatsAppFaqAiCallCeiling({
      redactedText,
      previousFaqIds: context.faqIds,
      contextTopic: context.topic,
      registrationStatus: stance,
    });
    const reservation =
      ceiling == null
        ? { allowed: false as const, reason: "model_unpriced" }
        : await reserveWhatsAppFaqAiCall({
            waId: input.conversation.waId,
            reserveUsd: ceiling.usd,
          });
    if (!reservation.allowed) {
      console.info("[whatsapp-faq] ai skipped", { reason: reservation.reason });
      const kind =
        reservation.reason === "rate_limited"
          ? "rate_limited"
          : reservation.reason === "budget_exhausted"
            ? "budget_exhausted"
            : "unavailable";
      reply = faqFallbackText({ kind, stance });
    } else {
      if (!ceiling || !("id" in reservation)) {
        reply = faqFallbackText({ kind: "unavailable", stance });
        return finish(entries, reply);
      }
      const held = ceiling;
      const reservationId = reservation.id;
      const started = Date.now();
      try {
        const ai = await answerWhatsAppFaqWithAi({
          redactedText,
          previousFaqIds: context.faqIds,
          contextTopic: context.topic,
          registrationStatus: stance,
        });
        const elapsedMs = Date.now() - started;
        await settleWhatsAppFaqAiReservation({
          id: reservationId,
          waId: input.conversation.waId,
          inputTokens: ai.inputTokens,
          outputTokens: ai.outputTokens,
        });
        entries = ai.entries;
        reply = ai.reply || faqFallbackText({ kind: "unknown", stance });
        console.info("[whatsapp-faq] ai", {
          faqIds: entries.map((entry) => entry.id),
          inputTokens: ai.inputTokens,
          outputTokens: ai.outputTokens,
          elapsedMs,
          estimatedUsd: estimateWhatsAppFaqAiUsd(ai.inputTokens, ai.outputTokens),
          composed: ai.composed,
        });
      } catch (error) {
        const elapsedMs = Date.now() - started;
        const kind = failureClass(error);
        console.info("[whatsapp-faq] ai failed", {
          failureClass: kind,
          elapsedMs,
          reservedInputTokens: held.inputTokens,
          reservedOutputTokens: held.outputTokens,
        });
        try {
          await settleWhatsAppFaqAiReservation({
            id: reservationId,
            waId: input.conversation.waId,
            inputTokens: held.inputTokens,
            outputTokens: held.outputTokens,
          });
        } catch {
          // The usage file is already fail-closed for the next call.
        }
        reply = faqFallbackText({ kind, stance });
      }
    }
  } else if (local) {
    entries = [local.entry];
    reply = localReply(entries, stance);
    console.info("[whatsapp-faq] local", {
      faqId: local.entry.id,
      score: local.score,
      topic: topicForFaqEntry(local.entry),
    });
  } else {
    return null;
  }

  return finish(entries, reply);
}
