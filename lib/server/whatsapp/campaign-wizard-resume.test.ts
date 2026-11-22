import { describe, expect, it } from "vitest";

import { assessTemplateCapability } from "@/lib/server/whatsapp/campaign-template-capability";
import { CAREER_UTTSAV_PRINCIPAL_TEMPLATE } from "@/lib/server/whatsapp/campaign-template-fixtures";
import {
  assessCampaignSendReadiness,
  deriveCampaignWizardStep,
  parseStoredTemplateKey,
} from "@/lib/server/whatsapp/campaign-wizard-resume";

const baseCounts = { total: 0, pending: 0, eligible: 0 };

describe("deriveCampaignWizardStep", () => {
  it("reopens DRAFT at step 2 when contacts exist but template missing", () => {
    const step = deriveCampaignWizardStep({
      status: "DRAFT",
      templateName: null,
      templateLanguage: null,
      variableMapping: null,
      consentConfirmedAt: null,
      counts: { total: 5, pending: 3, eligible: 3 },
    });
    expect(step).toBe(2);
  });

  it("reopens DRAFT at step 1 without contacts", () => {
    expect(
      deriveCampaignWizardStep({
        status: "DRAFT",
        templateName: null,
        templateLanguage: null,
        variableMapping: null,
        consentConfirmedAt: null,
        counts: baseCounts,
      })
    ).toBe(1);
  });

  it("reopens DRAFT at step 3 when template is configured", () => {
    expect(
      deriveCampaignWizardStep({
        status: "DRAFT",
        templateName: "hello",
        templateLanguage: "en",
        variableMapping: { body: [] },
        consentConfirmedAt: null,
        counts: { total: 3, pending: 3, eligible: 3 },
      })
    ).toBe(3);
  });

  it("opens RUNNING and COMPLETED at progress step", () => {
    const snapshot = {
      templateName: "x",
      templateLanguage: "en",
      variableMapping: null,
      consentConfirmedAt: new Date().toISOString(),
      counts: { total: 10, pending: 0, eligible: 10 },
    };
    expect(deriveCampaignWizardStep({ ...snapshot, status: "RUNNING" })).toBe(4);
    expect(deriveCampaignWizardStep({ ...snapshot, status: "COMPLETED" })).toBe(4);
    expect(deriveCampaignWizardStep({ ...snapshot, status: "PAUSED" })).toBe(4);
    expect(deriveCampaignWizardStep({ ...snapshot, status: "CANCELLED" })).toBe(4);
  });

  it("does not send DRAFT users to progress step", () => {
    const step = deriveCampaignWizardStep({
      status: "DRAFT",
      templateName: null,
      templateLanguage: null,
      variableMapping: null,
      consentConfirmedAt: null,
      counts: { total: 3, pending: 3, eligible: 3 },
    });
    expect(step).not.toBe(4);
  });
});

describe("assessCampaignSendReadiness", () => {
  it("blocks send without template, consent, or contacts", () => {
    const result = assessCampaignSendReadiness({
      status: "DRAFT",
      templateName: null,
      templateLanguage: null,
      variableMapping: null,
      capability: null,
      consentConfirmed: false,
      pendingRecipients: 0,
    });
    expect(result.ready).toBe(false);
    expect(result.blockingReasons.length).toBeGreaterThan(0);
  });

  it("allows send when template, consent, and pending contacts are set", () => {
    const result = assessCampaignSendReadiness({
      status: "DRAFT",
      templateName: "hello",
      templateLanguage: "en",
      variableMapping: { header: [], body: [] },
      capability: assessTemplateCapability({
        name: "hello",
        language: "en",
        status: "APPROVED",
        components: [{ type: "BODY", text: "Hi" }],
      }),
      consentConfirmed: true,
      pendingRecipients: 3,
    });
    expect(result.ready).toBe(true);
  });

  it("blocks document templates without pdf attachment", () => {
    const capability = assessTemplateCapability(CAREER_UTTSAV_PRINCIPAL_TEMPLATE);
    const result = assessCampaignSendReadiness({
      status: "DRAFT",
      templateName: "career_uttsav_principal",
      templateLanguage: "en",
      variableMapping: {
        body: [{ kind: "static", value: "School" }],
        buttonUrls: [
          { urlButtonIndex: 1, source: { kind: "static", value: "invite" } },
        ],
      },
      capability,
      consentConfirmed: true,
      pendingRecipients: 3,
    });
    expect(result.ready).toBe(false);
    expect(result.blockingReasons.join(" ")).toMatch(/PDF/i);
  });
});

describe("parseStoredTemplateKey", () => {
  it("rebuilds template select key after refresh", () => {
    expect(
      parseStoredTemplateKey({
        templateName: "seasonal_offer",
        templateLanguage: "en",
      })
    ).toBe("seasonal_offer:en");
  });
});