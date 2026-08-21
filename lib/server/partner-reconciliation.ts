import type { Partner, PartnerEventPartnership, PartnerSeminarSlotAssignment } from "@/types";

import {
  mapPartnerSourceToPrisma,
  mapSpocSourceToPrisma,
  resolvePartnershipsForImport,
  type JsonSpocSource,
} from "@/lib/server/partner-prisma-import-map";
import {
  mapPrismaPartnerToApi,
  mapPrismaSpocToApi,
  type PrismaPartnerRecord,
  type PrismaSpocRecord,
} from "@/lib/server/partner-prisma-map";

export type PartnerReconciliationConflict = {
  code: string;
  entityId?: string;
  fields?: string[];
  message: string;
};

export type SpocReconciliationRow = {
  id: string;
  exactMatch: boolean;
  fieldMismatches: string[];
};

export type PartnerRelationalMismatch = {
  eventLinks: boolean;
  eventPartnerships: boolean;
  seminarSlotAssignments: boolean;
};

export type PartnerReconciliationRow = {
  id: string;
  exactMatch: boolean;
  fieldMismatches: string[];
  authMismatches: string[];
  relationalMismatches: PartnerRelationalMismatch;
};

export const PARTNER_AUTH_FIELDS = [
  "portalPasswordHash",
  "portalAuthVersion",
  "portalPasswordChangedAt",
  "portalPasswordPromptSkippedAt",
  "portalInviteSentAt",
] as const;

function normalizeDate(value: Date | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
}

function normalizeNullableOptional<T>(value: T | null | undefined): T | undefined {
  if (value === null || value === undefined) return undefined;
  return value;
}

function normalizeRequiredTimestamp(value: unknown): number | null {
  return normalizeDate(value as Date | string | null | undefined);
}

function normalizeOptionalTimestamp(value: unknown): number | undefined {
  const timestamp = normalizeRequiredTimestamp(value);
  return timestamp === null ? undefined : timestamp;
}

function normalizeAlwaysArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeOptionalCollection<T>(
  value: T[] | null | undefined
): T[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  return value;
}

function normalizeContact(
  contact: Partner["primaryContact"] | undefined
): Partner["primaryContact"] {
  return {
    name: contact?.name ?? "",
    designation: contact?.designation ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
  };
}

function normalizeRelationshipOwner(
  owner: Partner["relationshipOwner"] | undefined
): NonNullable<Partner["relationshipOwner"]> {
  return {
    organization: owner?.organization ?? "",
    spocId: owner?.spocId ?? undefined,
    managerName: owner?.managerName ?? "",
    managerPhone: owner?.managerPhone ?? "",
    managerEmail: owner?.managerEmail ?? "",
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

/**
 * Recursively canonicalize nested plain objects by sorting keys.
 * Array order is preserved because it may be meaningful in API payloads.
 */
export function deepCanonicalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (value instanceof Date) {
    return normalizeRequiredTimestamp(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepCanonicalizeValue(item));
  }
  if (isPlainObject(value)) {
    const canonical: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort((left, right) =>
      left.localeCompare(right)
    )) {
      canonical[key] = deepCanonicalizeValue(value[key]);
    }
    return canonical;
  }
  return value;
}

export function deepCanonicalizeStableJson(value: unknown): string {
  return JSON.stringify(deepCanonicalizeValue(value));
}

function deepCanonicalValuesEqual(left: unknown, right: unknown): boolean {
  return deepCanonicalizeStableJson(left) === deepCanonicalizeStableJson(right);
}

export function jsonPartnerToExpectedApiShape(partner: Partner): Partner {
  const partnerships = resolvePartnershipsForImport(partner);
  const eventIds = [...new Set(partner.eventIds ?? [])].sort((left, right) =>
    left.localeCompare(right)
  );

  const shape: Partner = {
    id: partner.id,
    name: partner.name,
    city: partner.city,
    state: partner.state,
    primaryContact: partner.primaryContact,
    secondaryContact: partner.secondaryContact,
    eventIds,
    relationshipOwner: {
      organization: partner.relationshipOwner?.organization ?? "",
      spocId: partner.relationshipOwner?.spocId,
      managerName: partner.relationshipOwner?.managerName ?? "",
      managerPhone: partner.relationshipOwner?.managerPhone ?? "",
      managerEmail: partner.relationshipOwner?.managerEmail ?? "",
    },
    stage: partner.stage,
    stageRemarks: partner.stageRemarks ?? [],
    sponsorshipTier: partner.sponsorshipTier,
    sponsorshipNotes: partner.sponsorshipNotes,
    eventPartnerships:
      partnerships.length > 0 ? partnerships : undefined,
    deliverables: partner.deliverables?.length ? partner.deliverables : undefined,
    deliverablesConfirmedAt: partner.deliverablesConfirmedAt,
    seminarSlotAssignments: partner.seminarSlotAssignments?.length
      ? partner.seminarSlotAssignments
      : undefined,
    seminarSlotsConfirmedAt: partner.seminarSlotsConfirmedAt,
    totalAmount: partner.totalAmount,
    discountAmount: partner.discountAmount,
    netAmount: partner.netAmount,
    commercialsConfirmedAt: partner.commercialsConfirmedAt,
    portalLogin: partner.portalLogin,
    portalPasswordHash: partner.portalPasswordHash,
    portalInviteEmail: partner.portalInviteEmail,
    portalInviteSentAt: partner.portalInviteSentAt,
    portalDocuments: partner.portalDocuments,
    portalFasciaName: partner.portalFasciaName,
    portalWebsiteUrl: partner.portalWebsiteUrl,
    portalSmsContent: partner.portalSmsContent,
    portalSeminarSpeakers: partner.portalSeminarSpeakers,
    portalRepresentatives: partner.portalRepresentatives,
    portalPasswordChangedAt: partner.portalPasswordChangedAt,
    portalAuthVersion: partner.portalAuthVersion,
    contactedAt: partner.contactedAt,
    contactedNotes: partner.contactedNotes,
    meetingAt: partner.meetingAt,
    meetingNotes: partner.meetingNotes,
    meetings: partner.meetings ?? [],
    notProceedingAt: partner.notProceedingAt,
    notProceedingReason: partner.notProceedingReason,
    createdAt: partner.createdAt,
    updatedAt: partner.updatedAt,
  };

  const skippedAt = (
    partner as Partner & { portalPasswordPromptSkippedAt?: string }
  ).portalPasswordPromptSkippedAt;
  if (skippedAt) {
    (
      shape as Partner & { portalPasswordPromptSkippedAt?: string }
    ).portalPasswordPromptSkippedAt = skippedAt;
  }

  return shape;
}

function normalizePartnerships(
  partnerships: PartnerEventPartnership[] | undefined
): PartnerEventPartnership[] {
  return (partnerships ?? []).map((partnership) => ({
    eventId: partnership.eventId,
    sponsorshipTier: partnership.sponsorshipTier,
    customTierLabel: partnership.customTierLabel,
    deliverables: partnership.deliverables ?? [],
    seminarSlotCount: partnership.seminarSlotCount ?? 0,
  }));
}

function normalizeSeminarAssignments(
  assignments: PartnerSeminarSlotAssignment[] | undefined
): PartnerSeminarSlotAssignment[] {
  return (assignments ?? []).map((assignment) => ({
    eventId: assignment.eventId,
    seminarId: assignment.seminarId,
    slots: assignment.slots,
    seminarTitle: assignment.seminarTitle,
  }));
}

function normalizeRelationalPartnerships(
  partnerships: PartnerEventPartnership[]
): Record<string, unknown>[] {
  return normalizePartnerships(partnerships).map((partnership) => ({
    eventId: partnership.eventId,
    sponsorshipTier: partnership.sponsorshipTier ?? null,
    customTierLabel: partnership.customTierLabel ?? null,
    seminarSlotCount: partnership.seminarSlotCount ?? 0,
    deliverables: partnership.deliverables ?? [],
  }));
}

function normalizeRelationalAssignments(
  assignments: PartnerSeminarSlotAssignment[] | undefined
): Record<string, unknown>[] {
  return normalizeSeminarAssignments(assignments).map((assignment) => ({
    eventId: assignment.eventId,
    seminarId: assignment.seminarId,
    slots: assignment.slots,
    seminarTitle: assignment.seminarTitle ?? null,
  }));
}

export function canonicalizePartnerForComparison(
  partner: Partner
): Record<string, unknown> {
  const eventIds = [...(partner.eventIds ?? [])].sort((left, right) =>
    left.localeCompare(right)
  );
  const eventPartnerships = normalizePartnerships(partner.eventPartnerships);
  const seminarSlotAssignments = normalizeSeminarAssignments(
    partner.seminarSlotAssignments
  );

  return {
    name: partner.name,
    city: partner.city ?? "",
    state: partner.state ?? "",
    stage: partner.stage,
    primaryContact: deepCanonicalizeValue(normalizeContact(partner.primaryContact)),
    secondaryContact: deepCanonicalizeValue(
      normalizeContact(partner.secondaryContact)
    ),
    relationshipOwner: deepCanonicalizeValue(
      normalizeRelationshipOwner(partner.relationshipOwner)
    ),
    stageRemarks: deepCanonicalizeValue(normalizeAlwaysArray(partner.stageRemarks)),
    sponsorshipTier: normalizeNullableOptional(partner.sponsorshipTier),
    sponsorshipNotes: normalizeNullableOptional(partner.sponsorshipNotes),
    deliverables: deepCanonicalizeValue(
      normalizeOptionalCollection(partner.deliverables)
    ),
    deliverablesConfirmedAt: normalizeOptionalTimestamp(
      partner.deliverablesConfirmedAt
    ),
    seminarSlotsConfirmedAt: normalizeOptionalTimestamp(
      partner.seminarSlotsConfirmedAt
    ),
    totalAmount: normalizeNullableOptional(partner.totalAmount),
    discountAmount: normalizeNullableOptional(partner.discountAmount),
    netAmount: normalizeNullableOptional(partner.netAmount),
    commercialsConfirmedAt: normalizeOptionalTimestamp(
      partner.commercialsConfirmedAt
    ),
    portalLogin: normalizeNullableOptional(partner.portalLogin),
    portalInviteEmail: normalizeNullableOptional(partner.portalInviteEmail),
    portalDocuments: deepCanonicalizeValue(
      normalizeOptionalCollection(partner.portalDocuments)
    ),
    portalFasciaName: normalizeNullableOptional(partner.portalFasciaName),
    portalWebsiteUrl: normalizeNullableOptional(partner.portalWebsiteUrl),
    portalSmsContent: normalizeNullableOptional(partner.portalSmsContent),
    portalSeminarSpeakers: deepCanonicalizeValue(
      normalizeOptionalCollection(partner.portalSeminarSpeakers)
    ),
    portalRepresentatives: deepCanonicalizeValue(
      normalizeOptionalCollection(partner.portalRepresentatives)
    ),
    contactedAt: normalizeNullableOptional(partner.contactedAt),
    contactedNotes: normalizeNullableOptional(partner.contactedNotes),
    meetingAt: normalizeNullableOptional(partner.meetingAt),
    meetingNotes: normalizeNullableOptional(partner.meetingNotes),
    meetings: deepCanonicalizeValue(normalizeAlwaysArray(partner.meetings)),
    notProceedingAt: normalizeNullableOptional(partner.notProceedingAt),
    notProceedingReason: normalizeNullableOptional(partner.notProceedingReason),
    createdAt: normalizeRequiredTimestamp(partner.createdAt),
    updatedAt: normalizeRequiredTimestamp(partner.updatedAt),
    eventIds,
    eventPartnerships: deepCanonicalizeValue(
      eventPartnerships.length > 0 ? eventPartnerships : undefined
    ),
    seminarSlotAssignments: deepCanonicalizeValue(
      seminarSlotAssignments.length > 0 ? seminarSlotAssignments : undefined
    ),
  };
}

export function normalizePartnerForComparison(partner: Partner): Partner {
  const normalized = jsonPartnerToExpectedApiShape(partner);
  return {
    ...normalized,
    eventIds: [...(normalized.eventIds ?? [])].sort((left, right) =>
      left.localeCompare(right)
    ),
    eventPartnerships:
      normalizePartnerships(normalized.eventPartnerships).length > 0
        ? normalizePartnerships(normalized.eventPartnerships)
        : undefined,
    seminarSlotAssignments:
      normalizeSeminarAssignments(normalized.seminarSlotAssignments).length > 0
        ? normalizeSeminarAssignments(normalized.seminarSlotAssignments)
        : undefined,
  };
}

export function comparePartnerAuthFields(
  jsonPartner: Partner,
  dbRecord: PrismaPartnerRecord
): string[] {
  const mapped = mapPartnerSourceToPrisma(jsonPartner);
  const mismatches: string[] = [];

  if (mapped.portalPasswordHash !== dbRecord.portalPasswordHash) {
    mismatches.push("portalPasswordHash");
  }
  if (mapped.portalAuthVersion !== dbRecord.portalAuthVersion) {
    mismatches.push("portalAuthVersion");
  }
  if (
    normalizeDate(mapped.portalPasswordChangedAt) !==
    normalizeDate(dbRecord.portalPasswordChangedAt)
  ) {
    mismatches.push("portalPasswordChangedAt");
  }
  if (
    normalizeDate(mapped.portalPasswordPromptSkippedAt) !==
    normalizeDate(dbRecord.portalPasswordPromptSkippedAt)
  ) {
    mismatches.push("portalPasswordPromptSkippedAt");
  }
  if (
    normalizeDate(mapped.portalInviteSentAt) !==
    normalizeDate(dbRecord.portalInviteSentAt)
  ) {
    mismatches.push("portalInviteSentAt");
  }

  return mismatches;
}

export function comparePartnerScalarFields(
  expected: Partner,
  actual: Partner
): string[] {
  const expectedCanonical = canonicalizePartnerForComparison(expected);
  const actualCanonical = canonicalizePartnerForComparison(actual);
  const mismatches: string[] = [];

  for (const field of Object.keys(expectedCanonical)) {
    if (
      !deepCanonicalValuesEqual(
        expectedCanonical[field],
        actualCanonical[field]
      )
    ) {
      mismatches.push(field);
    }
  }

  return mismatches;
}

export function comparePartnerRelationalState(
  jsonPartner: Partner,
  dbRecord: PrismaPartnerRecord
): PartnerRelationalMismatch {
  const expectedLinks = [...new Set(jsonPartner.eventIds ?? [])]
    .sort((left, right) => left.localeCompare(right))
    .map((eventId) => `${jsonPartner.id}:${eventId}`);
  const actualLinks = dbRecord.eventLinks
    .map((link) => `${link.partnerId}:${link.eventId}`)
    .sort((left, right) => left.localeCompare(right));

  const expectedPartnerships = normalizeRelationalPartnerships(
    resolvePartnershipsForImport(jsonPartner)
  );
  const actualPartnerships = dbRecord.eventPartnerships.map((partnership) => ({
    eventId: partnership.eventId,
    sponsorshipTier: partnership.sponsorshipTier,
    customTierLabel: partnership.customTierLabel,
    seminarSlotCount: partnership.seminarSlotCount,
    deliverables: Array.isArray(partnership.deliverables)
      ? partnership.deliverables
      : [],
  }));

  const expectedAssignments = normalizeRelationalAssignments(
    jsonPartner.seminarSlotAssignments
  );
  const actualAssignments = dbRecord.eventPartnerships.flatMap((partnership) =>
    partnership.seminarSlotAssignments.map((assignment) => ({
      eventId: partnership.eventId,
      seminarId: assignment.seminarId,
      slots: assignment.slots,
      seminarTitle: assignment.seminarTitle,
    }))
  );

  return {
    eventLinks: !deepCanonicalValuesEqual(expectedLinks, actualLinks),
    eventPartnerships: !deepCanonicalValuesEqual(
      expectedPartnerships,
      actualPartnerships
    ),
    seminarSlotAssignments: !deepCanonicalValuesEqual(
      expectedAssignments,
      actualAssignments
    ),
  };
}

export function compareExistingPartner(
  jsonPartner: Partner,
  dbRecord: PrismaPartnerRecord
): {
  fieldMismatches: string[];
  authMismatches: string[];
  relationalMismatches: PartnerRelationalMismatch;
} {
  const expectedApi = jsonPartnerToExpectedApiShape(jsonPartner);
  const actualApi = mapPrismaPartnerToApi(dbRecord);

  return {
    fieldMismatches: comparePartnerScalarFields(expectedApi, actualApi),
    authMismatches: comparePartnerAuthFields(jsonPartner, dbRecord),
    relationalMismatches: comparePartnerRelationalState(jsonPartner, dbRecord),
  };
}

export function compareExistingSpoc(
  jsonSpoc: JsonSpocSource,
  dbRecord: PrismaSpocRecord
): string[] {
  const expected = mapSpocSourceToPrisma(jsonSpoc);
  const actual = mapPrismaSpocToApi(dbRecord);
  const mismatches: string[] = [];

  if (expected.name !== actual.name) mismatches.push("name");
  if (expected.organization !== actual.organization) mismatches.push("organization");
  if (expected.phone !== actual.phone) mismatches.push("phone");
  if (expected.email !== actual.email) mismatches.push("email");
  if (normalizeDate(expected.createdAt) !== normalizeDate(actual.createdAt)) {
    mismatches.push("createdAt");
  }
  if (normalizeDate(expected.updatedAt) !== normalizeDate(actual.updatedAt)) {
    mismatches.push("updatedAt");
  }

  return mismatches;
}

export function partnerRowIsExactMatch(row: PartnerReconciliationRow): boolean {
  return (
    row.fieldMismatches.length === 0 &&
    row.authMismatches.length === 0 &&
    !row.relationalMismatches.eventLinks &&
    !row.relationalMismatches.eventPartnerships &&
    !row.relationalMismatches.seminarSlotAssignments
  );
}

export function countRelationalMismatches(
  rows: PartnerReconciliationRow[]
): number {
  return rows.filter(
    (row) =>
      row.relationalMismatches.eventLinks ||
      row.relationalMismatches.eventPartnerships ||
      row.relationalMismatches.seminarSlotAssignments
  ).length;
}

export function countAuthMismatches(rows: PartnerReconciliationRow[]): number {
  return rows.filter((row) => row.authMismatches.length > 0).length;
}
