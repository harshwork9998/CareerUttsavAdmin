import { prisma } from "@/lib/server/prisma";
import { phoneLast10FromWaId, toWhatsAppRecipientWaId } from "@/lib/server/whatsapp/campaign-phone";

export async function loadSuppressedPhoneLast10Set(): Promise<Set<string>> {
  const rows = await prisma.whatsAppSuppression.findMany({
    select: { phoneLast10: true },
  });
  return new Set(rows.map((row) => row.phoneLast10));
}

export async function isPhoneSuppressed(phoneLast10: string): Promise<boolean> {
  const row = await prisma.whatsAppSuppression.findUnique({
    where: { phoneLast10 },
    select: { id: true },
  });
  return Boolean(row);
}

export async function recordWhatsAppOptOut(input: {
  waId: string;
  reason: string;
  source?: string;
}): Promise<void> {
  const phoneLast10 = phoneLast10FromWaId(input.waId);
  if (!phoneLast10) return;
  const waId = toWhatsAppRecipientWaId(phoneLast10) ?? input.waId.replace(/\D/g, "");

  await prisma.whatsAppSuppression.upsert({
    where: { phoneLast10 },
    create: {
      phoneLast10,
      waId,
      reason: input.reason,
      source: input.source ?? "inbound_opt_out",
    },
    update: {
      waId,
      reason: input.reason,
      source: input.source ?? "inbound_opt_out",
    },
  });

  await prisma.whatsAppCampaignRecipient.updateMany({
    where: {
      phoneLast10,
      status: { in: ["PENDING", "CLAIMED"] },
    },
    data: {
      status: "OPTED_OUT",
      skipReason: "opted_out",
      lastError: null,
      claimedAt: null,
    },
  });
}

const OPT_OUT_PATTERNS = [
  /^stop$/i,
  /^unsubscribe$/i,
  /^opt\s*out$/i,
  /^optout$/i,
  /^cancel\s*messages$/i,
];

export function isWhatsAppOptOutMessage(text: string | undefined): boolean {
  if (!text?.trim()) return false;
  const normalized = text.trim();
  return OPT_OUT_PATTERNS.some((pattern) => pattern.test(normalized));
}