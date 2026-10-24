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
