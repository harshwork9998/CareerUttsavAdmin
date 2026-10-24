import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

import { Prisma } from "@/lib/generated/prisma/client";

import type {
  PartnerCommunicationTrigger,
  PartnerCommunicationType,
} from "@/lib/partner-communication-policy";
import { isPrismaPartnerPersistence } from "@/lib/server/partner-persistence-mode";
import { partnershipId } from "@/lib/server/partner-prisma-import-map";

export type PartnerCommunicationMetadata = {
  pendingKeys?: string[];
  pendingLabels?: string[];
  seminarIds?: string[];
};

export type PartnerCommunicationLogEntry = {
  id: string;
  partnerId: string;
  eventPartnershipId: string | null;
  eventId: string | null;
  communicationType: PartnerCommunicationType;
  triggerType: PartnerCommunicationTrigger;
  sentAt: string;
  outcome: "accepted";
  recipientEmail: string;
  messageId: string | null;
  metadata: PartnerCommunicationMetadata | null;
  createdAt: string;
};

export type PartnerCommunicationLogDraft = {
  partnerId: string;
  eventId?: string | null;
  communicationType: PartnerCommunicationType;
  triggerType: PartnerCommunicationTrigger;
  sentAt: string;
  messageId?: string | null;
  recipientEmail: string;
  metadata?: PartnerCommunicationMetadata | null;
};

export type PartnerCommunicationLogStore = {
  append(draft: PartnerCommunicationLogDraft): Promise<PartnerCommunicationLogEntry>;
  listForPartner(partnerId: string): Promise<PartnerCommunicationLogEntry[]>;
};

const STORE_PATH = path.join(
  process.cwd(),
  "data",
  "partner-communication-logs.json"
);

function cleanList(values: string[] | undefined): string[] {
  return (values ?? []).filter((value) => typeof value === "string" && value.trim());
}

function sanitizeMetadata(
  metadata: PartnerCommunicationMetadata | null | undefined
): PartnerCommunicationMetadata | null {
  if (!metadata) return null;
  const pendingKeys = cleanList(metadata.pendingKeys);
  const pendingLabels = cleanList(metadata.pendingLabels);
  const seminarIds = cleanList(metadata.seminarIds);
  if (pendingKeys.length === 0 && pendingLabels.length === 0 && seminarIds.length === 0) {
    return null;
  }
  return {
    ...(pendingKeys.length ? { pendingKeys } : {}),
    ...(pendingLabels.length ? { pendingLabels } : {}),
    ...(seminarIds.length ? { seminarIds } : {}),
  };
}

function toEntry(draft: PartnerCommunicationLogDraft): PartnerCommunicationLogEntry {
  const eventId = draft.eventId?.trim() || null;
  return {
    id: randomUUID(),
    partnerId: draft.partnerId,
    eventId,
    eventPartnershipId: eventId
      ? partnershipId(draft.partnerId, eventId)
      : null,
    communicationType: draft.communicationType,
    triggerType: draft.triggerType,
    sentAt: draft.sentAt,
    outcome: "accepted",
    recipientEmail: draft.recipientEmail.trim().toLowerCase(),
    messageId: draft.messageId?.trim() || null,
    metadata: sanitizeMetadata(draft.metadata),
    createdAt: new Date().toISOString(),
  };
}

export function createMemoryPartnerCommunicationLogStore(
  seed: PartnerCommunicationLogEntry[] = []
): PartnerCommunicationLogStore {
  const entries = [...seed];
  return {
    async append(draft) {
      const entry = toEntry(draft);
      entries.push(entry);
      return entry;
    },
    async listForPartner(partnerId) {
      return entries.filter((entry) => entry.partnerId === partnerId);
    },
  };
}

function readJsonStore(): PartnerCommunicationLogEntry[] {
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as PartnerCommunicationLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function createJsonPartnerCommunicationLogStore(): PartnerCommunicationLogStore {
  return {
    async append(draft) {
      const entries = readJsonStore();
      const entry = toEntry(draft);
      entries.push(entry);
      fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
      fs.writeFileSync(STORE_PATH, JSON.stringify(entries, null, 2));
      return entry;
    },
    async listForPartner(partnerId) {
      return readJsonStore().filter((entry) => entry.partnerId === partnerId);
    },
  };
}

export function createPrismaPartnerCommunicationLogStore(): PartnerCommunicationLogStore {
  return {
    async append(draft) {
      const { prisma } = await import("@/lib/server/prisma");
      const entry = toEntry(draft);
      const saved = await prisma.partnerCommunicationLog.create({
        data: {
          id: entry.id,
          partnerId: entry.partnerId,
          eventPartnershipId: entry.eventPartnershipId,
          eventId: entry.eventId,
          communicationType: entry.communicationType,
          triggerType: entry.triggerType,
          sentAt: new Date(entry.sentAt),
          outcome: entry.outcome,
          recipientEmail: entry.recipientEmail,
          messageId: entry.messageId,
          metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
          createdAt: new Date(entry.createdAt),
        },
      });
      return {
        ...entry,
        id: saved.id,
        sentAt: saved.sentAt.toISOString(),
        createdAt: saved.createdAt.toISOString(),
      };
    },
    async listForPartner(partnerId) {
      const { prisma } = await import("@/lib/server/prisma");
      const rows = await prisma.partnerCommunicationLog.findMany({
        where: { partnerId },
        orderBy: { sentAt: "asc" },
      });
      return rows
        .filter((row) => row.outcome === "accepted")
        .map((row) => ({
          id: row.id,
          partnerId: row.partnerId,
          eventPartnershipId: row.eventPartnershipId,
          eventId: row.eventId,
          communicationType: row.communicationType as PartnerCommunicationType,
          triggerType: row.triggerType as PartnerCommunicationTrigger,
          sentAt: row.sentAt.toISOString(),
          outcome: "accepted" as const,
          recipientEmail: row.recipientEmail,
          messageId: row.messageId,
          metadata: sanitizeMetadata(
            row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
              ? (row.metadata as PartnerCommunicationMetadata)
              : null
          ),
          createdAt: row.createdAt.toISOString(),
        }));
    },
  };
}

export function createPartnerCommunicationLogStore(): PartnerCommunicationLogStore {
  if (isPrismaPartnerPersistence()) {
    return createPrismaPartnerCommunicationLogStore();
  }
  return createJsonPartnerCommunicationLogStore();
}
