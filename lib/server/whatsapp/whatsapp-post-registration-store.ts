import { prisma } from "@/lib/server/prisma";
import type { PostRegistrationGrowthKind } from "@/lib/server/whatsapp/whatsapp-post-registration-messages";

export const WHATSAPP_POST_REGISTRATION_CLAIM_LEASE_MS = 60 * 1000;

export type PostRegistrationGrowthTriggerRow = {
  id: string;
  waId: string;
  registrationId: string;
  kind: PostRegistrationGrowthKind;
  dueAt: Date;
  status: "PENDING" | "CLAIMED" | "SENT" | "CANCELLED";
  claimedAt: Date | null;
  sentAt: Date | null;
  attemptCount: number;
  lastError: string | null;
};

export async function insertPostRegistrationGrowthTriggers(
  rows: Array<{
    waId: string;
    registrationId: string;
    kind: PostRegistrationGrowthKind;
    dueAt: Date;
  }>
): Promise<void> {
  if (rows.length === 0) return;
  await prisma.whatsAppPostRegistrationTrigger.createMany({
    data: rows.map((row) => ({
      waId: row.waId,
      registrationId: row.registrationId,
      kind: row.kind,
      dueAt: row.dueAt,
      status: "PENDING",
    })),
    skipDuplicates: true,
  });
}

export async function listDuePostRegistrationGrowthTriggers(
  now: Date
): Promise<PostRegistrationGrowthTriggerRow[]> {
  const leaseBefore = new Date(now.getTime() - WHATSAPP_POST_REGISTRATION_CLAIM_LEASE_MS);
  const rows = await prisma.whatsAppPostRegistrationTrigger.findMany({
    where: {
      dueAt: { lte: now },
      OR: [
        { status: "PENDING" },
        { status: "CLAIMED", claimedAt: { lt: leaseBefore } },
      ],
    },
    orderBy: { dueAt: "asc" },
    take: 100,
  });
  return rows.map((row) => ({
    id: row.id,
    waId: row.waId,
    registrationId: row.registrationId,
    kind: row.kind,
    dueAt: row.dueAt,
    status: row.status,
    claimedAt: row.claimedAt,
    sentAt: row.sentAt,
    attemptCount: row.attemptCount,
    lastError: row.lastError,
  }));
}

export async function claimPostRegistrationGrowthTrigger(
  id: string,
  now: Date
): Promise<boolean> {
  const leaseBefore = new Date(now.getTime() - WHATSAPP_POST_REGISTRATION_CLAIM_LEASE_MS);
  const claimed = await prisma.whatsAppPostRegistrationTrigger.updateMany({
    where: {
      id,
      dueAt: { lte: now },
      OR: [
        { status: "PENDING" },
        { status: "CLAIMED", claimedAt: { lt: leaseBefore } },
      ],
    },
    data: {
      status: "CLAIMED",
      claimedAt: now,
      attemptCount: { increment: 1 },
      lastError: null,
    },
  });
  return claimed.count === 1;
}

export async function markPostRegistrationGrowthTriggerSent(
  id: string,
  now: Date
): Promise<void> {
  await prisma.whatsAppPostRegistrationTrigger.updateMany({
    where: { id, status: "CLAIMED" },
    data: {
      status: "SENT",
      sentAt: now,
      claimedAt: null,
      lastError: null,
    },
  });
}

export async function releasePostRegistrationGrowthTrigger(
  id: string,
  lastError: string
): Promise<void> {
  await prisma.whatsAppPostRegistrationTrigger.updateMany({
    where: { id, status: "CLAIMED" },
    data: {
      status: "PENDING",
      claimedAt: null,
      lastError,
    },
  });
}

export async function cancelPostRegistrationGrowthTrigger(
  id: string,
  lastError: string
): Promise<void> {
  await prisma.whatsAppPostRegistrationTrigger.updateMany({
    where: { id, status: { in: ["PENDING", "CLAIMED"] } },
    data: {
      status: "CANCELLED",
      claimedAt: null,
      lastError,
    },
  });
}
