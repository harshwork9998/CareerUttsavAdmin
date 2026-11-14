import {
  LEAD_ATTRIBUTION_PLACEMENTS,
  normalizeLeadAttributionTrackingCode,
  type LeadAttributionPlacement,
} from "@/lib/lead-attribution/placements";
import type { LeadAttributionSnapshot } from "@/lib/lead-attribution/snapshot";

export type { LeadAttributionSnapshot } from "@/lib/lead-attribution/snapshot";

function byCode(): Map<string, LeadAttributionPlacement> {
  const map = new Map<string, LeadAttributionPlacement>();
  for (const row of LEAD_ATTRIBUTION_PLACEMENTS) {
    map.set(row.trackingCode, row);
  }
  return map;
}

const PLACEMENT_BY_CODE = byCode();

const INTRO_MESSAGE_INDEX = new Map<string, LeadAttributionPlacement>(
  LEAD_ATTRIBUTION_PLACEMENTS.map((row) => [row.whatsappIntroMessage, row])
);

export function resolveActiveLeadAttribution(
  trackingCode: string | null | undefined
): LeadAttributionSnapshot | null {
  if (!trackingCode?.trim()) return null;
  const key = normalizeLeadAttributionTrackingCode(trackingCode);
  const placement = PLACEMENT_BY_CODE.get(key);
  if (!placement?.isActive) return null;
  return {
    trackingCode: placement.trackingCode,
    leadSource: placement.leadSource,
    leadSubSource: placement.leadSubSource,
  };
}

/** Exact match only — no fuzzy or partial matching. */
export function matchLeadAttributionWhatsAppIntro(
  text: string | null | undefined
): LeadAttributionSnapshot | null {
  if (!text) return null;
  const placement = INTRO_MESSAGE_INDEX.get(text.trim());
  if (!placement?.isActive) return null;
  return {
    trackingCode: placement.trackingCode,
    leadSource: placement.leadSource,
    leadSubSource: placement.leadSubSource,
  };
}

export function leadAttributionPlacementForCode(
  trackingCode: string
): LeadAttributionPlacement | null {
  return PLACEMENT_BY_CODE.get(normalizeLeadAttributionTrackingCode(trackingCode)) ?? null;
}

export function listActiveLeadAttributionPublicPlacements() {
  return LEAD_ATTRIBUTION_PLACEMENTS.filter((row) => row.isActive).map((row) => ({
    trackingCode: row.trackingCode,
    leadSource: row.leadSource,
    leadSubSource: row.leadSubSource,
    trackingUrl: undefined as string | undefined,
    whatsappPrefill: row.whatsappIntroMessage,
  }));
}