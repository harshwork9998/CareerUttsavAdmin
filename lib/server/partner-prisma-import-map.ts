import { Prisma } from "@/lib/generated/prisma/client";
import type {
  Partner,
  PartnerEventPartnership,
  PartnerSeminarSlotAssignment,
  Spoc,
} from "@/types";

export type JsonSpocSource = {
  id: string;
  name: string;
  organization?: string;
  phone: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

export type MappedSpoc = Prisma.SpocCreateManyInput;

export type MappedPartner = Prisma.PartnerCreateManyInput;
export type MappedPartnerEventLink = Prisma.PartnerEventLinkCreateManyInput;
export type MappedPartnerEventPartnership =
  Prisma.PartnerEventPartnershipCreateManyInput;
export type MappedPartnerSeminarSlotAssignment =
  Prisma.PartnerSeminarSlotAssignmentCreateManyInput;

export type PartnerImportPlan = {
  spocs: MappedSpoc[];
  partners: MappedPartner[];
  eventLinks: MappedPartnerEventLink[];
  eventPartnerships: MappedPartnerEventPartnership[];
  seminarSlotAssignments: MappedPartnerSeminarSlotAssignment[];
  warnings: string[];
};

export type PartnerImportValidation = {
  ok: true;
} | {
  ok: false;
  errors: string[];
};

const SPOC_ORGANIZATION_FALLBACK = "—";

export function normalizeEmail(value: string | undefined | null): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function normalizePortalLogin(value: string | undefined | null): string | null {
  return normalizeEmail(value);
}

export function resolveSpocOrganization(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : SPOC_ORGANIZATION_FALLBACK;
}

export function parseRequiredDate(value: string, fieldName: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${fieldName}: ${value}`);
  }
  return date;
}

export function parseOptionalDate(
  value: string | undefined
): Date | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid optional date: ${value}`);
  }
  return date;
}

export function parseOptionalDecimal(
  value: number | undefined
): Prisma.Decimal | null {
  if (value === undefined || value === null || Number.isNaN(value)) return null;
  return new Prisma.Decimal(value);
}

export function partnershipId(partnerId: string, eventId: string): string {
  return `pep-${partnerId}-${eventId}`;
}

export function seminarAssignmentId(
  partnerId: string,
  seminarId: string
): string {
  return `pssa-${partnerId}-${seminarId}`;
}

export function mapSpocSourceToPrisma(spoc: JsonSpocSource): MappedSpoc {
  const emailNormalized = normalizeEmail(spoc.email);
  if (!emailNormalized) {
    throw new Error(`SPOC ${spoc.id} is missing a valid email`);
  }

  return {
    id: spoc.id,
    name: spoc.name.trim(),
    organization: resolveSpocOrganization(spoc.organization),
    phone: spoc.phone.trim(),
    email: spoc.email.trim(),
    emailNormalized,
    createdAt: parseRequiredDate(spoc.createdAt, "spoc.createdAt"),
    updatedAt: parseRequiredDate(spoc.updatedAt, "spoc.updatedAt"),
  };
}

function toJsonValue<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

function jsonValue<T>(value: T | undefined): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined) return Prisma.JsonNull;
  return toJsonValue(value);
}

function resolvePartnershipsForImport(partner: Partner): PartnerEventPartnership[] {
  if (partner.eventPartnerships?.length) {
    return partner.eventPartnerships;
  }

  if (!partner.eventIds.length) return [];

  const slotCountByEvent = new Map<string, number>();
  for (const assignment of partner.seminarSlotAssignments ?? []) {
    slotCountByEvent.set(
      assignment.eventId,
      (slotCountByEvent.get(assignment.eventId) ?? 0) + assignment.slots
    );
  }

  return partner.eventIds.map((eventId) => ({
    eventId,
    sponsorshipTier: partner.sponsorshipTier,
    deliverables: partner.deliverables ?? [],
    seminarSlotCount: slotCountByEvent.get(eventId) ?? 0,
  }));
}

export function mapPartnerSourceToPrisma(partner: Partner): MappedPartner {
  const owner = partner.relationshipOwner ?? {
    organization: "",
    managerName: "",
    managerPhone: "",
    managerEmail: "",
  };

  return {
    id: partner.id,
    name: partner.name.trim(),
    city: partner.city?.trim() ?? "",
    state: partner.state?.trim() ?? "",
    stage: partner.stage,
    primaryContact: toJsonValue(partner.primaryContact),
    secondaryContact: toJsonValue(partner.secondaryContact),
    relationshipOrganization: owner.organization?.trim() ?? "",
    relationshipManagerName: owner.managerName?.trim() ?? "",
    relationshipManagerPhone: owner.managerPhone?.trim() ?? "",
    relationshipManagerEmail: owner.managerEmail?.trim() ?? "",
    relationshipSpocId: owner.spocId ?? null,
    stageRemarks: jsonValue(partner.stageRemarks ?? []),
    meetings: jsonValue(partner.meetings ?? []),
    contactedAt: partner.contactedAt ?? null,
    contactedNotes: partner.contactedNotes ?? null,
    meetingAt: partner.meetingAt ?? null,
    meetingNotes: partner.meetingNotes ?? null,
    notProceedingAt: partner.notProceedingAt ?? null,
    notProceedingReason: partner.notProceedingReason ?? null,
    sponsorshipTier: partner.sponsorshipTier ?? null,
    sponsorshipNotes: partner.sponsorshipNotes ?? null,
    legacyDeliverables:
      partner.deliverables && partner.deliverables.length > 0
        ? toJsonValue(partner.deliverables)
        : Prisma.JsonNull,
    deliverablesConfirmedAt: parseOptionalDate(partner.deliverablesConfirmedAt),
    seminarSlotsConfirmedAt: parseOptionalDate(partner.seminarSlotsConfirmedAt),
    totalAmount: parseOptionalDecimal(partner.totalAmount),
    discountAmount: parseOptionalDecimal(partner.discountAmount),
    netAmount: parseOptionalDecimal(partner.netAmount),
    commercialsConfirmedAt: parseOptionalDate(partner.commercialsConfirmedAt),
    portalLogin: partner.portalLogin?.trim() || null,
    portalLoginNormalized: normalizePortalLogin(partner.portalLogin),
    portalInviteEmail: partner.portalInviteEmail?.trim() || null,
    portalInviteEmailNormalized: normalizeEmail(partner.portalInviteEmail),
    portalPasswordHash: partner.portalPasswordHash ?? null,
    portalAuthVersion: partner.portalAuthVersion ?? 0,
    portalPasswordChangedAt: parseOptionalDate(partner.portalPasswordChangedAt),
    portalPasswordPromptSkippedAt: parseOptionalDate(
      (partner as Partner & { portalPasswordPromptSkippedAt?: string })
        .portalPasswordPromptSkippedAt
    ),
    portalInviteSentAt: parseOptionalDate(partner.portalInviteSentAt),
    portalDocuments:
      partner.portalDocuments && partner.portalDocuments.length > 0
        ? toJsonValue(partner.portalDocuments)
        : Prisma.JsonNull,
    portalFasciaName: partner.portalFasciaName ?? null,
    portalWebsiteUrl: partner.portalWebsiteUrl ?? null,
    portalSmsContent: partner.portalSmsContent ?? null,
    portalSeminarSpeakers:
      partner.portalSeminarSpeakers && partner.portalSeminarSpeakers.length > 0
        ? toJsonValue(partner.portalSeminarSpeakers)
        : Prisma.JsonNull,
    portalRepresentatives:
      partner.portalRepresentatives && partner.portalRepresentatives.length > 0
        ? toJsonValue(partner.portalRepresentatives)
        : Prisma.JsonNull,
    createdAt: parseRequiredDate(partner.createdAt, "partner.createdAt"),
    updatedAt: parseRequiredDate(partner.updatedAt, "partner.updatedAt"),
  };
}

export function mapPartnerEventLinks(partner: Partner): MappedPartnerEventLink[] {
  const uniqueEventIds = [...new Set(partner.eventIds ?? [])];
  return uniqueEventIds.map((eventId) => ({
    partnerId: partner.id,
    eventId,
  }));
}

export function mapPartnerEventPartnerships(
  partner: Partner
): MappedPartnerEventPartnership[] {
  return resolvePartnershipsForImport(partner).map((partnership) => ({
    id: partnershipId(partner.id, partnership.eventId),
    partnerId: partner.id,
    eventId: partnership.eventId,
    sponsorshipTier: partnership.sponsorshipTier ?? null,
    customTierLabel: partnership.customTierLabel ?? null,
    deliverables: toJsonValue(partnership.deliverables ?? []),
    seminarSlotCount: partnership.seminarSlotCount ?? 0,
  }));
}

export function mapPartnerSeminarSlotAssignments(
  partner: Partner
): MappedPartnerSeminarSlotAssignment[] {
  const assignments = partner.seminarSlotAssignments ?? [];
  return assignments.map((assignment: PartnerSeminarSlotAssignment) => ({
    id: seminarAssignmentId(partner.id, assignment.seminarId),
    partnershipId: partnershipId(partner.id, assignment.eventId),
    seminarId: assignment.seminarId,
    slots: assignment.slots,
    seminarTitle: assignment.seminarTitle ?? null,
  }));
}

export type PortalLoginAlias = {
  partnerId: string;
  field: "portalLogin" | "portalInviteEmail";
  normalized: string;
};

export function collectPortalLoginAliases(partners: Partner[]): PortalLoginAlias[] {
  const aliases: PortalLoginAlias[] = [];

  for (const partner of partners) {
    const login = normalizePortalLogin(partner.portalLogin);
    if (login) {
      aliases.push({
        partnerId: partner.id,
        field: "portalLogin",
        normalized: login,
      });
    }
    const invite = normalizeEmail(partner.portalInviteEmail);
    if (invite) {
      aliases.push({
        partnerId: partner.id,
        field: "portalInviteEmail",
        normalized: invite,
      });
    }
  }

  return aliases;
}

/**
 * Detect normalized portal login collisions across portalLogin and portalInviteEmail.
 * Matches current auth behavior where either field can authenticate a partner.
 */
export function detectPortalLoginCollisions(
  partners: Partner[]
): string[] {
  const errors: string[] = [];
  const owners = new Map<string, PortalLoginAlias[]>();

  for (const alias of collectPortalLoginAliases(partners)) {
    const bucket = owners.get(alias.normalized) ?? [];
    bucket.push(alias);
    owners.set(alias.normalized, bucket);
  }

  for (const [normalized, bucket] of owners.entries()) {
    const uniquePartnerIds = new Set(bucket.map((entry) => entry.partnerId));
    if (uniquePartnerIds.size > 1) {
      errors.push(
        `Portal login collision for "${normalized}" across partners: ${[...uniquePartnerIds].join(", ")}`
      );
    }
  }

  return errors;
}

export function validateSpocSources(spocs: JsonSpocSource[]): PartnerImportValidation {
  const errors: string[] = [];
  const ids = new Set<string>();
  const emails = new Set<string>();

  for (const spoc of spocs) {
    if (ids.has(spoc.id)) {
      errors.push(`Duplicate SPOC id: ${spoc.id}`);
    }
    ids.add(spoc.id);

    const email = normalizeEmail(spoc.email);
    if (!email) {
      errors.push(`SPOC ${spoc.id} has invalid email`);
    } else if (emails.has(email)) {
      errors.push(`Duplicate SPOC normalized email: ${email}`);
    } else if (email) {
      emails.add(email);
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export function validatePartnerSources(input: {
  spocs: JsonSpocSource[];
  partners: Partner[];
  knownEventIds: Set<string>;
  knownSeminarIds: Set<string>;
}): PartnerImportValidation {
  const errors: string[] = [];
  const spocValidation = validateSpocSources(input.spocs);
  if (!spocValidation.ok) {
    errors.push(...spocValidation.errors);
  }

  const spocIds = new Set(input.spocs.map((spoc) => spoc.id));
  const partnerIds = new Set<string>();

  for (const partner of input.partners) {
    if (partnerIds.has(partner.id)) {
      errors.push(`Duplicate partner id: ${partner.id}`);
    }
    partnerIds.add(partner.id);

    const spocId = partner.relationshipOwner?.spocId;
    if (spocId && !spocIds.has(spocId)) {
      errors.push(
        `Partner ${partner.id} references missing SPOC id ${spocId}`
      );
    }

    for (const eventId of partner.eventIds ?? []) {
      if (!input.knownEventIds.has(eventId)) {
        errors.push(`Partner ${partner.id} references missing event ${eventId}`);
      }
    }

    for (const partnership of resolvePartnershipsForImport(partner)) {
      if (!input.knownEventIds.has(partnership.eventId)) {
        errors.push(
          `Partner ${partner.id} partnership references missing event ${partnership.eventId}`
        );
      }
    }

    for (const assignment of partner.seminarSlotAssignments ?? []) {
      if (!input.knownEventIds.has(assignment.eventId)) {
        errors.push(
          `Partner ${partner.id} assignment references missing event ${assignment.eventId}`
        );
      }
      if (!input.knownSeminarIds.has(assignment.seminarId)) {
        errors.push(
          `Partner ${partner.id} assignment references missing seminar ${assignment.seminarId}`
        );
      }

      const hasPartnership = resolvePartnershipsForImport(partner).some(
        (partnership) => partnership.eventId === assignment.eventId
      );
      if (!hasPartnership) {
        errors.push(
          `Partner ${partner.id} assignment for event ${assignment.eventId} has no corresponding partnership row`
        );
      }
    }
  }

  errors.push(...detectPortalLoginCollisions(input.partners));

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export function buildPartnerImportPlan(input: {
  spocs: JsonSpocSource[];
  partners: Partner[];
}): PartnerImportPlan {
  const warnings: string[] = [];
  const spocs = input.spocs.map(mapSpocSourceToPrisma);
  const partners = input.partners.map(mapPartnerSourceToPrisma);
  const eventLinks = input.partners.flatMap(mapPartnerEventLinks);
  const eventPartnerships = input.partners.flatMap(mapPartnerEventPartnerships);
  const seminarSlotAssignments = input.partners.flatMap(
    mapPartnerSeminarSlotAssignments
  );

  for (const partner of input.partners) {
    if (!partner.eventPartnerships?.length && partner.eventIds.length > 0) {
      if (partner.sponsorshipTier || partner.deliverables?.length) {
        warnings.push(
          `Partner ${partner.id}: derived eventPartnerships from legacy flat fields`
        );
      }
    }
    if (
      partner.relationshipOwner?.managerEmail &&
      !partner.relationshipOwner.spocId
    ) {
      warnings.push(
        `Partner ${partner.id}: relationship owner has no relationshipSpocId (reconciliation item)`
      );
    }
  }

  return {
    spocs,
    partners,
    eventLinks,
    eventPartnerships,
    seminarSlotAssignments,
    warnings,
  };
}
