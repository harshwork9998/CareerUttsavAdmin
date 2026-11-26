import type { WhatsAppFaqContextHint } from "@/lib/server/whatsapp/faq/whatsapp-faq-context";
import { findWhatsAppFaqEntry, type WhatsAppFaqEntry } from "@/lib/server/whatsapp/faq/whatsapp-faq-knowledge";

export function normalizeFaqText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\b(uttsav|utssav|utsavv|uthsav)\b/g, "utsav")
    .replace(/\bca+r+e+r\b/g, "career")
    .replace(/\bwher\b/g, "where")
    .replace(/\bwen\b/g, "when")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeFaqIntent(text: string): string {
  return normalizeFaqText(text)
    .replace(/^(ok|okay|bhai|yaar|hey|please|hi)\s+/, "")
    .replace(/\b(bhai|yaar)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function negated(text: string): boolean {
  return /\b(not|no|dont|never|nahi|nahin|mat|without|illa)\b/.test(text);
}

function entry(id: string): WhatsAppFaqEntry | null {
  return findWhatsAppFaqEntry(id);
}

export function classifyWhatsAppQrRequest(text: string): "send" | "refuse" | null {
  const query = normalizeFaqIntent(text);
  const mentions = /\b(qr|qr code|entry pass|event pass|entry ticket|registration pass|registration qr|my pass)\b/.test(
    query
  ) || /\bmera qr\b/.test(query);
  if (!mentions && query !== "qr") return null;
  if (/\b(what is|whats|means|matlab)\b/.test(query)) return "refuse";
  if (negated(query) && /\b(send|share|bhej|bhejo|resend|give)\b/.test(query)) return "refuse";
  const asks =
    /\b(give|send|share|resend|bhej|bhejo|lost|chahiye)\b/.test(query) ||
    /\bwhere is my\b/.test(query) ||
    /\bqr please\b/.test(query) ||
    query === "qr" ||
    query === "my qr" ||
    query === "mera qr";
  if (!asks) return null;
  return "send";
}

export function matchWhatsAppFaqIntent(
  text: string,
  context?: WhatsAppFaqContextHint
): WhatsAppFaqEntry | null {
  const query = normalizeFaqIntent(text);
  if (negated(query) || query.length < 3) return null;
  const topic = context?.topic ?? "general";

  if (/\b(seminar|seminars|session|sessions)\b/.test(query) && /\b(time|timing|timings|start)\b/.test(query)) {
    return entry("CU-059");
  }
  if (/\b(timing|timings|opening hours)\b/.test(query) || /\bwhat time does it start\b/.test(query)) {
    return entry("RULE-TIMINGS");
  }
  if (/\bengineering\b/.test(query) && /\b(session|sessions|seminar|seminars)\b/.test(query)) {
    return entry("CU-065");
  }
  if (
    /\bwhat about seminars\b/.test(query) ||
    /\bseminar schedule\b/.test(query) ||
    /\bwhat sessions are available\b/.test(query) ||
    /\bsessions are available\b/.test(query) ||
    (/\b(send|share)\b/.test(query) && /\b(seminar|schedule)\b/.test(query))
  ) {
    return /\bschedule\b/.test(query) ? entry("CU-056") : entry("CU-055");
  }
  if (/\b(khana|food|lunch|snack)\b/.test(query) && !negated(query)) {
    return entry("CU-045");
  }
  if (/\bparking\b/.test(query) && !/\bstall\b/.test(query)) {
    return entry(/\bfree\b/.test(query) ? "CU-043" : "CU-042");
  }
  if (/\b(parent|parents|mom|dad|mummy|papa)\b/.test(query) && /\b(come|attend|allowed|welcome|with me)\b/.test(query)) {
    return entry("RULE-PARENTS");
  }
  if (/\bcan my parents come\b/.test(query)) return entry("RULE-PARENTS");
  if (
    /\b(where is|wher is|kahan hai|kaha hai)\b/.test(query) &&
    !/\b(my pass|my qr|stall|parking)\b/.test(query)
  ) {
    return entry("CU-003");
  }
  if (
    /\b(when is|kab hai|what date|which date|event date|event dates)\b/.test(query) &&
    !/\b(reward|certificate|result|refund)\b/.test(query)
  ) {
    return entry("RULE-DATES");
  }
  if (/\bwhat about the entry\b/.test(query) || /\b(entry|enter)\b/.test(query) && /\b(free|fee|fees|charge)\b/.test(query)) {
    return entry("CU-005");
  }
  if (/\b(is it free|free hai|entry free)\b/.test(query) && !/\b(bus|parking|shuttle)\b/.test(query)) {
    if (topic === "parking") return entry("CU-043");
    if (topic === "transport") return entry("RULE-BUS-COST");
    return entry("CU-005");
  }
  if (/\b(what will happen|what happens|kya hoga)\b/.test(query)) {
    return entry("CU-001");
  }
  if (/\bwho (all|else) will be there\b/.test(query) || /\bwho will be there\b/.test(query)) {
    return entry("CU-068");
  }
  if (topic !== "general" && query.split(" ").length <= 8) {
    if (/\b(where|kahan|kaha)\b/.test(query) && /\b(it|there|that|event)\b/.test(query)) return entry("CU-003");
    if (/\b(when|kab)\b/.test(query) && /\b(it|event|both days)\b/.test(query)) return entry("RULE-DATES");
  }
  return null;
}
