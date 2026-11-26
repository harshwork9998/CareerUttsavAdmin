import {
  whatsAppFaqEntries,
  type WhatsAppFaqEntry,
} from "@/lib/server/whatsapp/faq/whatsapp-faq-knowledge";

const NEGATION = /\b(not|no|dont|don't|never|nahi|illa|without)\b/i;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type WhatsAppFaqLocalMatch = {
  entry: WhatsAppFaqEntry;
  score: number;
  reliable: boolean;
};

export function matchWhatsAppFaqLocally(text: string): WhatsAppFaqLocalMatch | null {
  const query = normalize(text);
  if (query.length < 3) return null;
  const queryNegated = NEGATION.test(query);
  const scored: Array<{ entry: WhatsAppFaqEntry; score: number }> = [];

  for (const entry of whatsAppFaqEntries()) {
    const question = normalize(entry.question);
    const phrases = [question, ...entry.alternatePhrasings.map(normalize)].filter(Boolean);
    let score = 0;
    if (phrases.some((phrase) => phrase === query)) {
      score = 1;
    } else if (phrases.some((phrase) => phrase.length > 12 && query.includes(phrase))) {
      score = 0.93;
    } else {
      const keys = entry.keywords.filter((word) => word.length > 3);
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
  const exact = best.score >= 0.99;
  const collided = Boolean(!exact && second && best.score - second.score < 0.08 && second.score >= 0.6);
  const reliable = exact || (best.score >= 0.9 && !collided);
  if (!reliable && best.score < 0.84) return null;
  if (collided) return null;
  return { entry: best.entry, score: best.score, reliable };
}
