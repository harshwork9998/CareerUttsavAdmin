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

export type WhatsAppFaqAiResult = {
  entries: WhatsAppFaqEntry[];
  reply: string;
  inputTokens: number;
  outputTokens: number;
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
    max_completion_tokens: 800,
    reasoning_effort: "none" as const,
    response_format: { type: "json_object" as const },
    messages: [
      { role: "system" as const, content: input.system },
      { role: "user" as const, content: input.user },
    ],
  };
}

function buildWhatsAppFaqAiPrompt(input: {
  redactedText: string;
  previousFaqIds: string[];
}): { system: string; user: string } {
  const facts = whatsAppFaqEntries().map((entry) => ({
    id: entry.id,
    question: entry.question,
    answer: entry.answer,
    actions: entry.actions,
  }));
  return {
    system: [
      "Choose FAQ ids that answer the user. Return JSON only: {\"faqIds\":[\"CU-001\"]}.",
      "faqIds must be copied from the supplied facts. Use [] when none apply.",
      "Do not add facts. The server will send the stored answers for those ids.",
    ].join(" "),
    user: JSON.stringify({
      facts,
      previousFaqIds: input.previousFaqIds,
      message: input.redactedText,
    }),
  };
}

/** Upper bound held before the request, so overlapping calls in this process stay inside the cap. */
export function whatsAppFaqAiReservationUsd(input: {
  redactedText: string;
  previousFaqIds: string[];
}): number | null {
  const model = whatsAppFaqAiModel();
  if (!whatsAppFaqModelRates(model)) return null;
  const prompt = buildWhatsAppFaqAiPrompt(input);
  const inputTokens = Math.ceil((prompt.system.length + prompt.user.length) / 2);
  const usd = Math.max(
    estimateWhatsAppFaqAiUsd(inputTokens, 800, model),
    estimateWhatsAppFaqAiUsd(4000, 0, model)
  );
  return Math.round(usd * 1_000_000) / 1_000_000;
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
}): Promise<WhatsAppFaqAiResult> {
  const prompt = buildWhatsAppFaqAiPrompt(input);
  const system = prompt.system;
  const user = prompt.user;
  const client = clientOverride ?? defaultClient;
  const raw = await client({
    model: whatsAppFaqAiModel(),
    system,
    user,
    timeoutMs: whatsAppFaqAiTimeoutMs(),
  });
  const parsed = JSON.parse(raw.content) as { faqIds?: string[] };
  const entries = (parsed.faqIds ?? [])
    .map((id) => findWhatsAppFaqEntry(String(id)))
    .filter((entry): entry is WhatsAppFaqEntry => Boolean(entry));
  return {
    entries,
    reply: entries.map((entry) => entry.answer).join("\n\n").slice(0, 1200),
    inputTokens: raw.inputTokens,
    outputTokens: raw.outputTokens,
  };
}

export function actionsFromFaqEntries(entries: WhatsAppFaqEntry[]): ReturnType<typeof sanitizeWhatsAppFaqActions> {
  return sanitizeWhatsAppFaqActions(entries.flatMap((entry) => entry.actions));
}
