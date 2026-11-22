import {
  buildInitialVariableMapping,
  type CampaignVariableMapping,
  validateCampaignTemplateMapping,
} from "@/lib/server/whatsapp/campaign-variable-mapping";
import type { TemplateCapability } from "@/lib/server/whatsapp/campaign-template-capability";
import type { CampaignRecipientCounts } from "@/lib/server/whatsapp/campaign-stats";
import type { MetaMessageTemplate } from "@/lib/server/whatsapp/meta-templates";

export type CampaignWizardSnapshot = {
  status: string;
  templateName: string | null;
  templateLanguage: string | null;
  variableMapping: CampaignVariableMapping | null;
  consentConfirmedAt: string | Date | null;
  counts: Pick<
    CampaignRecipientCounts,
    "total" | "pending" | "eligible"
  >;
};

/** Wizard indices: 0 list, 1 upload, 2 template, 3 review, 4 progress/report */
export function deriveCampaignWizardStep(
  snapshot: CampaignWizardSnapshot
): number {
  if (
    snapshot.status === "RUNNING" ||
    snapshot.status === "PAUSED" ||
    snapshot.status === "COMPLETED" ||
    snapshot.status === "CANCELLED"
  ) {
    return 4;
  }

  if (snapshot.status !== "DRAFT") {
    return 0;
  }

  const hasImportedRows = snapshot.counts.total > 0;
  const hasSendableContacts = snapshot.counts.pending > 0;

  if (!hasImportedRows) {
    return 1;
  }

  if (!hasSendableContacts) {
    return 1;
  }

  if (!snapshot.templateName || !snapshot.templateLanguage) {
    return 2;
  }

  return 3;
}

export function isDraftSetupStep(step: number): boolean {
  return step >= 1 && step <= 3;
}

export function campaignAllowsSetupNavigation(status: string): boolean {
  return status === "DRAFT";
}

export type CampaignSendReadiness = {
  ready: boolean;
  blockingReasons: string[];
};

export function assessCampaignSendReadiness(input: {
  status: string;
  templateName: string | null;
  templateLanguage: string | null;
  variableMapping: CampaignVariableMapping | null;
  capability: TemplateCapability | null;
  consentConfirmed: boolean;
  pendingRecipients: number;
}): CampaignSendReadiness {
  const blockingReasons: string[] = [];

  if (input.status !== "DRAFT") {
    blockingReasons.push("Campaign is not in setup.");
  }
  if (!input.templateName || !input.templateLanguage) {
    blockingReasons.push("Choose an approved template.");
  }
  if (input.pendingRecipients < 1) {
    blockingReasons.push("Upload contacts with at least one ready recipient.");
  }
  if (!input.consentConfirmed) {
    blockingReasons.push("Confirm consent before sending.");
  }

  if (input.capability && input.variableMapping) {
    const mappingError = validateCampaignTemplateMapping({
      capability: input.capability,
      mapping: input.variableMapping,
    });
    if (mappingError) {
      blockingReasons.push(mappingError);
    }
  }

  return { ready: blockingReasons.length === 0, blockingReasons };
}

export function buildEmptyVariableMapping(
  capability: TemplateCapability
): CampaignVariableMapping {
  return buildInitialVariableMapping(capability);
}

export function templateOptionKey(
  name: string,
  language: string
): string {
  return `${name}:${language}`;
}

export function parseStoredTemplateKey(input: {
  templateName: string | null;
  templateLanguage: string | null;
}): string {
  if (!input.templateName || !input.templateLanguage) return "";
  return templateOptionKey(input.templateName, input.templateLanguage);
}

export function readVariableMappingFromJson(
  value: unknown
): CampaignVariableMapping | null {
  if (!value || typeof value !== "object") return null;
  return value as CampaignVariableMapping;
}

export function deriveImportHeadersFromRowData(
  rowData: Record<string, string> | null
): string[] {
  if (!rowData) return [];
  return Object.keys(rowData);
}

export type CampaignDetailForResume = CampaignWizardSnapshot & {
  id: string;
  name: string;
  importHeaders: string[];
  templateSnapshot: MetaMessageTemplate | null;
};