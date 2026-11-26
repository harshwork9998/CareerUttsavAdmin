import type { WhatsAppConversationState } from "@/lib/server/whatsapp/registration-conversation";
import type { WhatsAppFaqEntry } from "@/lib/server/whatsapp/faq/whatsapp-faq-knowledge";

export type WhatsAppFaqRegistrationStance = "completed" | "in_progress" | "not_started";

export function whatsAppFaqRegistrationStance(
  conversation: WhatsAppConversationState
): WhatsAppFaqRegistrationStance {
  if (conversation.status === "COMPLETED" || conversation.completedRegistrationId) return "completed";
  if (conversation.status === "READY_TO_REGISTER") return "in_progress";
  if (conversation.status === "ACTIVE" && conversation.currentStep !== "AWAITING_START") return "in_progress";
  return "not_started";
}

export function adaptFaqAnswerForRegistration(
  answer: string,
  stance: WhatsAppFaqRegistrationStance
): string {
  if (stance !== "completed") return answer;
  return answer
    .replace(/you can register right here on whatsapp[.!]?/gi, "Your registration is already complete.")
    .replace(/you can register right here[^.?!]*[.?!]?/gi, "Your registration is already complete.")
    .replace(/just say ["“']?register["”']? to get started[.!]?/gi, "Your registration is already complete.")
    .replace(/pre-register to block your place[.!]?/gi, "Your registration is already complete.")
    .replace(/they can register right here on this whatsapp number or through the form on our website[.!]?/gi, "Your registration is already complete.")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const INJECTION = /ignore previous|system prompt|drop_database|<\s*\/?\s*system/i;
const INTERNAL = /location pin when it is enabled/i;
const TIME_TOKEN = /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\b\d{1,2}\s*baje\b/gi;
const MONEY = /(?:₹|rs\.?|inr)\s*\d[\d,]*/gi;
const DATE = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(\d{4}))?\b/gi;
const UNIVERSITY = /\b([a-z][a-z]+(?:\s+[a-z][a-z]+){0,3})\s+university\b/gi;
const NAMED_ATTENDANCE = /\b([a-z][a-z]{2,})\s+is\s+(?:attending|confirmed|participating|coming)\b/gi;
const RISKY = /\b(cancell?ed|postponed|speaker is|starts at|bus is free)\b/i;

function sourceText(entries: WhatsAppFaqEntry[]): string {
  return entries.map((entry) => `${entry.question} ${entry.answer}`).join("\n").toLowerCase();
}

export function validateComposedFaqReply(input: {
  reply: string;
  entries: WhatsAppFaqEntry[];
  stance: WhatsAppFaqRegistrationStance;
}): { ok: true; reply: string } | { ok: false; reason: string } {
  const reply = adaptFaqAnswerForRegistration(input.reply.trim(), input.stance);
  if (input.entries.length === 0) return { ok: false, reason: "no_faq" };
  if (!reply) return { ok: false, reason: "empty" };
  if (reply.length > 900) return { ok: false, reason: "too_long" };
  if (INJECTION.test(reply) || INTERNAL.test(reply)) return { ok: false, reason: "untrusted_wording" };
  const source = sourceText(input.entries);
  if (RISKY.test(reply) && !source.includes(reply.match(RISKY)?.[0]?.toLowerCase() ?? "___")) {
    return { ok: false, reason: "unsupported_claim" };
  }
  for (const match of reply.match(TIME_TOKEN) ?? []) {
    if (!source.includes(match.toLowerCase())) return { ok: false, reason: "unsupported_time" };
  }
  for (const match of reply.match(MONEY) ?? []) {
    if (!source.includes(match.toLowerCase())) return { ok: false, reason: "unsupported_price" };
  }
  for (const match of reply.matchAll(DATE)) {
    const day = Number(match[1]);
    const month = match[2].toLowerCase();
    const year = match[3];
    const allowed = month === "december" && (day === 19 || day === 20) && (!year || year === "2026");
    if (!allowed && !source.includes(match[0].toLowerCase())) {
      return { ok: false, reason: "unsupported_date" };
    }
  }
  for (const match of reply.matchAll(UNIVERSITY)) {
    if (!source.includes(match[0].toLowerCase())) return { ok: false, reason: "unsupported_university" };
  }
  for (const match of reply.matchAll(NAMED_ATTENDANCE)) {
    if (!source.includes(match[1].toLowerCase())) return { ok: false, reason: "unsupported_attendance" };
  }
  if (input.stance === "completed" && /\bnot registered\b/i.test(reply)) {
    return { ok: false, reason: "registration_contradiction" };
  }
  if (input.stance !== "completed" && /\balready (registered|complete)\b/i.test(reply)) {
    return { ok: false, reason: "registration_contradiction" };
  }
  if (input.stance === "completed" && /\b(register right here|pre-register|say ["']?register)\b/i.test(reply)) {
    return { ok: false, reason: "registration_cta" };
  }
  return { ok: true, reply };
}

export function storedFaqReply(
  entries: WhatsAppFaqEntry[],
  stance: WhatsAppFaqRegistrationStance
): string {
  const unique = [...new Set(entries.map((entry) => adaptFaqAnswerForRegistration(entry.answer, stance)))];
  return unique.join("\n\n").slice(0, 1200);
}

export function faqFallbackText(input: {
  kind: "rate_limited" | "budget_exhausted" | "timeout" | "api_error" | "unknown" | "unavailable";
  stance: WhatsAppFaqRegistrationStance;
}): string {
  if (input.kind === "rate_limited") {
    return "I've reached the hourly limit for extra lookups. I can still answer the usual event questions from what I already have.";
  }
  if (input.kind === "budget_exhausted") {
    return "The assistant's test spending limit has been reached. I can still answer saved event questions.";
  }
  if (input.kind === "timeout") {
    return "That lookup took too long. Please ask me once more.";
  }
  if (input.kind === "api_error" || input.kind === "unavailable") {
    return "I couldn't look that up just now. Please ask again in a moment.";
  }
  if (input.stance === "completed") {
    return "I don't have a confirmed answer for that yet. Your registration is already complete. Chirag Jain on 6364224321 can help if it's urgent.";
  }
  return "I don't have a confirmed answer for that yet. Chirag Jain on 6364224321 can help if it's urgent.";
}

export function completedEntryAnswer(): string {
  return "Entry is free. Your registration is already complete, so you can use the pass already sent to this WhatsApp number.";
}

export function qrRefusalAnswer(): string {
  return "A QR code is the entry pass sent after registration. I won't send one unless you ask me to.";
}

export function qrUnregisteredAnswer(stance: WhatsAppFaqRegistrationStance): string {
  if (stance === "in_progress") {
    return "Your entry pass is sent after registration is complete. We can carry on from the step you were on.";
  }
  return "Your entry pass is available after you finish registration. Say register when you want to start.";
}
