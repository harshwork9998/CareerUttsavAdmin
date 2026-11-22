import { prisma } from "@/lib/server/prisma";
import { normalizeWaId } from "@/lib/server/whatsapp/registration-conversation";

const GENERIC_ACK_PATTERNS = [
  /^thanks?$/i,
  /^thank\s*you$/i,
  /^ok$/i,
  /^okay$/i,
  /^received$/i,
  /^noted$/i,
  /^hi$/i,
  /^hello$/i,
  /^hey$/i,
  /^done$/i,
];

const RECENT_CAMPAIGN_MS = 72 * 60 * 60 * 1000;

export function isGenericCampaignAcknowledgement(
  text: string | undefined
): boolean {
  if (!text?.trim()) return false;
  const normalized = text.trim();
  return GENERIC_ACK_PATTERNS.some((pattern) => pattern.test(normalized));
}

export async function shouldIgnoreGenericCampaignReply(input: {
  waId: string;
  text?: string;
  conversationStep?: string | null;
  conversationStatus?: string | null;
}): Promise<boolean> {
  if (!isGenericCampaignAcknowledgement(input.text)) {
    return false;
  }

  const inRegistrationFlow =
    input.conversationStatus === "ACTIVE" &&
    input.conversationStep &&
    input.conversationStep !== "AWAITING_START";

  if (inRegistrationFlow) {
    return false;
  }

  const waId = normalizeWaId(input.waId);
  const since = new Date(Date.now() - RECENT_CAMPAIGN_MS);
  const recent = await prisma.whatsAppCampaignRecipient.findFirst({
    where: {
      waId,
      acceptedAt: { gte: since },
      status: {
        in: ["ACCEPTED", "SENT", "DELIVERED", "READ"],
      },
    },
    select: { id: true },
  });

  return Boolean(recent);
}