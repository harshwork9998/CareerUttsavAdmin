import type { MetaMessageTemplate } from "@/lib/server/whatsapp/meta-templates";
import { assessTemplateCapability } from "@/lib/server/whatsapp/campaign-template-capability";
import type { CampaignVariableMapping } from "@/lib/server/whatsapp/campaign-variable-mapping";
import {
  buildTemplateComponentsFromMapping,
  validateVariableMapping,
} from "@/lib/server/whatsapp/campaign-variable-mapping";
import { toWhatsAppRecipientWaId } from "@/lib/server/whatsapp/campaign-phone";
import { countCampaignRecipients } from "@/lib/server/whatsapp/campaign-stats";
import {
  createCampaignDraft,
  replaceCampaignRecipients,
  setCampaignStatus,
  updateCampaignDraft,
} from "@/lib/server/whatsapp/campaign-store";
import { parseContactsFromMatrix } from "@/lib/server/whatsapp/campaign-import";
import { loadSuppressedPhoneLast10Set } from "@/lib/server/whatsapp/campaign-suppression";
import {
  dryRunMessageId,
  isWhatsAppCampaignDryRun,
} from "@/lib/server/whatsapp/campaign-dry-run";
import { prisma } from "@/lib/server/prisma";
import { sendWhatsAppTemplate } from "@/lib/server/whatsapp/meta-client";
import {
  readCampaignDefaultBatchSize,
  readCampaignDefaultSendDelayMs,
} from "@/lib/server/whatsapp/campaign-config";
import {
  assertWhatsAppCampaignLiveSendAllowed,
  readCampaignMaxRecipientsPerLaunch,
} from "@/lib/server/whatsapp/campaign-live-send";
import {
  deriveImportHeadersFromRowData,
  readVariableMappingFromJson,
} from "@/lib/server/whatsapp/campaign-wizard-resume";

export async function listCampaigns() {
  return prisma.whatsAppCampaign.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      templateName: true,
      templateLanguage: true,
      createdAt: true,
      startedAt: true,
      completedAt: true,
    },
  });
}

async function loadCampaignImportHeaders(campaignId: string): Promise<string[]> {
  const sample = await prisma.whatsAppCampaignRecipient.findFirst({
    where: { campaignId, rowNumber: { not: null } },
    select: { rowData: true },
    orderBy: { rowNumber: "asc" },
  });
  if (!sample?.rowData || typeof sample.rowData !== "object") {
    return [];
  }
  return deriveImportHeadersFromRowData(
    sample.rowData as Record<string, string>
  );
}

export async function getCampaignDetail(campaignId: string) {
  const campaign = await prisma.whatsAppCampaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign || campaign.deletedAt) return null;
  const counts = await countCampaignRecipients(campaignId);
  const importHeaders = await loadCampaignImportHeaders(campaignId);
  return {
    campaign,
    counts,
    importHeaders,
    variableMapping: readVariableMappingFromJson(campaign.variableMapping),
  };
}

export function staffFacingError(message: string): string {
  return message;
}

export async function importCampaignContacts(input: {
  campaignId: string;
  headers: string[];
  rows: string[][];
  mobileColumn: string;
}) {
  const campaign = await prisma.whatsAppCampaign.findUnique({
    where: { id: input.campaignId },
    select: { id: true, status: true, deletedAt: true },
  });
  if (!campaign || campaign.deletedAt || campaign.status !== "DRAFT") {
    throw new Error("This campaign cannot accept a new contact list.");
  }

  const optedOut = await loadSuppressedPhoneLast10Set();
  const parsed = parseContactsFromMatrix({
    headers: input.headers,
    rows: input.rows,
    mobileColumn: input.mobileColumn,
    optedOutLast10: optedOut,
  });

  const skippedRows = parsed.skipped.map((row) => ({
    rowNumber: row.rowNumber,
    status:
      row.reason === "On opt-out list"
        ? ("OPTED_OUT" as const)
        : row.reason === "Duplicate number in file"
          ? ("DUPLICATE" as const)
          : row.reason === "Invalid mobile number"
            ? ("INVALID" as const)
            : ("SKIPPED" as const),
    reason: row.reason,
    waId: `import-skip-${input.campaignId}-${row.rowNumber}`,
    phoneLast10: "0000000000",
  }));

  await replaceCampaignRecipients(input.campaignId, parsed.accepted, skippedRows);

  return {
    acceptedCount: parsed.accepted.length,
    skippedCount: parsed.skipped.length,
    duplicateCount: parsed.duplicateCount,
    invalidCount: parsed.invalidCount,
    emptyCount: parsed.emptyCount,
  };
}

export async function applyCampaignTemplate(input: {
  campaignId: string;
  template: MetaMessageTemplate;
  variableMapping: CampaignVariableMapping;
}) {
  const capability = assessTemplateCapability(input.template);
  if (!capability.supported) {
    throw new Error(
      capability.issues[0]?.message ?? "This template cannot be used in Campaigns."
    );
  }

  const mappingError = validateVariableMapping({
    mapping: input.variableMapping,
    headerSlots: capability.headerVariableCount,
    bodySlots: capability.bodyVariableCount,
  });
  if (mappingError) {
    throw new Error(mappingError);
  }

  return updateCampaignDraft(input.campaignId, {
    templateName: input.template.name,
    templateLanguage: input.template.language,
    templateSnapshot: input.template,
    variableMapping: input.variableMapping,
  });
}

export async function confirmCampaignConsent(campaignId: string, adminUserId: string) {
  return updateCampaignDraft(campaignId, {
    consentConfirmedAt: new Date(),
    consentConfirmedBy: adminUserId,
  });
}

export async function sendCampaignTest(input: {
  campaignId: string;
  testMobile: string;
}) {
  const campaign = await prisma.whatsAppCampaign.findUnique({
    where: { id: input.campaignId },
  });
  if (!campaign?.templateName || !campaign.templateLanguage) {
    throw new Error("Choose a template before sending a test.");
  }

  const waId = toWhatsAppRecipientWaId(input.testMobile);
  if (!waId) {
    throw new Error("Enter a valid Indian mobile number for the test.");
  }

  const mapping = campaign.variableMapping as CampaignVariableMapping | null;
  const components = mapping
    ? buildTemplateComponentsFromMapping({
        mapping,
        rowData: { name: "Test", Name: "Test" },
      })
    : undefined;

  assertWhatsAppCampaignLiveSendAllowed();

  if (isWhatsAppCampaignDryRun()) {
    await updateCampaignDraft(input.campaignId, {
      testRecipientWaId: waId,
    });
    return {
      ok: true as const,
      messageId: dryRunMessageId(`test-${campaign.id}`),
      dryRun: true,
    };
  }

  const result = await sendWhatsAppTemplate({
    to: waId,
    templateName: campaign.templateName,
    languageCode: campaign.templateLanguage,
    components,
  });

  if (!result.success) {
    throw new Error(
      "The test message could not be sent. Check the template settings and try again."
    );
  }

  await updateCampaignDraft(input.campaignId, { testRecipientWaId: waId });
  return { ok: true as const, messageId: result.messageId };
}

export async function startCampaign(campaignId: string) {
  const campaign = await prisma.whatsAppCampaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign || campaign.deletedAt) throw new Error("Campaign not found.");
  if (!campaign.consentConfirmedAt) {
    throw new Error("Confirm consent before sending.");
  }
  if (!campaign.templateName || !campaign.templateLanguage) {
    throw new Error("Choose a template before sending.");
  }

  const pending = await prisma.whatsAppCampaignRecipient.count({
    where: { campaignId, status: "PENDING" },
  });
  if (pending === 0) {
    throw new Error("Upload contacts before sending.");
  }

  const maxRecipients = readCampaignMaxRecipientsPerLaunch();
  if (pending > maxRecipients) {
    throw new Error(
      `This campaign has ${pending} recipients waiting to send. The safe maximum per launch is ${maxRecipients}. Split the contact list or verify Meta messaging capacity before raising the limit.`
    );
  }

  assertWhatsAppCampaignLiveSendAllowed();

  await setCampaignStatus(campaignId, "RUNNING");
  return { pending };
}

export async function createNewCampaign(name: string, adminUserId: string) {
  return createCampaignDraft({
    name,
    createdByAdminId: adminUserId,
    sendDelayMs: readCampaignDefaultSendDelayMs(),
    batchSize: readCampaignDefaultBatchSize(),
  });
}