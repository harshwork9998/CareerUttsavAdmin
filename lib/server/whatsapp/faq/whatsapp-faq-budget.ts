import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  whatsAppFaqAiMaxUsd,
  whatsAppFaqAiModel,
} from "@/lib/server/whatsapp/faq/whatsapp-faq-config";

/**
 * Standard text rates (USD per 1M tokens) for models this assistant may call.
 * gpt-6-luna: $0.10 input, $0.50 output.
 * An unlisted model is refused so a config change cannot be priced at the wrong rate.
 * The file counter survives a process restart on the same disk.
 * In one Node process, each call reserves its ceiling before the request starts.
 * Separate processes can still race the file. A failed write fails closed.
 */
const MODEL_RATES_USD_PER_MILLION: Record<string, { input: number; output: number }> = {
  "gpt-6-luna": { input: 0.1, output: 0.5 },
};

export const WHATSAPP_FAQ_AI_INPUT_USD_PER_MILLION =
  MODEL_RATES_USD_PER_MILLION["gpt-6-luna"].input;
export const WHATSAPP_FAQ_AI_OUTPUT_USD_PER_MILLION =
  MODEL_RATES_USD_PER_MILLION["gpt-6-luna"].output;

export function whatsAppFaqModelRates(
  model: string
): { inputPerMillion: number; outputPerMillion: number } | null {
  const rates = MODEL_RATES_USD_PER_MILLION[model];
  if (!rates) return null;
  return { inputPerMillion: rates.input, outputPerMillion: rates.output };
}

type UsageFile = {
  spentUsd: number;
  calls: number;
  perWaIdHour: Record<string, { hour: string; count: number }>;
};

const USAGE_PATH = path.join(process.cwd(), "data", "whatsapp-faq-ai-usage.json");
const MAX_CALLS_PER_WA_ID_PER_HOUR = 8;

type Reservation = {
  id: string;
  waKey: string;
  hour: string;
  usd: number;
  model: string;
};

let memoryOverride: UsageFile | null = null;
let usageFileUnreadable = false;
let reservations: Reservation[] = [];
let nextReservationId = 1;
let budgetQueue: Promise<void> = Promise.resolve();

function emptyUsage(): UsageFile {
  return { spentUsd: 0, calls: 0, perWaIdHour: {} };
}

function readUsage(): UsageFile | "missing" | "corrupt" {
  if (memoryOverride) return memoryOverride;
  if (usageFileUnreadable) return "corrupt";
  try {
    const raw = readFileSync(USAGE_PATH, "utf8");
    const parsed = JSON.parse(raw) as UsageFile;
    if (!parsed || typeof parsed.spentUsd !== "number" || !Number.isFinite(parsed.spentUsd)) {
      return "corrupt";
    }
    parsed.calls = typeof parsed.calls === "number" ? parsed.calls : 0;
    parsed.perWaIdHour ??= {};
    return parsed;
  } catch (error) {
    const missing = error instanceof Error && "code" in error && error.code === "ENOENT";
    return missing ? "missing" : "corrupt";
  }
}

function writeUsage(usage: UsageFile): void {
  if (memoryOverride) {
    memoryOverride = usage;
    return;
  }
  try {
    mkdirSync(path.dirname(USAGE_PATH), { recursive: true });
    writeFileSync(USAGE_PATH, JSON.stringify(usage), "utf8");
  } catch {
    usageFileUnreadable = true;
    throw new Error("faq_usage_write_failed");
  }
}

function enqueue<T>(task: () => T): Promise<T> {
  const run = budgetQueue.then(task, task);
  budgetQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function waKey(waId: string): string {
  return waId.replace(/\D/g, "").slice(-10);
}

function reservedUsd(): number {
  return reservations.reduce((sum, row) => sum + row.usd, 0);
}

export function estimateWhatsAppFaqAiUsd(
  inputTokens: number,
  outputTokens: number,
  model = whatsAppFaqAiModel()
): number {
  const rates = whatsAppFaqModelRates(model);
  if (!rates) {
    throw new Error(`faq_model_unpriced:${model}`);
  }
  return (
    (inputTokens / 1_000_000) * rates.inputPerMillion +
    (outputTokens / 1_000_000) * rates.outputPerMillion
  );
}

export function whatsAppFaqAiBudgetDecision(waId: string, now = new Date()): {
  allowed: boolean;
  reason?: string;
} {
  const usage = readUsage();
  if (usage === "corrupt") {
    return { allowed: false, reason: "usage_file_invalid" };
  }
  const current = usage === "missing" ? emptyUsage() : usage;
  if (current.spentUsd >= whatsAppFaqAiMaxUsd()) {
    return { allowed: false, reason: "budget_exhausted" };
  }
  const hour = now.toISOString().slice(0, 13);
  const key = waKey(waId);
  const bucket = current.perWaIdHour[key];
  const pending = reservations.filter((row) => row.waKey === key && row.hour === hour).length;
  const used = (bucket && bucket.hour === hour ? bucket.count : 0) + pending;
  if (used >= MAX_CALLS_PER_WA_ID_PER_HOUR) {
    return { allowed: false, reason: "rate_limited" };
  }
  return { allowed: true };
}

export function reserveWhatsAppFaqAiCall(input: {
  waId: string;
  reserveUsd: number;
  now?: Date;
}): Promise<{ allowed: true; id: string } | { allowed: false; reason: string }> {
  return enqueue(() => {
    const model = whatsAppFaqAiModel();
    if (!whatsAppFaqModelRates(model)) {
      return { allowed: false, reason: "model_unpriced" };
    }
    if (!Number.isFinite(input.reserveUsd) || input.reserveUsd <= 0) {
      return { allowed: false, reason: "model_unpriced" };
    }
    const decision = whatsAppFaqAiBudgetDecision(input.waId, input.now);
    if (!decision.allowed) {
      return { allowed: false, reason: decision.reason ?? "budget_exhausted" };
    }
    const usage = readUsage();
    const spent = usage === "missing" || usage === "corrupt" ? 0 : usage.spentUsd;
    const projected =
      Math.round((spent + reservedUsd() + input.reserveUsd) * 1_000_000) / 1_000_000;
    if (projected > whatsAppFaqAiMaxUsd()) {
      return { allowed: false, reason: "budget_exhausted" };
    }
    const now = input.now ?? new Date();
    const id = String(nextReservationId++);
    reservations.push({
      id,
      waKey: waKey(input.waId),
      hour: now.toISOString().slice(0, 13),
      usd: input.reserveUsd,
      model,
    });
    return { allowed: true, id };
  });
}

export function recordWhatsAppFaqAiUsage(input: {
  waId: string;
  inputTokens: number;
  outputTokens: number;
  now?: Date;
  model?: string;
}): boolean {
  const loaded = readUsage();
  if (loaded === "corrupt") return false;
  const usage = loaded === "missing" ? emptyUsage() : loaded;
  const cost = estimateWhatsAppFaqAiUsd(
    input.inputTokens,
    input.outputTokens,
    input.model ?? whatsAppFaqAiModel()
  );
  usage.spentUsd = Math.round((usage.spentUsd + cost) * 1_000_000) / 1_000_000;
  usage.calls += 1;
  const hour = (input.now ?? new Date()).toISOString().slice(0, 13);
  const key = waKey(input.waId);
  const bucket = usage.perWaIdHour[key];
  usage.perWaIdHour[key] =
    bucket && bucket.hour === hour
      ? { hour, count: bucket.count + 1 }
      : { hour, count: 1 };
  writeUsage(usage);
  return true;
}

export function settleWhatsAppFaqAiReservation(input: {
  id: string;
  waId: string;
  inputTokens: number;
  outputTokens: number;
  now?: Date;
}): Promise<void> {
  return enqueue(() => {
    const index = reservations.findIndex((row) => row.id === input.id);
    if (index < 0) return;
    const reservation = reservations[index];
    const wrote = recordWhatsAppFaqAiUsage({
      waId: input.waId,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      now: input.now,
      model: reservation.model,
    });
    if (wrote) reservations.splice(index, 1);
  });
}

export function __setWhatsAppFaqBudgetForTests(usage: UsageFile | null): void {
  memoryOverride = usage;
  usageFileUnreadable = false;
  reservations = [];
}

export function __markWhatsAppFaqUsageCorruptForTests(): void {
  memoryOverride = null;
  usageFileUnreadable = true;
}

export function __readWhatsAppFaqBudgetForTests(): UsageFile | "missing" | "corrupt" {
  return readUsage();
}
