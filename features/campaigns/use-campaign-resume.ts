"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { CampaignVariableMapping } from "@/lib/server/whatsapp/campaign-variable-mapping";
import {
  assessCampaignSendReadiness,
  buildEmptyVariableMapping,
  campaignAllowsSetupNavigation,
  deriveCampaignWizardStep,
  parseStoredTemplateKey,
  readVariableMappingFromJson,
} from "@/lib/server/whatsapp/campaign-wizard-resume";
import type { CampaignRecipientCounts } from "@/lib/server/whatsapp/campaign-stats";
import type { TemplateCapability } from "@/lib/server/whatsapp/campaign-template-capability";
import type { MetaMessageTemplate } from "@/lib/server/whatsapp/meta-templates";

export type CampaignDetailPayload = {
  campaign: {
    id: string;
    name: string;
    status: string;
    templateName: string | null;
    templateLanguage: string | null;
    consentConfirmedAt: string | null;
    variableMapping?: unknown;
    templateSnapshot?: MetaMessageTemplate | null;
  };
  counts: CampaignRecipientCounts;
  importHeaders: string[];
  variableMapping: CampaignVariableMapping | null;
};

export function useCampaignResume() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [setupNavigationActive, setSetupNavigationActive] = useState(false);
  const [uploadHeaders, setUploadHeaders] = useState<string[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");
  const [variableMapping, setVariableMapping] = useState<CampaignVariableMapping>({});
  const [consentChecked, setConsentChecked] = useState(false);
  const resumedForCampaignRef = useRef<string | null>(null);

  const syncCampaignUrl = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set("campaign", id);
      else params.delete("campaign");
      const query = params.toString();
      router.replace(query ? `/campaigns?${query}` : "/campaigns", {
        scroll: false,
      });
    },
    [router, searchParams]
  );

  const openCampaign = useCallback(
    (id: string) => {
      setSetupNavigationActive(false);
      resumedForCampaignRef.current = null;
      setCampaignId(id);
      syncCampaignUrl(id);
    },
    [syncCampaignUrl]
  );

  const clearCampaign = useCallback(() => {
    setCampaignId(null);
    setStep(0);
    setSetupNavigationActive(false);
    resumedForCampaignRef.current = null;
    syncCampaignUrl(null);
  }, [syncCampaignUrl]);

  useEffect(() => {
    const id = searchParams.get("campaign")?.trim();
    if (id && id !== campaignId) {
      setCampaignId(id);
      setSetupNavigationActive(false);
      resumedForCampaignRef.current = null;
    }
  }, [searchParams, campaignId]);

  const applyCampaignDetail = useCallback(
    (detail: CampaignDetailPayload) => {
      if (detail.campaign.id !== campaignId) return;
      if (resumedForCampaignRef.current === detail.campaign.id) {
        return;
      }

      const mapping =
        detail.variableMapping ??
        readVariableMappingFromJson(detail.campaign.variableMapping);

      setUploadHeaders(detail.importHeaders);
      setSelectedTemplateKey(
        parseStoredTemplateKey({
          templateName: detail.campaign.templateName,
          templateLanguage: detail.campaign.templateLanguage,
        })
      );
      setVariableMapping(mapping ?? {});
      setConsentChecked(Boolean(detail.campaign.consentConfirmedAt));

      if (!setupNavigationActive) {
        const nextStep = deriveCampaignWizardStep({
          status: detail.campaign.status,
          templateName: detail.campaign.templateName,
          templateLanguage: detail.campaign.templateLanguage,
          variableMapping: mapping,
          consentConfirmedAt: detail.campaign.consentConfirmedAt,
          counts: {
            total: detail.counts.total,
            pending: detail.counts.pending,
            eligible: detail.counts.eligible,
          },
        });
        setStep(nextStep);
      }

      resumedForCampaignRef.current = detail.campaign.id;
    },
    [campaignId, setupNavigationActive]
  );

  const goToStep = useCallback(
    (next: number, options?: { userNavigated?: boolean }) => {
      if (options?.userNavigated) {
        setSetupNavigationActive(true);
      }
      setStep(next);
    },
    []
  );

  const onTemplateSelected = useCallback(
    (key: string, capability: TemplateCapability | undefined) => {
      setSelectedTemplateKey(key);
      if (capability) {
        setVariableMapping(buildEmptyVariableMapping(capability));
      }
    },
    []
  );

  return {
    step,
    campaignId,
    setCampaignId: openCampaign,
    clearCampaign,
    uploadHeaders,
    setUploadHeaders,
    selectedTemplateKey,
    variableMapping,
    setVariableMapping,
    consentChecked,
    setConsentChecked,
    applyCampaignDetail,
    goToStep,
    onTemplateSelected,
    allowsSetupNavigation: (status: string | undefined) =>
      status ? campaignAllowsSetupNavigation(status) : false,
    assessSendReadiness: (
      status: string,
      templateName: string | null,
      templateLanguage: string | null,
      headerSlots: number,
      bodySlots: number,
      pending: number
    ) =>
      assessCampaignSendReadiness({
        status,
        templateName,
        templateLanguage,
        variableMapping,
        headerSlots,
        bodySlots,
        consentConfirmed: consentChecked,
        pendingRecipients: pending,
      }),
  };
}