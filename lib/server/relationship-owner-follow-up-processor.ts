import { istCalendarDateFromDate } from "@/lib/server/ist-calendar";
import { isPrismaPartnerPersistence } from "@/lib/server/partner-persistence-mode";
import {
  listDistinctOwnerSpocIdsWithPartners,
  listDueFollowUpsForOwner,
} from "@/lib/server/partner-follow-up-resolver";
import { prisma } from "@/lib/server/prisma";
import {
  buildRelationshipOwnerFollowUpDigestText,
} from "@/lib/server/relationship-owner-follow-up-formatter";
import {
  readRelationshipOwnerFollowUpTemplateLanguage,
  readRelationshipOwnerFollowUpTemplateName,
} from "@/lib/server/relationship-owner-follow-up-config";
import {
  sendWhatsAppTemplate,
  type MetaSendResult,
} from "@/lib/server/whatsapp/meta-client";

export type RelationshipOwnerFollowUpProcessorSummary = {
  examinedOwners: number;
  sent: number;
  skipped: number;
  failed: number;
  reasons: Record<string, number>;
};

export type RelationshipOwnerFollowUpTestSendStatus = "sent" | "skipped" | "failed";

export type RelationshipOwnerFollowUpTestResult = {
  mode: "test";
  ownerSpocId: string;
  ownerName: string;
  recipientPhoneMasked: string | null;
  followUpCount: number;
  templateName: string | null;
  status: RelationshipOwnerFollowUpTestSendStatus;
  reason?: string;
  messageId?: string;
  errorCode?: string;
};

function increment(
  reasons: Record<string, number>,
  reason: string
): void {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

function normalizeRecipientPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits;
}

export function maskRelationshipOwnerRecipientPhone(
  phone: string
): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return null;
  const last4 = digits.slice(-4);
  return `******${last4}`;
}

type SendTemplate = typeof sendWhatsAppTemplate;

export async function processRelationshipOwnerFollowUpDigests(input?: {
  now?: Date;
  sendTemplate?: SendTemplate;
}): Promise<RelationshipOwnerFollowUpProcessorSummary> {
  const now = input?.now ?? new Date();
  const digestDate = istCalendarDateFromDate(now);
  const templateName = readRelationshipOwnerFollowUpTemplateName();
  const languageCode = readRelationshipOwnerFollowUpTemplateLanguage();
  const sendTemplate = input?.sendTemplate ?? sendWhatsAppTemplate;

  const summary: RelationshipOwnerFollowUpProcessorSummary = {
    examinedOwners: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    reasons: {},
  };

  if (!templateName) {
    increment(summary.reasons, "template_not_configured");
    return summary;
  }

  if (!isPrismaPartnerPersistence()) {
    increment(summary.reasons, "prisma_persistence_required");
    return summary;
  }

  const ownerSpocIds = await listDistinctOwnerSpocIdsWithPartners();
  for (const ownerSpocId of ownerSpocIds) {
    summary.examinedOwners += 1;

    const existing = await prisma.relationshipOwnerFollowUpDigest.findUnique({
      where: {
        ownerSpocId_digestDate: { ownerSpocId, digestDate },
      },
    });
    if (existing?.status === "SENT") {
      summary.skipped += 1;
      increment(summary.reasons, "already_sent_today");
      continue;
    }

    const spoc = await prisma.spoc.findUnique({ where: { id: ownerSpocId } });
    if (!spoc) {
      summary.skipped += 1;
      increment(summary.reasons, "spoc_not_found");
      continue;
    }

    const items = await listDueFollowUpsForOwner({ ownerSpocId, asOf: now });
    if (items.length === 0) {
      summary.skipped += 1;
      increment(summary.reasons, "zero_follow_ups");
      await prisma.relationshipOwnerFollowUpDigest.upsert({
        where: { ownerSpocId_digestDate: { ownerSpocId, digestDate } },
        create: {
          ownerSpocId,
          digestDate,
          recipientPhone: spoc.phone,
          itemCount: 0,
          templateName,
          status: "SKIPPED",
          attemptedAt: now,
          skipReason: "zero_follow_ups",
        },
        update: {
          status: "SKIPPED",
          itemCount: 0,
          skipReason: "zero_follow_ups",
          attemptedAt: now,
          updatedAt: now,
        },
      });
      continue;
    }

    const recipientPhone = normalizeRecipientPhone(spoc.phone);
    if (!recipientPhone) {
      summary.skipped += 1;
      increment(summary.reasons, "missing_phone");
      await prisma.relationshipOwnerFollowUpDigest.upsert({
        where: { ownerSpocId_digestDate: { ownerSpocId, digestDate } },
        create: {
          ownerSpocId,
          digestDate,
          recipientPhone: spoc.phone,
          itemCount: items.length,
          templateName,
          status: "SKIPPED",
          attemptedAt: now,
          skipReason: "missing_phone",
        },
        update: {
          status: "SKIPPED",
          itemCount: items.length,
          skipReason: "missing_phone",
          attemptedAt: now,
          updatedAt: now,
        },
      });
      continue;
    }

    const formatted = buildRelationshipOwnerFollowUpDigestText({
      ownerName: spoc.name,
      items,
      asOf: now,
    });

    await prisma.relationshipOwnerFollowUpDigest.upsert({
      where: { ownerSpocId_digestDate: { ownerSpocId, digestDate } },
      create: {
        ownerSpocId,
        digestDate,
        recipientPhone: spoc.phone,
        itemCount: items.length,
        templateName,
        status: "PENDING",
        attemptedAt: now,
      },
      update: {
        recipientPhone: spoc.phone,
        itemCount: items.length,
        templateName,
        status: "PENDING",
        attemptedAt: now,
        skipReason: null,
        errorCode: null,
        errorMessage: null,
        updatedAt: now,
      },
    });

    const result: MetaSendResult = await sendTemplate({
      to: recipientPhone,
      templateName,
      languageCode,
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: formatted.ownerName },
            { type: "text", text: String(formatted.itemCount) },
            { type: "text", text: formatted.details },
          ],
        },
      ],
    });

    if (result.success) {
      summary.sent += 1;
      await prisma.relationshipOwnerFollowUpDigest.update({
        where: { ownerSpocId_digestDate: { ownerSpocId, digestDate } },
        data: {
          status: "SENT",
          messageId: result.messageId,
          sentAt: now,
          errorCode: null,
          errorMessage: null,
          skipReason: null,
          updatedAt: now,
        },
      });
      continue;
    }

    summary.failed += 1;
    increment(summary.reasons, result.errorCode ?? "send_failed");
    await prisma.relationshipOwnerFollowUpDigest.update({
      where: { ownerSpocId_digestDate: { ownerSpocId, digestDate } },
      data: {
        status: "FAILED",
        errorCode: result.errorCode,
        errorMessage: result.errorCode,
        updatedAt: now,
      },
    });
  }

  return summary;
}

/**
 * Manual production template test for a single Relationship Owner.
 * Does not read or write RelationshipOwnerFollowUpDigest (no daily dedup impact).
 */
export async function processRelationshipOwnerFollowUpDigestTest(input: {
  ownerSpocId: string;
  now?: Date;
  sendTemplate?: SendTemplate;
}): Promise<RelationshipOwnerFollowUpTestResult> {
  const now = input?.now ?? new Date();
  const ownerSpocId = input.ownerSpocId.trim();
  const templateName = readRelationshipOwnerFollowUpTemplateName();
  const languageCode = readRelationshipOwnerFollowUpTemplateLanguage();
  const sendTemplate = input.sendTemplate ?? sendWhatsAppTemplate;

  const base = {
    mode: "test" as const,
    ownerSpocId,
    ownerName: "",
    recipientPhoneMasked: null as string | null,
    followUpCount: 0,
    templateName,
  };

  if (!ownerSpocId) {
    return {
      ...base,
      status: "skipped",
      reason: "owner_spoc_id_required",
    };
  }

  if (!templateName) {
    return {
      ...base,
      status: "skipped",
      reason: "template_not_configured",
    };
  }

  if (!isPrismaPartnerPersistence()) {
    return {
      ...base,
      status: "skipped",
      reason: "prisma_persistence_required",
    };
  }

  const spoc = await prisma.spoc.findUnique({ where: { id: ownerSpocId } });
  if (!spoc) {
    return {
      ...base,
      status: "skipped",
      reason: "spoc_not_found",
    };
  }

  const ownerName = spoc.name;
  const recipientPhoneMasked = maskRelationshipOwnerRecipientPhone(spoc.phone);

  const items = await listDueFollowUpsForOwner({ ownerSpocId, asOf: now });
  if (items.length === 0) {
    return {
      ...base,
      ownerName,
      recipientPhoneMasked,
      followUpCount: 0,
      status: "skipped",
      reason: "zero_follow_ups",
    };
  }

  const recipientPhone = normalizeRecipientPhone(spoc.phone);
  if (!recipientPhone) {
    return {
      ...base,
      ownerName,
      recipientPhoneMasked,
      followUpCount: items.length,
      status: "skipped",
      reason: "missing_phone",
    };
  }

  const formatted = buildRelationshipOwnerFollowUpDigestText({
    ownerName: spoc.name,
    items,
    asOf: now,
  });

  const result: MetaSendResult = await sendTemplate({
    to: recipientPhone,
    templateName,
    languageCode,
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: formatted.ownerName },
          { type: "text", text: String(formatted.itemCount) },
          { type: "text", text: formatted.details },
        ],
      },
    ],
  });

  if (result.success) {
    return {
      ...base,
      ownerName,
      recipientPhoneMasked,
      followUpCount: items.length,
      status: "sent",
      messageId: result.messageId,
    };
  }

  return {
    ...base,
    ownerName,
    recipientPhoneMasked,
    followUpCount: items.length,
    status: "failed",
    reason: result.errorCode ?? "send_failed",
    errorCode: result.errorCode,
  };
}
