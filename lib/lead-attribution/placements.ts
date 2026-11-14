export type LeadAttributionPlacement = {
  /** Normalized uppercase tracking code (internal). */
  trackingCode: string;
  leadSource: string;
  leadSubSource: string;
  /** Exact WhatsApp inbound text for deterministic attribution (no fuzzy match). */
  whatsappIntroMessage: string;
  isActive: boolean;
};

const RAW_PLACEMENTS: LeadAttributionPlacement[] = [
  {
    trackingCode: "AUTO-IN26",
    leadSource: "Overhead Marketing",
    leadSubSource: "Auto (Inside)",
    whatsappIntroMessage:
      "Hi! I saw Career Uttsav advertised inside an auto and would like to register.",
    isActive: true,
  },
  {
    trackingCode: "AUTO-OUT26",
    leadSource: "Overhead Marketing",
    leadSubSource: "Auto (Outside)",
    whatsappIntroMessage:
      "Hi! I came across Career Uttsav on the outside of an auto and would like to register.",
    isActive: true,
  },
  {
    trackingCode: "CABS26",
    leadSource: "Overhead Marketing",
    leadSubSource: "Cabs",
    whatsappIntroMessage:
      "Hi! I came across Career Uttsav through a cab advertisement and would like to register.",
    isActive: true,
  },
];

export function normalizeLeadAttributionTrackingCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function assertConfiguration(placements: LeadAttributionPlacement[]): void {
  const codes = new Set<string>();
  const whatsappMessages = new Set<string>();
  for (const row of placements) {
    const code = normalizeLeadAttributionTrackingCode(row.trackingCode);
    if (!code) throw new Error("Lead attribution placement missing tracking code");
    if (codes.has(code)) {
      throw new Error(`Duplicate lead attribution tracking code: ${code}`);
    }
    codes.add(code);

    const intro = row.whatsappIntroMessage.trim();
    if (!intro) {
      throw new Error(`WhatsApp intro required for tracking code ${code}`);
    }
    if (whatsappMessages.has(intro)) {
      throw new Error(`Duplicate WhatsApp intro for tracking code ${code}`);
    }
    whatsappMessages.add(intro);
  }
}

assertConfiguration(RAW_PLACEMENTS);

export const LEAD_ATTRIBUTION_PLACEMENTS: readonly LeadAttributionPlacement[] =
  RAW_PLACEMENTS.map((row) => ({
    ...row,
    trackingCode: normalizeLeadAttributionTrackingCode(row.trackingCode),
  }));

export const DEFAULT_PUBLIC_TRACKING_ORIGIN = "https://careeruttsav.in";

export function publicTrackingSiteOrigin(): string {
  const fromEnv =
    process.env.MARKETING_TRACKING_SITE_URL?.trim() ||
    process.env.PUBLIC_SITE_ORIGIN?.trim()?.split(",")[0]?.trim() ||
    "";
  return (fromEnv || DEFAULT_PUBLIC_TRACKING_ORIGIN).replace(/\/$/, "");
}

export function buildLeadAttributionTrackingUrl(trackingCode: string): string {
  return `${publicTrackingSiteOrigin()}/?ref=${encodeURIComponent(trackingCode)}`;
}

export const WHATSAPP_REGISTRATION_PHONE_E164 = "919035150139";

export function buildWhatsAppClickToChatUrl(prefillMessage: string): string {
  return `https://api.whatsapp.com/send?phone=${WHATSAPP_REGISTRATION_PHONE_E164}&text=${encodeURIComponent(prefillMessage)}`;
}