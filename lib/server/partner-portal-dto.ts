import { partnerHasPortalPassword } from "@/lib/partner-credentials";
import type { Partner } from "@/types";

/**
 * Slim partner record for Partner Portal server sync.
 * Includes package/portal fields consumed by CareerUttsavPartner — not Admin CRM/commercials.
 */
export type PartnerPortalPartnerDto = {
  id: string;
  name: string;
  city: string;
  state: string;
  eventIds: string[];
  stage: Partner["stage"];
  sponsorshipTier?: Partner["sponsorshipTier"];
  eventPartnerships?: Partner["eventPartnerships"];
  deliverables?: Partner["deliverables"];
  seminarSlotAssignments?: Partner["seminarSlotAssignments"];
  portalLogin?: string;
  hasPortalPassword?: boolean;
  portalPasswordChangedAt?: string;
  portalPasswordPromptSkippedAt?: string;
  portalAuthVersion?: number;
  portalInviteEmail?: string;
  portalInviteSentAt?: string;
  portalDocuments?: Partner["portalDocuments"];
  portalFasciaName?: string;
  portalWebsiteUrl?: string;
  portalSmsContent?: string;
  portalSeminarSpeakers?: Partner["portalSeminarSpeakers"];
  portalRepresentatives?: Partner["portalRepresentatives"];
};

export function isPartnerPortalActivated(partner: Partner): boolean {
  return Boolean(
    partner.portalInviteSentAt ||
      (partner.portalLogin && partnerHasPortalPassword(partner))
  );
}

export function toPartnerPortalPartnerDto(
  partner: Partner
): PartnerPortalPartnerDto {
  const skippedAt = (
    partner as Partner & { portalPasswordPromptSkippedAt?: string }
  ).portalPasswordPromptSkippedAt;

  return {
    id: partner.id,
    name: partner.name,
    city: partner.city,
    state: partner.state,
    eventIds: partner.eventIds ?? [],
    stage: partner.stage,
    sponsorshipTier: partner.sponsorshipTier,
    eventPartnerships: partner.eventPartnerships,
    deliverables: partner.deliverables,
    seminarSlotAssignments: partner.seminarSlotAssignments,
    portalLogin: partner.portalLogin,
    hasPortalPassword: partnerHasPortalPassword(partner),
    portalPasswordChangedAt: partner.portalPasswordChangedAt,
    portalPasswordPromptSkippedAt: skippedAt,
    portalAuthVersion: partner.portalAuthVersion,
    portalInviteEmail: partner.portalInviteEmail,
    portalInviteSentAt: partner.portalInviteSentAt,
    portalDocuments: partner.portalDocuments,
    portalFasciaName: partner.portalFasciaName,
    portalWebsiteUrl: partner.portalWebsiteUrl,
    portalSmsContent: partner.portalSmsContent,
    portalSeminarSpeakers: partner.portalSeminarSpeakers,
    portalRepresentatives: partner.portalRepresentatives,
  };
}

export function listPartnerPortalPartnerDtos(
  partners: Partner[]
): PartnerPortalPartnerDto[] {
  return partners
    .filter(isPartnerPortalActivated)
    .map(toPartnerPortalPartnerDto);
}
