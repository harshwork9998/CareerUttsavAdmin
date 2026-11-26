const DEFAULT_MAX_USD = 4;
const DEFAULT_MAX_CALLS_PER_HOUR = 60;
const ABSOLUTE_MAX_CALLS_PER_HOUR = 120;

export function isWhatsAppFaqEnabled(): boolean {
  return process.env.WHATSAPP_FAQ_ENABLED?.trim() === "true";
}

export function isWhatsAppFaqAiEnabled(): boolean {
  return process.env.WHATSAPP_FAQ_AI_ENABLED?.trim() === "true";
}

export const WHATSAPP_FAQ_AI_DEFAULT_MODEL = "gpt-6-luna";

export function whatsAppFaqAiModel(): string {
  return process.env.WHATSAPP_FAQ_AI_MODEL?.trim() || WHATSAPP_FAQ_AI_DEFAULT_MODEL;
}

export function whatsAppFaqAiTimeoutMs(): number {
  const raw = Number(process.env.WHATSAPP_FAQ_AI_TIMEOUT_MS);
  if (!Number.isFinite(raw) || raw < 500) return 3500;
  return Math.min(raw, 8000);
}

export function whatsAppFaqAiMaxUsd(): number {
  const raw = Number(process.env.WHATSAPP_FAQ_AI_MAX_USD);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_MAX_USD;
  return Math.min(raw, DEFAULT_MAX_USD);
}

export function whatsAppFaqAiMaxCallsPerHour(): number {
  const raw = Number(process.env.WHATSAPP_FAQ_AI_MAX_CALLS_PER_HOUR);
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_MAX_CALLS_PER_HOUR;
  return Math.min(Math.floor(raw), ABSOLUTE_MAX_CALLS_PER_HOUR);
}

export function whatsAppFaqAiAllowlist(): Set<string> {
  const raw = process.env.WHATSAPP_FAQ_AI_ALLOWLIST?.trim() ?? "";
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((part) => part.replace(/\D/g, ""))
      .filter((part) => part.length >= 10)
  );
}

/** Empty allowlist matches nobody. Pilot testing must list staff numbers explicitly. */
export function isWhatsAppFaqAllowedForWaId(waId: string): boolean {
  const allowlist = whatsAppFaqAiAllowlist();
  if (allowlist.size === 0) return false;
  const digits = waId.replace(/\D/g, "");
  for (const entry of allowlist) {
    if (digits.endsWith(entry) || entry.endsWith(digits.slice(-10))) return true;
  }
  return false;
}
