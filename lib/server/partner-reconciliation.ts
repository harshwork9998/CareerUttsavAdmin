import type { Partner, PartnerEventPartnership, PartnerSeminarSlotAssignment, Spoc } from "@/types";

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

const PARTNER_SCALAR_FIELDS = [
  "name",
  "city",
  "state",
  "stage",
  "primaryContact",
  "secondaryContact",
  "relationshipOwner",
  "stageRemarks",
  "sponsorshipTier",
  "sponsorshipNotes",
  "deliverables",
  "deliverablesConfirmedAt",
  "seminarSlotsConfirmedAt",
  "totalAmount",
  "discountAmount",
  "netAmount",
  "commercialsConfirmedAt",
  "portalLogin",
  "portalInviteEmail",
  "portalDocuments",
  "portalFasciaName",
  "portalWebsiteUrl",
  "portalSmsContent",
  "portalSeminarSpeakers",
  "portalRepresentatives",
  "contactedAt",
  "contactedNotes",
  "meetingAt",
  "meetingNotes",
  "meetings",
  "notProceedingAt",
  "notProceedingReason",
  "createdAt",
  "updatedAt",
] as const;

function normalizeDate(value: Date | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
}

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function sortByKey<T>(items: T[], key: (item: T) => string): T[] {
  return [...items].sort((left, right) => key(left).localeCompare(key(right)));
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
  return sortByKey(partnerships ?? [], (partnership) => partnership.eventId).map(
    (partnership) => ({
      eventId: partnership.eventId,
      sponsorshipTier: partnership.sponsorshipTier,
      customTierLabel: partnership.customTierLabel,
      deliverables: sortByKey(partnership.deliverables ?? [], (item) => item.id),
      seminarSlotCount: partnership.seminarSlotCount ?? 0,
    })
  );
}

function normalizeSeminarAssignments(
  assignments: PartnerSeminarSlotAssignment[] | undefined
): PartnerSeminarSlotAssignment[] {
  return sortByKey(assignments ?? [], (assignment) =>
    `${assignment.eventId}:${assignment.seminarId}`
  ).map((assignment) => ({
    eventId: assignment.eventId,
    seminarId: assignment.seminarId,
    slots: assignment.slots,
    seminarTitle: assignment.seminarTitle,
  }));
}

export function normalizePartnerForComparison(partner: Partner): Partner {
  const normalized = jsonPartnerToExpectedApiShape(partner);
  return {
    ...normalized,
    eventIds: [...(normalized.eventIds ?? [])].sort((left, right) =>
      left.localeCompare(right)
    ),
    eventPartnerships: normalizePartnerships(normalized.eventPartnerships),
    seminarSlotAssignments: normalizeSeminarAssignments(
      normalized.seminarSlotAssignments
    ),
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
  const mismatches: string[] = [];

  for (const field of PARTNER_SCALAR_FIELDS) {
    if (stableJson(expected[field]) !== stableJson(actual[field])) {
      mismatches.push(field);
    }
  }

  const expectedEventIds = [...(expected.eventIds ?? [])].sort((left, right) =>
    left.localeCompare(right)
  );
  const actualEventIds = [...(actual.eventIds ?? [])].sort((left, right) =>
    left.localeCompare(right)
  );
  if (stableJson(expectedEventIds) !== stableJson(actualEventIds)) {
    mismatches.push("eventIds");
  }

  const expectedPartnerships = normalizePartnerships(expected.eventPartnerships);
  const actualPartnerships = normalizePartnerships(actual.eventPartnerships);
  if (stableJson(expectedPartnerships) !== stableJson(actualPartnerships)) {
    mismatches.push("eventPartnerships");
  }

  const expectedAssignments = normalizeSeminarAssignments(
    expected.seminarSlotAssignments
  );
  const actualAssignments = normalizeSeminarAssignments(
    actual.seminarSlotAssignments
  );
  if (stableJson(expectedAssignments) !== stableJson(actualAssignments)) {
    mismatches.push("seminarSlotAssignments");
  }

  return [...new Set(mismatches)];
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

  const expectedPartnerships = normalizePartnerships(
    resolvePartnershipsForImport(jsonPartner)
  ).map((partnership) =>
    stableJson({
      eventId: partnership.eventId,
      sponsorshipTier: partnership.sponsorshipTier ?? null,
      customTierLabel: partnership.customTierLabel ?? null,
      seminarSlotCount: partnership.seminarSlotCount ?? 0,
      deliverables: partnership.deliverables ?? [],
    })
  );
  const actualPartnerships = dbRecord.eventPartnerships
    .map((partnership) =>
      stableJson({
        eventId: partnership.eventId,
        sponsorshipTier: partnership.sponsorshipTier,
        customTierLabel: partnership.customTierLabel,
        seminarSlotCount: partnership.seminarSlotCount,
        deliverables: Array.isArray(partnership.deliverables)
          ? partnership.deliverables
          : [],
      })
    )
    .sort((left, right) => left.localeCompare(right));

  const expectedAssignments = normalizeSeminarAssignments(
    jsonPartner.seminarSlotAssignments
  ).map((assignment) =>
    stableJson({
      eventId: assignment.eventId,
      seminarId: assignment.seminarId,
      slots: assignment.slots,
      seminarTitle: assignment.seminarTitle ?? null,
    })
  );
  const actualAssignments = dbRecord.eventPartnerships
    .flatMap((partnership) =>
      partnership.seminarSlotAssignments.map((assignment) =>
        stableJson({
          eventId: partnership.eventId,
          seminarId: assignment.seminarId,
          slots: assignment.slots,
          seminarTitle: assignment.seminarTitle,
        })
      )
    )
    .sort((left, right) => left.localeCompare(right));

  return {
    eventLinks: stableJson(expectedLinks) !== stableJson(actualLinks),
    eventPartnerships:
      stableJson(expectedPartnerships) !== stableJson(actualPartnerships),
    seminarSlotAssignments:
      stableJson(expectedAssignments) !== stableJson(actualAssignments),
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
  const expectedApi = normalizePartnerForComparison(
    jsonPartnerToExpectedApiShape(jsonPartner)
  );
  const actualApi = normalizePartnerForComparison(
    mapPrismaPartnerToApi(dbRecord)
  );

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
