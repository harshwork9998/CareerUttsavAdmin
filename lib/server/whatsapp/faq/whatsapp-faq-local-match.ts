import type { WhatsAppFaqContextHint } from "@/lib/server/whatsapp/faq/whatsapp-faq-context";
import { matchWhatsAppFaqIntent, normalizeFaqText } from "@/lib/server/whatsapp/faq/whatsapp-faq-intents";
import {
  whatsAppFaqEntries,
  type WhatsAppFaqEntry,
} from "@/lib/server/whatsapp/faq/whatsapp-faq-knowledge";

const NEGATION = /\b(not|no|dont|don't|never|nahi|illa|without)\b/i;

function normalize(text: string): string {
  return normalizeFaqText(text);
}

export type WhatsAppFaqLocalMatch = {
  entry: WhatsAppFaqEntry;
  score: number;
  reliable: boolean;
};

function exactEntry(query: string): WhatsAppFaqEntry | null {
  for (const entry of whatsAppFaqEntries()) {
    const phrases = [entry.question, ...entry.alternatePhrasings].map(normalize).filter(Boolean);
    if (phrases.some((phrase) => phrase === query)) return entry;
  }
  return null;
}

export function matchWhatsAppFaqLocally(
  text: string,
  context?: WhatsAppFaqContextHint
): WhatsAppFaqLocalMatch | null {
  const query = normalize(text);
  if (query.length < 3) return null;
  const exact = exactEntry(query);
  if (exact) return { entry: exact, score: 1, reliable: true };

  const intent = matchWhatsAppFaqIntent(text, context);
  if (intent) return { entry: intent, score: 0.95, reliable: true };

  const queryNegated = NEGATION.test(query);
  const scored: Array<{ entry: WhatsAppFaqEntry; score: number }> = [];

  for (const entry of whatsAppFaqEntries()) {
    const question = normalize(entry.question);
    const phrases = [question, ...entry.alternatePhrasings.map(normalize)].filter(Boolean);
    let score = 0;
    if (phrases.some((phrase) => phrase.length > 12 && query.includes(phrase))) {
      score = 0.93;
    } else {
      const keys = entry.keywords.map(normalize).filter((word) => word.length > 3);
      if (keys.length === 0) continue;
      const hits = keys.filter((word) => query.split(" ").includes(word));
      if (hits.length < 2 && !(hits.length === 1 && keys.length === 1 && query.split(" ").length <= 4)) {
        continue;
      }
      score = hits.length / Math.min(keys.length, 4);
      if (score < 0.6) continue;
    }
    if (queryNegated && !NEGATION.test(entry.question)) {
      score -= 0.35;
    }
    if (score >= 0.6) scored.push({ entry, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aExact = normalize(a.entry.question) === query ? 1 : 0;
    const bExact = normalize(b.entry.question) === query ? 1 : 0;
    return bExact - aExact;
  });
  const best = scored[0];
  if (!best) return null;
  const second = scored[1];
  const exactScore = best.score >= 0.99;
  const collided = Boolean(!exactScore && second && best.score - second.score < 0.08 && second.score >= 0.6);
  const reliable = exactScore || (best.score >= 0.9 && !collided);
  if (!reliable && best.score < 0.84) return null;
  if (collided) return null;
  return { entry: best.entry, score: best.score, reliable };
}
