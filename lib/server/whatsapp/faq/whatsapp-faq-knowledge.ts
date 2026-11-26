import knowledge from "@/lib/server/whatsapp/faq/knowledge.v3.json";

export type WhatsAppFaqAction =
  | "SEND_SEMINAR_POSTER"
  | "SEND_VENUE_LOCATION"
  | "RESEND_ENTRY_PASS"
  | "HINT_START_REGISTRATION";

export type WhatsAppFaqEntry = {
  id: string;
  category: string;
  status: string;
  question: string;
  alternatePhrasings: string[];
  keywords: string[];
  answer: string;
  actions: WhatsAppFaqAction[];
  source: string;
};

export type WhatsAppFaqKnowledge = {
  version: string;
  entries: WhatsAppFaqEntry[];
  seminars: Array<{
    number: number;
    date: string;
    day: string;
    title: string;
    sessionTime: null;
    speaker: null;
  }>;
  report: {
    included: string[];
    excluded: Array<{ id: string; reason: string; status?: string }>;
    conditional: Array<{ id: string; reason: string; status?: string }>;
  };
};

const data = knowledge as WhatsAppFaqKnowledge;

const ALLOWED_ACTIONS = new Set<WhatsAppFaqAction>([
  "SEND_SEMINAR_POSTER",
  "SEND_VENUE_LOCATION",
  "RESEND_ENTRY_PASS",
  "HINT_START_REGISTRATION",
]);

export function loadWhatsAppFaqKnowledge(): WhatsAppFaqKnowledge {
  return data;
}

export function whatsAppFaqEntries(): WhatsAppFaqEntry[] {
  return data.entries.filter((entry) => entry.answer.trim().length > 0);
}

export function findWhatsAppFaqEntry(id: string): WhatsAppFaqEntry | null {
  return whatsAppFaqEntries().find((entry) => entry.id === id) ?? null;
}

export function sanitizeWhatsAppFaqActions(actions: string[]): WhatsAppFaqAction[] {
  return actions.filter((action): action is WhatsAppFaqAction =>
    ALLOWED_ACTIONS.has(action as WhatsAppFaqAction)
  );
}
