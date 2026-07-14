import type { PartnerDeliverable, SponsorshipTier } from "@/types";

export const STALL_SIZE_OPTIONS = [
  "6 (3x2)",
  "8 (4x2)",
  "12 (4x3)",
  "20 (5x4)",
  "24 (6x4)",
] as const;

export const BOOK_AD_PLUS2_OPTIONS = ["half page", "full page"] as const;

export const PANEL_DURATION_OPTIONS = ["45 mins", "60 mins"] as const;

export const STALL_LOGO_POSITIONING_OPTIONS = [
  "premium",
  "super premium",
  "ultra premium",
] as const;

export const BOOK_PREMIUM_SPOT_OPTIONS = [
  "premium",
  "front cover inside",
  "back cover page",
] as const;

export const PRE_REG_ACCESS_OPTIONS = [
  "selected seminar session",
  "full access",
] as const;

export type PartnerDeliverableKey =
  | "stallSize"
  | "weblink"
  | "commonBranding"
  | "fullPageWriteup"
  | "bookAdCareersAfterPlus2"
  | "smsMailerCampaign"
  | "panelDiscussion"
  | "logoB2C"
  | "accessPreRegSelectedPanel"
  | "eventSouvenirAd"
  | "stallLogoPositioning"
  | "bookAdPremiumSpot"
  | "brochureWelcomeKit"
  | "additionalStandee"
  | "accessPreRegisteredStudents"
  | "brandVideos"
  | "dedicatedActivityRoom"
  | "celebrityStageShare";

export type DeliverableDefinition = {
  key: PartnerDeliverableKey;
  label: string;
  options?: readonly string[];
};

export const PARTNER_DELIVERABLE_DEFINITIONS: DeliverableDefinition[] = [
  {
    key: "stallSize",
    label: "Stall Size (Square Meter)",
    options: STALL_SIZE_OPTIONS,
  },
  {
    key: "weblink",
    label: "Weblink in the Career Uttsav website",
  },
  {
    key: "commonBranding",
    label: "Common branding at event venue",
  },
  {
    key: "fullPageWriteup",
    label: "Full page write-up in the event souvenir",
  },
  {
    key: "bookAdCareersAfterPlus2",
    label: 'Advertisement in the Book "Careers After +2"',
    options: BOOK_AD_PLUS2_OPTIONS,
  },
  {
    key: "smsMailerCampaign",
    label: "SMS and Mailer campaign to all event participants",
  },
  {
    key: "panelDiscussion",
    label: "Representation in Panel discussion / Seminar session (shared)",
    options: PANEL_DURATION_OPTIONS,
  },
  {
    key: "logoB2C",
    label: "Logo presence in all B2C Communication",
  },
  {
    key: "accessPreRegSelectedPanel",
    label:
      "Access to pre-registered students for selected Panel Discussion / Seminar Session",
  },
  {
    key: "eventSouvenirAd",
    label: "Advertisement in event souvenir",
  },
  {
    key: "stallLogoPositioning",
    label: "Stall & Logo Positioning",
    options: STALL_LOGO_POSITIONING_OPTIONS,
  },
  {
    key: "bookAdPremiumSpot",
    label: "Advertisement in the Book (Premium Spot)",
    options: BOOK_PREMIUM_SPOT_OPTIONS,
  },
  {
    key: "brochureWelcomeKit",
    label: "Inclusion on brochure / communication collateral in the welcome kit",
  },
  {
    key: "additionalStandee",
    label: "Additional standee and branding options at the venue",
  },
  {
    key: "accessPreRegisteredStudents",
    label: "Access to pre-registered students",
    options: PRE_REG_ACCESS_OPTIONS,
  },
  {
    key: "brandVideos",
    label: "Brand video's to play at the venue and auditorium",
  },
  {
    key: "dedicatedActivityRoom",
    label: "Dedicated activity room / additional space for experience zone",
  },
  {
    key: "celebrityStageShare",
    label: "Opportunity to share the stage with the celebrity",
  },
];

type TierPreset = Partial<
  Record<PartnerDeliverableKey, { included: true; option?: string }>
>;

const STALL: TierPreset = {
  stallSize: { included: true, option: "6 (3x2)" },
  weblink: { included: true },
  commonBranding: { included: true },
};

const EDUCATION: TierPreset = {
  ...STALL,
  fullPageWriteup: { included: true },
  bookAdCareersAfterPlus2: { included: true, option: "half page" },
};

const SILVER: TierPreset = {
  ...EDUCATION,
  bookAdCareersAfterPlus2: { included: true, option: "full page" },
  smsMailerCampaign: { included: true },
  panelDiscussion: { included: true, option: "45 mins" },
  logoB2C: { included: true },
  accessPreRegSelectedPanel: { included: true },
};

const GOLD: TierPreset = {
  ...SILVER,
  stallSize: { included: true, option: "8 (4x2)" },
  panelDiscussion: { included: true, option: "60 mins" },
  eventSouvenirAd: { included: true },
};

const UNIVERSITY: TierPreset = {
  ...GOLD,
  stallSize: { included: true, option: "12 (4x3)" },
  stallLogoPositioning: { included: true, option: "premium" },
  bookAdPremiumSpot: { included: true, option: "premium" },
  brochureWelcomeKit: { included: true },
  additionalStandee: { included: true },
  accessPreRegisteredStudents: {
    included: true,
    option: "selected seminar session",
  },
};

const CO_PRESENTING: TierPreset = {
  ...UNIVERSITY,
  stallSize: { included: true, option: "20 (5x4)" },
  stallLogoPositioning: { included: true, option: "super premium" },
  bookAdPremiumSpot: { included: true, option: "front cover inside" },
  brandVideos: { included: true },
};

const PRESENTING: TierPreset = {
  ...CO_PRESENTING,
  stallSize: { included: true, option: "24 (6x4)" },
  stallLogoPositioning: { included: true, option: "ultra premium" },
  bookAdPremiumSpot: { included: true, option: "back cover page" },
  accessPreRegisteredStudents: { included: true, option: "full access" },
  dedicatedActivityRoom: { included: true },
  celebrityStageShare: { included: true },
};

const TIER_PRESETS: Record<SponsorshipTier, TierPreset> = {
  "Stall Partner": STALL,
  "Education Partner": EDUCATION,
  "Knowledge Partner (Silver)": SILVER,
  "Knowledge Partner (Gold)": GOLD,
  "University Partner": UNIVERSITY,
  "Co-Presenting Partner": CO_PRESENTING,
  "Presenting Partner": PRESENTING,
};

/** Build the standard checklist for a tier. Custom items are never included here. */
export function buildDeliverablesForTier(
  tier: SponsorshipTier,
  idFactory: () => string
): PartnerDeliverable[] {
  const preset = TIER_PRESETS[tier];
  return PARTNER_DELIVERABLE_DEFINITIONS.map((def) => {
    const match = preset[def.key];
    return {
      id: idFactory(),
      key: def.key,
      label: def.label,
      included: Boolean(match?.included),
      option: match?.option,
      isCustom: false,
    };
  });
}

/** Merge tier defaults with any partner-specific custom deliverables. */
export function applyTierDefaultsPreservingCustom(
  tier: SponsorshipTier,
  existing: PartnerDeliverable[] | undefined,
  idFactory: () => string
): PartnerDeliverable[] {
  const customs = (existing ?? []).filter((d) => d.isCustom);
  return [...buildDeliverablesForTier(tier, idFactory), ...customs];
}
