import { SPONSORSHIP_TIERS } from "@/constants";
import type { PartnerEventPartnership, SponsorshipTier } from "@/types";

/** Select value when the user picks a non-standard partnership tier. */
export const CUSTOM_TIER_OPTION = "__custom_tier__";

export function isStandardSponsorshipTier(
  value: string
): value is SponsorshipTier {
  return (SPONSORSHIP_TIERS as readonly string[]).includes(value);
}

export function isCustomPartnership(
  ep: Pick<PartnerEventPartnership, "sponsorshipTier" | "customTierLabel">
): boolean {
  return !ep.sponsorshipTier && ep.customTierLabel !== undefined;
}

export function getPartnershipTierLabel(
  ep: Pick<PartnerEventPartnership, "sponsorshipTier" | "customTierLabel">
): string | undefined {
  if (ep.sponsorshipTier) return ep.sponsorshipTier;
  const custom = ep.customTierLabel?.trim();
  return custom || undefined;
}

export function tierSelectValue(
  ep: Pick<PartnerEventPartnership, "sponsorshipTier" | "customTierLabel"> | undefined
): string {
  if (!ep) return "";
  if (isCustomPartnership(ep)) return CUSTOM_TIER_OPTION;
  return ep.sponsorshipTier ?? "";
}
