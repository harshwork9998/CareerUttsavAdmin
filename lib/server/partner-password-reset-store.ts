import { createHash, randomBytes } from "crypto";

import { prisma } from "@/lib/server/prisma";

export const PARTNER_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

export function hashPartnerResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generatePartnerResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function revokeUnusedPartnerResetTokens(partnerId: string): Promise<void> {
  await prisma.partnerPasswordResetToken.updateMany({
    where: { partnerId, usedAt: null },
    data: { usedAt: new Date() },
  });
}

export async function issuePartnerResetToken(partnerId: string): Promise<string> {
  const token = generatePartnerResetToken();
  const now = new Date();
  await revokeUnusedPartnerResetTokens(partnerId);
  await prisma.partnerPasswordResetToken.create({
    data: {
      partnerId,
      tokenHash: hashPartnerResetToken(token),
      expiresAt: new Date(now.getTime() + PARTNER_RESET_TOKEN_TTL_MS),
    },
  });
  return token;
}

export type StoredResetToken = {
  id: string;
  partnerId: string;
  expiresAt: Date;
  usedAt: Date | null;
};

export async function peekPartnerResetToken(
  token: string
): Promise<StoredResetToken | null> {
  const tokenHash = hashPartnerResetToken(token);
  const record = await prisma.partnerPasswordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, partnerId: true, expiresAt: true, usedAt: true },
  });
  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    return null;
  }
  return record;
}

/** Single-use consume. A concurrent second use updates zero rows. */
export async function consumePartnerResetToken(
  token: string
): Promise<StoredResetToken | null> {
  const record = await peekPartnerResetToken(token);
  if (!record) return null;
  const updated = await prisma.partnerPasswordResetToken.updateMany({
    where: {
      id: record.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  });
  if (updated.count !== 1) return null;
  return record;
}
