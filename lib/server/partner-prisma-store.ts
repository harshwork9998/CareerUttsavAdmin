import { Prisma } from "@/lib/generated/prisma/client";
import { enrichPartnerWithEventCatalog } from "@/lib/partner-event-config";
import {
  mapPartnerEventLinks,
  mapPartnerEventPartnerships,
  mapPartnerSeminarSlotAssignments,
  mapPartnerSourceToPrisma,
  normalizePortalLogin,
} from "@/lib/server/partner-prisma-import-map";
import {
  mapPrismaPartnerToApi,
  mapPrismaPartnersToApi,
  type PrismaPartnerRecord,
} from "@/lib/server/partner-prisma-map";
import { prisma } from "@/lib/server/prisma";
import { listEventsForApi } from "@/lib/server/event-service";
import type { Partner } from "@/types";

const partnerInclude = {
  eventLinks: true,
  eventPartnerships: {
    include: {
      seminarSlotAssignments: true,
    },
  },
} satisfies Prisma.PartnerInclude;

async function enrichPartners(partners: Partner[]): Promise<Partner[]> {
  const events = await listEventsForApi();
  return partners.map((partner) =>
    enrichPartnerWithEventCatalog(partner, events)
  );
}

async function assertPartnerRelationsValid(partner: Partner): Promise<void> {
  const eventIds = new Set([
    ...(partner.eventIds ?? []),
    ...(partner.eventPartnerships ?? []).map((row) => row.eventId),
    ...(partner.seminarSlotAssignments ?? []).map((row) => row.eventId),
  ]);
  const seminarIds = new Set(
    (partner.seminarSlotAssignments ?? []).map((row) => row.seminarId)
  );

  if (eventIds.size > 0) {
    const events = await prisma.event.findMany({
      where: { id: { in: [...eventIds] } },
      select: { id: true },
    });
    const found = new Set(events.map((event) => event.id));
    for (const eventId of eventIds) {
      if (!found.has(eventId)) {
        throw new Error(`Unknown event id: ${eventId}`);
      }
    }
  }

  if (seminarIds.size > 0) {
    const seminars = await prisma.seminar.findMany({
      where: { id: { in: [...seminarIds] } },
      select: { id: true },
    });
    const found = new Set(seminars.map((seminar) => seminar.id));
    for (const seminarId of seminarIds) {
      if (!found.has(seminarId)) {
        throw new Error(`Unknown seminar id: ${seminarId}`);
      }
    }
  }

  for (const assignment of partner.seminarSlotAssignments ?? []) {
    const hasPartnership = mapPartnerEventPartnerships(partner).some(
      (row) => row.eventId === assignment.eventId
    );
    if (!hasPartnership) {
      throw new Error(
        `Seminar assignment references event ${assignment.eventId} without a partnership row`
      );
    }
  }
}

async function replacePartnerRelations(
  tx: Prisma.TransactionClient,
  partner: Partner
): Promise<void> {
  await tx.partnerSeminarSlotAssignment.deleteMany({
    where: {
      partnership: {
        partnerId: partner.id,
      },
    },
  });
  await tx.partnerEventPartnership.deleteMany({
    where: { partnerId: partner.id },
  });
  await tx.partnerEventLink.deleteMany({
    where: { partnerId: partner.id },
  });

  const eventLinks = mapPartnerEventLinks(partner);
  if (eventLinks.length > 0) {
    await tx.partnerEventLink.createMany({ data: eventLinks });
  }

  const partnerships = mapPartnerEventPartnerships(partner);
  if (partnerships.length > 0) {
    await tx.partnerEventPartnership.createMany({ data: partnerships });
  }

  const assignments = mapPartnerSeminarSlotAssignments(partner);
  if (assignments.length > 0) {
    await tx.partnerSeminarSlotAssignment.createMany({ data: assignments });
  }
}

export async function listPrismaPartners(): Promise<Partner[]> {
  const records = await prisma.partner.findMany({
    include: partnerInclude,
    orderBy: { updatedAt: "desc" },
  });
  return enrichPartners(mapPrismaPartnersToApi(records));
}

export async function getPrismaPartnerById(id: string): Promise<Partner | null> {
  const record = await prisma.partner.findUnique({
    where: { id },
    include: partnerInclude,
  });
  if (!record) return null;
  const [partner] = await enrichPartners([mapPrismaPartnerToApi(record)]);
  return partner ?? null;
}

export async function findPrismaPartnersByPortalLogin(
  login: string
): Promise<Partner[]> {
  const normalized = normalizePortalLogin(login);
  if (!normalized) return [];

  const records = await prisma.partner.findMany({
    where: {
      OR: [
        { portalLoginNormalized: normalized },
        { portalInviteEmailNormalized: normalized },
      ],
    },
    include: partnerInclude,
  });

  return enrichPartners(mapPrismaPartnersToApi(records));
}

export async function createPrismaPartner(partner: Partner): Promise<Partner> {
  await assertPartnerRelationsValid(partner);
  const data = mapPartnerSourceToPrisma(partner);

  await prisma.$transaction(async (tx) => {
    await tx.partner.create({ data });
    await replacePartnerRelations(tx, partner);
  });

  const created = await getPrismaPartnerById(partner.id);
  if (!created) {
    throw new Error(`Partner ${partner.id} was not found after create`);
  }
  return created;
}

export async function updatePrismaPartner(partner: Partner): Promise<Partner> {
  await assertPartnerRelationsValid(partner);
  const data = mapPartnerSourceToPrisma(partner);

  await prisma.$transaction(async (tx) => {
    await tx.partner.update({
      where: { id: partner.id },
      data: {
        ...data,
        id: undefined,
        createdAt: undefined,
      },
    });
    await replacePartnerRelations(tx, partner);
  });

  const updated = await getPrismaPartnerById(partner.id);
  if (!updated) {
    throw new Error(`Partner ${partner.id} was not found after update`);
  }
  return updated;
}

export async function deletePrismaPartner(id: string): Promise<Partner[]> {
  await prisma.partner.delete({ where: { id } });
  return listPrismaPartners();
}

export async function prunePrismaPartnersForEventIds(
  validEventIds: Set<string>
): Promise<void> {
  const partners = await listPrismaPartners();
  for (const partner of partners) {
    const eventIds = partner.eventIds.filter((eventId) =>
      validEventIds.has(eventId)
    );
    const eventPartnerships = (partner.eventPartnerships ?? []).filter((row) =>
      validEventIds.has(row.eventId)
    );
    const seminarSlotAssignments = (partner.seminarSlotAssignments ?? []).filter(
      (row) => validEventIds.has(row.eventId)
    );

    const changed =
      eventIds.length !== partner.eventIds.length ||
      eventPartnerships.length !== (partner.eventPartnerships?.length ?? 0) ||
      seminarSlotAssignments.length !==
        (partner.seminarSlotAssignments?.length ?? 0);

    if (!changed) continue;

    await updatePrismaPartner({
      ...partner,
      eventIds,
      eventPartnerships,
      seminarSlotAssignments,
      updatedAt: new Date().toISOString(),
    });
  }
}

export type { PrismaPartnerRecord };
