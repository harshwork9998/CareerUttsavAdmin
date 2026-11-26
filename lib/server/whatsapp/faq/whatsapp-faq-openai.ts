import {
  estimateWhatsAppFaqAiUsd,
  whatsAppFaqModelRates,
} from "@/lib/server/whatsapp/faq/whatsapp-faq-budget";
import {
  whatsAppFaqAiModel,
  whatsAppFaqAiTimeoutMs,
} from "@/lib/server/whatsapp/faq/whatsapp-faq-config";
import {
  findWhatsAppFaqEntry,
  sanitizeWhatsAppFaqActions,
  whatsAppFaqEntries,
  type WhatsAppFaqEntry,
} from "@/lib/server/whatsapp/faq/whatsapp-faq-knowledge";
import {
  storedFaqReply,
  validateComposedFaqReply,
  type WhatsAppFaqRegistrationStance,
} from "@/lib/server/whatsapp/faq/whatsapp-faq-reply";

export const WHATSAPP_FAQ_AI_MAX_OUTPUT_TOKENS = 800;

const SYSTEM_RULES = [
  "You are the Career Uttsav WhatsApp assistant. Return JSON only:",
  '{"faqIds":["CU-001"],"reply":"short answer","actions":[]}.',
  "faqIds must be copied from the catalogue. Use [] when none apply.",
  "Resolve it, there, that event, and both days using contextTopic and recentFaqIds.",
  "reply is one short warm WhatsApp message. You may paraphrase or translate.",
  "Use only catalogue facts. Do not invent dates, times, prices, speakers, or which universities are attending.",
  "registrationStatus is decided by the server. Do not claim someone is registered unless it says completed.",
  "Do not tell a completed registration to register again.",
  "Allowed actions are SEND_SEMINAR_POSTER and SEND_VENUE_LOCATION. Do not ask to send a QR code.",
].join(" ");

export type WhatsAppFaqAiResult = {
  entries: WhatsAppFaqEntry[];
  reply: string;
  composed: boolean;
  inputTokens: number;
  outputTokens: number;
  promptChars: number;
};

type FaqAiClient = (input: {
  model: string;
  system: string;
  user: string;
  timeoutMs: number;
}) => Promise<{ content: string; inputTokens: number; outputTokens: number }>;

let clientOverride: FaqAiClient | null = null;

export function __setWhatsAppFaqAiClientForTests(client: FaqAiClient | null): void {
  clientOverride = client;
}

export function whatsAppFaqAiChatRequestBody(input: {
  model: string;
  system: string;
  user: string;
}) {
  return {
    model: input.model,
    max_completion_tokens: WHATSAPP_FAQ_AI_MAX_OUTPUT_TOKENS,
    reasoning_effort: "none" as const,
    response_format: { type: "json_object" as const },
    messages: [
      { role: "system" as const, content: input.system },
      { role: "user" as const, content: input.user },
    ],
  };
}

function catalogue() {
  return whatsAppFaqEntries().map((entry) => ({
    id: entry.id,
    question: entry.question,
    fact: entry.answer.replace(/\s+/g, " ").slice(0, 48),
  }));
}

let cachedCatalogue = "";

function catalogueJson(): string {
  if (!cachedCatalogue) cachedCatalogue = JSON.stringify(catalogue());
  return cachedCatalogue;
}

export function buildWhatsAppFaqAiPrompt(input: {
  redactedText: string;
  previousFaqIds: string[];
  contextTopic?: string;
  registrationStatus?: WhatsAppFaqRegistrationStance;
}): { system: string; user: string } {
  return {
    system: `${SYSTEM_RULES}\nCatalogue:\n${catalogueJson()}`,
    user: JSON.stringify({
      contextTopic: input.contextTopic ?? "general",
      recentFaqIds: input.previousFaqIds,
      registrationStatus: input.registrationStatus ?? "not_started",
      message: input.redactedText,
    }),
  };
}

export function whatsAppFaqAiCallCeiling(input: {
  redactedText: string;
  previousFaqIds: string[];
  contextTopic?: string;
  registrationStatus?: WhatsAppFaqRegistrationStance;
}): { usd: number; inputTokens: number; outputTokens: number; promptChars: number } | null {
  const model = whatsAppFaqAiModel();
  if (!whatsAppFaqModelRates(model)) return null;
  const prompt = buildWhatsAppFaqAiPrompt(input);
  const promptChars = prompt.system.length + prompt.user.length;
  const inputTokens = Math.max(1, Math.ceil(promptChars / 2));
  const outputTokens = WHATSAPP_FAQ_AI_MAX_OUTPUT_TOKENS;
  return {
    usd: Math.round(estimateWhatsAppFaqAiUsd(inputTokens, outputTokens, model) * 1_000_000) / 1_000_000,
    inputTokens,
    outputTokens,
    promptChars,
  };
}

/** @deprecated Use whatsAppFaqAiCallCeiling. Kept so reservation callers stay one number. */
export function whatsAppFaqAiReservationUsd(input: {
  redactedText: string;
  previousFaqIds: string[];
  contextTopic?: string;
  registrationStatus?: WhatsAppFaqRegistrationStance;
}): number | null {
  return whatsAppFaqAiCallCeiling(input)?.usd ?? null;
}

export function fullFaqPromptChars(): number {
  return whatsAppFaqEntries().reduce((sum, entry) => {
    return sum + JSON.stringify({
      id: entry.id,
      question: entry.question,
      answer: entry.answer,
      actions: entry.actions,
    }).length;
  }, 0);
}

async function defaultClient(input: {
  model: string;
  system: string;
  user: string;
  timeoutMs: number;
}): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY missing");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        whatsAppFaqAiChatRequestBody({
          model: input.model,
          system: input.system,
          user: input.user,
        })
      ),
    });
    if (!response.ok) {
      throw new Error(`openai_http_${response.status}`);
    }
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      content: body.choices?.[0]?.message?.content ?? "",
      inputTokens: body.usage?.prompt_tokens ?? 0,
      outputTokens: body.usage?.completion_tokens ?? 0,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function answerWhatsAppFaqWithAi(input: {
  redactedText: string;
  previousFaqIds: string[];
  contextTopic?: string;
  registrationStatus?: WhatsAppFaqRegistrationStance;
}): Promise<WhatsAppFaqAiResult> {
  const prompt = buildWhatsAppFaqAiPrompt(input);
  const client = clientOverride ?? defaultClient;
  const raw = await client({
    model: whatsAppFaqAiModel(),
    system: prompt.system,
    user: prompt.user,
    timeoutMs: whatsAppFaqAiTimeoutMs(),
  });
  const promptChars = prompt.system.length + prompt.user.length;
  const stance = input.registrationStatus ?? "not_started";
  let parsed: { faqIds?: string[]; reply?: string } = {};
  try {
    parsed = JSON.parse(raw.content) as { faqIds?: string[]; reply?: string };
  } catch (error) {
    const failure = new Error("faq_invalid_json");
    (failure as Error & { cause?: unknown }).cause = error;
    throw failure;
  }
  const entries = (parsed.faqIds ?? [])
    .map((id) => findWhatsAppFaqEntry(String(id)))
    .filter((entry): entry is WhatsAppFaqEntry => Boolean(entry));
  const unique: WhatsAppFaqEntry[] = [];
  for (const entry of entries) {
    if (!unique.some((row) => row.id === entry.id)) unique.push(entry);
  }
  const validated = validateComposedFaqReply({
    reply: typeof parsed.reply === "string" ? parsed.reply : "",
    entries: unique,
    stance,
  });
  return {
    entries: unique,
    reply: validated.ok ? validated.reply : storedFaqReply(unique, stance),
    composed: validated.ok,
    inputTokens: raw.inputTokens,
    outputTokens: raw.outputTokens,
    promptChars,
  };
}

export function actionsFromFaqEntries(entries: WhatsAppFaqEntry[]): ReturnType<typeof sanitizeWhatsAppFaqActions> {
  return sanitizeWhatsAppFaqActions(entries.flatMap((entry) => entry.actions));
}

export function __clearWhatsAppFaqCatalogueCacheForTests(): void {
  cachedCatalogue = "";
}
