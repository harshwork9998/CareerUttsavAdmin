import { Prisma } from "@/lib/generated/prisma/client";
import type {
  Partner,
  PartnerContact,
  PartnerDeliverable,
  PartnerEventPartnership,
  PartnerMeetingLog,
  PartnerPortalDocument,
  PartnerRepresentativesSubmission,
  PartnerSeminarSlotAssignment,
  PartnerSeminarSpeakerSubmission,
  PartnerStageRemark,
  Spoc,
} from "@/types";

export type PrismaPartnerRecord = Prisma.PartnerGetPayload<{
  include: {
    eventLinks: true;
    eventPartnerships: {
      include: {
        seminarSlotAssignments: true;
      };
    };
  };
}>;

export type PrismaSpocRecord = Prisma.SpocGetPayload<Record<string, never>>;

function optionalIso(value: Date | null | undefined): string | undefined {
  return value ? value.toISOString() : undefined;
}

function optionalNumber(
  value: Prisma.Decimal | null | undefined
): number | undefined {
  if (value === null || value === undefined) return undefined;
  return Number(value);
}

function readJsonArray<T>(value: Prisma.JsonValue | null | undefined): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function readJsonValue<T>(value: Prisma.JsonValue | null | undefined): T | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return value as T;
}

function readPartnerContact(value: Prisma.JsonValue): PartnerContact {
  const contact = value as unknown as PartnerContact;
  return {
    name: contact?.name ?? "",
    designation: contact?.designation ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
  };
}

export function mapPrismaSpocToApi(record: PrismaSpocRecord): Spoc {
  return {
    id: record.id,
    name: record.name,
    organization: record.organization,
    phone: record.phone,
    email: record.email,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function mapPrismaPartnerToApi(record: PrismaPartnerRecord): Partner {
  const legacyDeliverables = readJsonValue<PartnerDeliverable[]>(
    record.legacyDeliverables
  );

  const eventIds = record.eventLinks
    .map((link) => link.eventId)
    .sort((a, b) => a.localeCompare(b));

  const eventPartnerships: PartnerEventPartnership[] =
    record.eventPartnerships.map((partnership) => ({
      eventId: partnership.eventId,
      sponsorshipTier:
        (partnership.sponsorshipTier as PartnerEventPartnership["sponsorshipTier"]) ??
        undefined,
      customTierLabel: partnership.customTierLabel ?? undefined,
      deliverables: readJsonArray<PartnerDeliverable>(partnership.deliverables),
      seminarSlotCount: partnership.seminarSlotCount ?? 0,
    }));

  const seminarSlotAssignments: PartnerSeminarSlotAssignment[] =
    record.eventPartnerships.flatMap((partnership) =>
      partnership.seminarSlotAssignments.map((assignment) => ({
        eventId: partnership.eventId,
        seminarId: assignment.seminarId,
        slots: assignment.slots,
        seminarTitle: assignment.seminarTitle ?? undefined,
      }))
    );

  const partner: Partner = {
    id: record.id,
    name: record.name,
    city: record.city,
    state: record.state,
    primaryContact: readPartnerContact(record.primaryContact),
    secondaryContact: readPartnerContact(record.secondaryContact),
    eventIds,
    relationshipOwner: {
      organization: record.relationshipOrganization,
      spocId: record.relationshipSpocId ?? undefined,
      managerName: record.relationshipManagerName,
      managerPhone: record.relationshipManagerPhone,
      managerEmail: record.relationshipManagerEmail,
    },
    stage: record.stage as Partner["stage"],
    stageRemarks: readJsonArray<PartnerStageRemark>(record.stageRemarks),
    sponsorshipTier:
      (record.sponsorshipTier as Partner["sponsorshipTier"]) ?? undefined,
    sponsorshipNotes: record.sponsorshipNotes ?? undefined,
    eventPartnerships:
      eventPartnerships.length > 0 ? eventPartnerships : undefined,
    deliverables: legacyDeliverables,
    deliverablesConfirmedAt: optionalIso(record.deliverablesConfirmedAt),
    seminarSlotAssignments:
      seminarSlotAssignments.length > 0 ? seminarSlotAssignments : undefined,
    seminarSlotsConfirmedAt: optionalIso(record.seminarSlotsConfirmedAt),
    totalAmount: optionalNumber(record.totalAmount),
    discountAmount: optionalNumber(record.discountAmount),
    netAmount: optionalNumber(record.netAmount),
    commercialsConfirmedAt: optionalIso(record.commercialsConfirmedAt),
    portalLogin: record.portalLogin ?? undefined,
    portalPasswordHash: record.portalPasswordHash ?? undefined,
    portalInviteEmail: record.portalInviteEmail ?? undefined,
    portalInviteSentAt: optionalIso(record.portalInviteSentAt),
    portalDocuments: readJsonValue<PartnerPortalDocument[]>(record.portalDocuments),
    portalFasciaName: record.portalFasciaName ?? undefined,
    portalWebsiteUrl: record.portalWebsiteUrl ?? undefined,
    portalSmsContent: record.portalSmsContent ?? undefined,
    portalSeminarSpeakers: readJsonValue<PartnerSeminarSpeakerSubmission[]>(
      record.portalSeminarSpeakers
    ),
    portalRepresentatives: readJsonValue<PartnerRepresentativesSubmission[]>(
      record.portalRepresentatives
    ),
    portalPasswordChangedAt: optionalIso(record.portalPasswordChangedAt),
    portalAuthVersion: record.portalAuthVersion,
    contactedAt: record.contactedAt ?? undefined,
    contactedNotes: record.contactedNotes ?? undefined,
    meetingAt: record.meetingAt ?? undefined,
    meetingNotes: record.meetingNotes ?? undefined,
    meetings: readJsonArray<PartnerMeetingLog>(record.meetings),
    notProceedingAt: record.notProceedingAt ?? undefined,
    notProceedingReason: record.notProceedingReason ?? undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };

  const skippedAt = optionalIso(record.portalPasswordPromptSkippedAt);
  if (skippedAt) {
    (
      partner as Partner & { portalPasswordPromptSkippedAt?: string }
    ).portalPasswordPromptSkippedAt = skippedAt;
  }

  return partner;
}

export function mapPrismaPartnersToApi(records: PrismaPartnerRecord[]): Partner[] {
  return records.map(mapPrismaPartnerToApi);
}

export function isPrismaUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
