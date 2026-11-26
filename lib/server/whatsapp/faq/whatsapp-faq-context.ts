import type { WhatsAppFaqEntry } from "@/lib/server/whatsapp/faq/whatsapp-faq-knowledge";

export type WhatsAppFaqTopic =
  | "event"
  | "dates"
  | "venue"
  | "entry"
  | "seminars"
  | "food"
  | "parking"
  | "parents"
  | "transport"
  | "general";

export type WhatsAppFaqContextHint = {
  topic: WhatsAppFaqTopic;
  faqIds: string[];
};

const recent = new Map<string, WhatsAppFaqContextHint & { at: number }>();
const TOPIC_TTL_MS = 20 * 60 * 1000;
const MAX_TOPIC_USERS = 500;
const MAX_IDS = 4;

export function topicForFaqEntry(entry: WhatsAppFaqEntry): WhatsAppFaqTopic {
  if (entry.id === "RULE-DATES" || entry.id === "CU-013") return "dates";
  if (entry.id === "CU-003" || entry.id === "CU-041" || entry.id === "CU-044") return "venue";
  if (entry.id === "CU-005") return "entry";
  if (entry.id === "CU-045") return "food";
  if (entry.id === "CU-042" || entry.id === "CU-043") return "parking";
  if (entry.id === "RULE-PARENTS" || entry.id === "CU-024" || entry.id === "CU-064") return "parents";
  if (entry.id === "RULE-BUS-COST" || entry.category === "Transport") return "transport";
  if (entry.category === "Seminars" || entry.category === "Careers") return "seminars";
  if (entry.id === "CU-001") return "event";
  return "general";
}

export function rememberWhatsAppFaqContext(waId: string, entries: WhatsAppFaqEntry[]): void {
  if (entries.length === 0) return;
  const now = Date.now();
  for (const [key, row] of recent) {
    if (now - row.at > TOPIC_TTL_MS) recent.delete(key);
  }
  const topic = topicForFaqEntry(entries[0]);
  recent.delete(waId);
  recent.set(waId, {
    topic,
    faqIds: entries.slice(0, MAX_IDS).map((entry) => entry.id),
    at: now,
  });
  while (recent.size > MAX_TOPIC_USERS) {
    const oldest = recent.keys().next().value;
    if (!oldest) break;
    recent.delete(oldest);
  }
}

export function readWhatsAppFaqContext(waId: string): WhatsAppFaqContextHint {
  const row = recent.get(waId);
  if (!row || Date.now() - row.at > TOPIC_TTL_MS) {
    if (row) recent.delete(waId);
    return { topic: "general", faqIds: [] };
  }
  return { topic: row.topic, faqIds: row.faqIds };
}

export function __clearWhatsAppFaqContextForTests(): void {
  recent.clear();
}
