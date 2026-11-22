import type { CampaignVariableMapping } from "@/lib/server/whatsapp/campaign-variable-mapping";
import { buildTemplateComponentsFromMapping } from "@/lib/server/whatsapp/campaign-variable-mapping";
import {
  isRecipientAuthorizedForOutbound,
  markRecipientAccepted,
  markRecipientFailed,
  markRecipientNeedsReview,
  markRecipientSimulated,
  markRecipientSubmissionStarted,
  markUnknownDeliveryStatuses,
  returnRecipientWhenSafe,
  tryCompleteCampaign,
  claimCampaignRecipients,
} from "@/lib/server/whatsapp/campaign-store";
import { loadSuppressedPhoneLast10Set } from "@/lib/server/whatsapp/campaign-suppression";
import { prisma } from "@/lib/server/prisma";
import { isWhatsAppCampaignDryRun } from "@/lib/server/whatsapp/campaign-dry-run";
import { sendWhatsAppTemplate, type MetaSendResult } from "@/lib/server/whatsapp/meta-client";
import { isPhoneSuppressed } from "@/lib/server/whatsapp/campaign-suppression";
import { classifyMetaSendFailure } from "@/lib/server/whatsapp/campaign-send-safety";

export type CampaignProcessorSummary = {
  campaignsChecked: number;
  messagesAttempted: number;
  accepted: number;
  simulated: number;
  failed: number;
  needsReview: number;
  skipped: number;
};

type SendTemplateFn = typeof sendWhatsAppTemplate;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processRecipient(input: {
  recipientId: string;
  sendTemplate: SendTemplateFn;
}): Promise<"accepted" | "simulated" | "failed" | "needs_review" | "skipped"> {
  const recipient = await prisma.whatsAppCampaignRecipient.findUnique({
    where: { id: input.recipientId },
    include: {
      campaign: {
        select: {
          templateName: true,
          templateLanguage: true,
          variableMapping: true,
          status: true,
        },
      },
    },
  });

  if (!recipient?.campaign || recipient.campaign.status !== "RUNNING") {
    await returnRecipientWhenSafe(input.recipientId, "campaign_not_running");
    return "skipped";
  }

  if (await isPhoneSuppressed(recipient.phoneLast10)) {
    await prisma.whatsAppCampaignRecipient.updateMany({
      where: { id: recipient.id, status: "CLAIMED" },
      data: {
        status: "OPTED_OUT",
        skipReason: "opted_out",
        claimedAt: null,
      },
    });
    return "skipped";
  }

  const templateName = recipient.campaign.templateName;
  const templateLanguage = recipient.campaign.templateLanguage;
  if (!templateName || !templateLanguage) {
    await markRecipientFailed(recipient.id, "template_not_configured");
    return "failed";
  }

  const mapping = recipient.campaign.variableMapping as CampaignVariableMapping | null;
  const rowData = (recipient.rowData as Record<string, string> | null) ?? {};
  const components = mapping
    ? buildTemplateComponentsFromMapping({ mapping, rowData })
    : undefined;

  const submissionAt = new Date();
  const started = await markRecipientSubmissionStarted(
    recipient.id,
    submissionAt
  );
  if (!started) {
    return "needs_review";
  }

  if (!(await isRecipientAuthorizedForOutbound(recipient.id))) {
    await markRecipientNeedsReview(recipient.id, "send_not_authorized");
    return "needs_review";
  }

  if (isWhatsAppCampaignDryRun()) {
    await markRecipientSimulated(recipient.id, new Date());
    const after = await prisma.whatsAppCampaignRecipient.findUnique({
      where: { id: recipient.id },
      select: { status: true },
    });
    if (after?.status !== "SIMULATED") {
      await markRecipientNeedsReview(recipient.id, "simulated_save_failed");
      return "needs_review";
    }
    return "simulated";
  }

  let result: MetaSendResult;
  try {
    if (!(await isRecipientAuthorizedForOutbound(recipient.id))) {
      await markRecipientNeedsReview(recipient.id, "send_not_authorized");
      return "needs_review";
    }
    result = await input.sendTemplate({
      to: recipient.waId,
      templateName,
      languageCode: templateLanguage,
      components,
    });
  } catch {
    await markRecipientNeedsReview(recipient.id, "send_threw_exception");
    return "needs_review";
  }

  if (result.success) {
    const before = await prisma.whatsAppCampaignRecipient.findUnique({
      where: { id: recipient.id },
      select: { status: true },
    });
    await markRecipientAccepted(recipient.id, result.messageId, new Date());
    const after = await prisma.whatsAppCampaignRecipient.findUnique({
      where: { id: recipient.id },
      select: { status: true, metaMessageId: true },
    });
    if (after?.status !== "ACCEPTED" || !after.metaMessageId) {
      await markRecipientNeedsReview(recipient.id, "accepted_save_failed");
      return "needs_review";
    }
    void before;
    return "accepted";
  }

  const classified = classifyMetaSendFailure(result);
  if (classified.outcome === "needs_review") {
    await markRecipientNeedsReview(recipient.id, classified.errorCode);
    return "needs_review";
  }

  await markRecipientFailed(recipient.id, classified.errorCode);
  return "failed";
}

export async function processWhatsAppCampaignSends(input?: {
  sendTemplate?: SendTemplateFn;
}): Promise<CampaignProcessorSummary> {
  const summary: CampaignProcessorSummary = {
    campaignsChecked: 0,
    messagesAttempted: 0,
    accepted: 0,
    simulated: 0,
    failed: 0,
    needsReview: 0,
    skipped: 0,
  };

  const sendTemplate = input?.sendTemplate ?? sendWhatsAppTemplate;
  const now = new Date();
  await markUnknownDeliveryStatuses(now);

  const runningCampaigns = await prisma.whatsAppCampaign.findMany({
    where: { status: "RUNNING", deletedAt: null },
    select: {
      id: true,
      batchSize: true,
      sendDelayMs: true,
    },
  });

  summary.campaignsChecked = runningCampaigns.length;
  await loadSuppressedPhoneLast10Set();

  for (const campaign of runningCampaigns) {
    const recipientIds = await claimCampaignRecipients({
      campaignId: campaign.id,
      limit: campaign.batchSize,
      now,
    });

    for (const recipientId of recipientIds) {
      summary.messagesAttempted += 1;
      const outcome = await processRecipient({ recipientId, sendTemplate });
      if (outcome === "accepted") summary.accepted += 1;
      else if (outcome === "simulated") summary.simulated += 1;
      else if (outcome === "failed") summary.failed += 1;
      else if (outcome === "needs_review") summary.needsReview += 1;
      else summary.skipped += 1;

      if (campaign.sendDelayMs > 0) {
        await sleep(campaign.sendDelayMs);
      }
    }

    await tryCompleteCampaign(campaign.id);
  }

  return summary;
}