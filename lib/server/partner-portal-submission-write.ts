import type { Prisma } from "@/lib/generated/prisma/client";

import {
  removePortalDocumentByKind,
  upsertEventRepresentatives,
  upsertPortalDocumentByKind,
  upsertSeminarSpeakers,
} from "@/lib/partner-portal-submission-merge";
import { isPrismaPartnerPersistence } from "@/lib/server/partner-persistence-mode";
import { getPrismaPartnerById } from "@/lib/server/partner-prisma-store";
import { prisma } from "@/lib/server/prisma";
import { loadPartners, savePartners } from "@/lib/server/partners-persistence";
import type {
  Partner,
  PartnerPortalDocument,
  PartnerRepresentativesSubmission,
  PartnerSeminarSpeakerSubmission,
} from "@/types";

const tail = new Map<string, Promise<unknown>>();

async function withPartnerLock<T>(partnerId: string, fn: () => Promise<T>): Promise<T> {
  const previous = tail.get(partnerId) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const current = previous.then(() => gate);
  tail.set(partnerId, current);
  await previous.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
  }
}

function readJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  return value as T;
}

type PortalColumns = {
  portalDocuments: PartnerPortalDocument[];
  portalFasciaName: string;
  portalWebsiteUrl: string;
  portalSmsContent: string;
  portalSeminarSpeakers: PartnerSeminarSpeakerSubmission[];
  portalRepresentatives: PartnerRepresentativesSubmission[];
};

function columnsFromPartner(partner: Partner): PortalColumns {
  return {
    portalDocuments: [...(partner.portalDocuments ?? [])],
    portalFasciaName: partner.portalFasciaName ?? "",
    portalWebsiteUrl: partner.portalWebsiteUrl ?? "",
    portalSmsContent: partner.portalSmsContent ?? "",
    portalSeminarSpeakers: [...(partner.portalSeminarSpeakers ?? [])],
    portalRepresentatives: [...(partner.portalRepresentatives ?? [])],
  };
}

export type PortalSubmissionMutation =
  | { op: "set_field"; field: "portalFasciaName" | "portalWebsiteUrl" | "portalSmsContent"; value: string }
  | { op: "upsert_document"; document: PartnerPortalDocument }
  | { op: "remove_document"; kind: PartnerPortalDocument["kind"] }
  | { op: "upsert_speakers"; row: PartnerSeminarSpeakerSubmission }
  | { op: "upsert_representatives"; row: PartnerRepresentativesSubmission };

export function applyPortalSubmissionMutation(
  columns: PortalColumns,
  mutation: PortalSubmissionMutation
): { columns: PortalColumns; replacedDocument?: PartnerPortalDocument } {
  if (mutation.op === "set_field") {
    return {
      columns: { ...columns, [mutation.field]: mutation.value },
    };
  }
  if (mutation.op === "upsert_document") {
    const merged = upsertPortalDocumentByKind(columns.portalDocuments, mutation.document);
    return {
      columns: { ...columns, portalDocuments: merged.documents },
      replacedDocument: merged.replaced,
    };
  }
  if (mutation.op === "remove_document") {
    const merged = removePortalDocumentByKind(columns.portalDocuments, mutation.kind);
    return {
      columns: { ...columns, portalDocuments: merged.documents },
      replacedDocument: merged.removed,
    };
  }
  if (mutation.op === "upsert_speakers") {
    return {
      columns: {
        ...columns,
        portalSeminarSpeakers: upsertSeminarSpeakers(
          columns.portalSeminarSpeakers,
          mutation.row
        ),
      },
    };
  }
  return {
    columns: {
      ...columns,
      portalRepresentatives: upsertEventRepresentatives(
        columns.portalRepresentatives,
        mutation.row
      ),
    },
  };
}

async function writePrismaColumns(
  partnerId: string,
  mutation: PortalSubmissionMutation
): Promise<{ partner: Partner; replacedDocument?: PartnerPortalDocument } | null> {
  const replaced = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM partners WHERE id = ${partnerId} FOR UPDATE`;
    const row = await tx.partner.findUnique({
      where: { id: partnerId },
      select: {
        portalDocuments: true,
        portalFasciaName: true,
        portalWebsiteUrl: true,
        portalSmsContent: true,
        portalSeminarSpeakers: true,
        portalRepresentatives: true,
      },
    });
    if (!row) return null;
    const current: PortalColumns = {
      portalDocuments: readJson<PartnerPortalDocument[]>(row.portalDocuments, []),
      portalFasciaName: row.portalFasciaName ?? "",
      portalWebsiteUrl: row.portalWebsiteUrl ?? "",
      portalSmsContent: row.portalSmsContent ?? "",
      portalSeminarSpeakers: readJson<PartnerSeminarSpeakerSubmission[]>(
        row.portalSeminarSpeakers,
        []
      ),
      portalRepresentatives: readJson<PartnerRepresentativesSubmission[]>(
        row.portalRepresentatives,
        []
      ),
    };
    const next = applyPortalSubmissionMutation(current, mutation);
    await tx.partner.update({
      where: { id: partnerId },
      data: {
        portalDocuments: next.columns.portalDocuments as unknown as Prisma.InputJsonValue,
        portalFasciaName: next.columns.portalFasciaName,
        portalWebsiteUrl: next.columns.portalWebsiteUrl,
        portalSmsContent: next.columns.portalSmsContent,
        portalSeminarSpeakers: next.columns
          .portalSeminarSpeakers as unknown as Prisma.InputJsonValue,
        portalRepresentatives: next.columns
          .portalRepresentatives as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });
    return next.replacedDocument;
  });
  if (replaced === null && !(await getPrismaPartnerById(partnerId))) return null;
  const partner = await getPrismaPartnerById(partnerId);
  if (!partner) return null;
  return { partner, replacedDocument: replaced ?? undefined };
}

async function writeJsonColumns(
  partnerId: string,
  mutation: PortalSubmissionMutation
): Promise<{ partner: Partner; replacedDocument?: PartnerPortalDocument } | null> {
  const partners = loadPartners();
  const index = partners.findIndex((partner) => partner.id === partnerId);
  if (index < 0) return null;
  const next = applyPortalSubmissionMutation(columnsFromPartner(partners[index]!), mutation);
  const updated: Partner = {
    ...partners[index]!,
    ...next.columns,
    updatedAt: new Date().toISOString(),
  };
  const copy = [...partners];
  copy[index] = updated;
  savePartners(copy);
  return { partner: updated, replacedDocument: next.replacedDocument };
}

export async function writePartnerPortalSubmission(
  partnerId: string,
  mutation: PortalSubmissionMutation
): Promise<
  | { ok: true; partner: Partner; replacedDocument?: PartnerPortalDocument }
  | { ok: false; status: number; error: string }
> {
  try {
    const saved = await withPartnerLock(partnerId, () =>
      isPrismaPartnerPersistence()
        ? writePrismaColumns(partnerId, mutation)
        : writeJsonColumns(partnerId, mutation)
    );
    if (!saved) return { ok: false, status: 404, error: "Not found" };
    return { ok: true, partner: saved.partner, replacedDocument: saved.replacedDocument };
  } catch (error) {
    console.error("[portal-submission]", error instanceof Error ? error.message : "write failed");
    return { ok: false, status: 500, error: "Could not save this update. Please try again." };
  }
}

