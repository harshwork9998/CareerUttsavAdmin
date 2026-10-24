import { isSuperuser } from "@/lib/access-control";
import { findAdminUserRelationshipSpocId } from "@/lib/server/admin-user-spoc";
import { istCalendarDateFromDate } from "@/lib/server/ist-calendar";
import {
  collectDueFollowUpsFromPartners,
  followUpUrgency,
} from "@/lib/server/partner-follow-up-eligibility";
import { isPrismaPartnerPersistence } from "@/lib/server/partner-persistence-mode";
import { listPartnersForApi } from "@/lib/server/partner-service";
import { listPrismaPartnersByRelationshipSpocId } from "@/lib/server/partner-prisma-store";
import { prisma } from "@/lib/server/prisma";
import type { FollowUpApiItem } from "@/lib/follow-up-api-types";
import type { PartnerFollowUpItem, User } from "@/types";

export type { FollowUpApiItem };

export async function listPartnersForFollowUpOwner(
  ownerSpocId: string
): Promise<Awaited<ReturnType<typeof listPartnersForApi>>> {
  if (isPrismaPartnerPersistence()) {
    return listPrismaPartnersByRelationshipSpocId(ownerSpocId);
  }
  const partners = await listPartnersForApi();
  return partners.filter(
    (partner) => partner.relationshipOwner?.spocId === ownerSpocId
  );
}

export async function listDueFollowUpsForOwner(input: {
  ownerSpocId: string;
  asOf?: Date;
}): Promise<PartnerFollowUpItem[]> {
  const partners = await listPartnersForFollowUpOwner(input.ownerSpocId);
  return collectDueFollowUpsFromPartners(partners, input.asOf ?? new Date());
}

export async function listDueFollowUpsForAdminUser(input: {
  user: User;
  asOf?: Date;
}): Promise<PartnerFollowUpItem[]> {
  const asOf = input.asOf ?? new Date();
  if (isSuperuser(input.user)) {
    const partners = await listPartnersForApi();
    return collectDueFollowUpsFromPartners(partners, asOf);
  }

  const spocId = await findAdminUserRelationshipSpocId(input.user.id);
  if (!spocId) {
    return [];
  }

  return listDueFollowUpsForOwner({ ownerSpocId: spocId, asOf });
}

async function resolveOwnerNameMap(
  items: PartnerFollowUpItem[]
): Promise<Map<string, string>> {
  const spocIds = new Set<string>();
  for (const item of items) {
    const id = item.partner.relationshipOwner?.spocId;
    if (id) spocIds.add(id);
  }
  if (spocIds.size === 0) return new Map();

  if (!isPrismaPartnerPersistence()) {
    const map = new Map<string, string>();
    for (const item of items) {
      const id = item.partner.relationshipOwner?.spocId;
      if (id && !map.has(id)) {
        map.set(id, item.partner.relationshipOwner?.managerName?.trim() || "—");
      }
    }
    return map;
  }

  const spocs = await prisma.spoc.findMany({
    where: { id: { in: [...spocIds] } },
    select: { id: true, name: true },
  });
  return new Map(spocs.map((spoc) => [spoc.id, spoc.name]));
}

export async function listFollowUpApiItemsForAdminUser(input: {
  user: User;
  asOf?: Date;
}): Promise<FollowUpApiItem[]> {
  const asOf = input.asOf ?? new Date();
  const asOfIst = istCalendarDateFromDate(asOf);
  const items = await listDueFollowUpsForAdminUser({ user: input.user, asOf });
  const ownerNames = await resolveOwnerNameMap(items);
  const includeOwner = isSuperuser(input.user);

  return items.map((item) => {
    const { partner, meeting } = item;
    const spocId = partner.relationshipOwner?.spocId;
    return {
      partnerId: partner.id,
      partnerName: partner.name,
      city: partner.city,
      state: partner.state,
      stage: partner.stage,
      urgency: followUpUrgency(
        meeting.followUpAt!,
        asOfIst,
        meeting.outcome
      ),
      followUpAt: meeting.followUpAt!,
      followUpNotes: meeting.followUpNotes,
      meetingNotes: meeting.notes,
      lostReason: meeting.lostReason,
      primaryContactName: partner.primaryContact.name,
      primaryContactPhone: partner.primaryContact.phone,
      primaryContactEmail: partner.primaryContact.email,
      meetingId: meeting.id,
      ...(includeOwner
        ? {
            relationshipOwnerName:
              (spocId ? ownerNames.get(spocId) : undefined) ||
              partner.relationshipOwner?.managerName?.trim() ||
              undefined,
          }
        : {}),
    };
  });
}

export async function listDistinctOwnerSpocIdsWithPartners(): Promise<string[]> {
  if (isPrismaPartnerPersistence()) {
    const rows = await prisma.partner.findMany({
      where: { relationshipSpocId: { not: null } },
      select: { relationshipSpocId: true },
      distinct: ["relationshipSpocId"],
    });
    return rows
      .map((row) => row.relationshipSpocId)
      .filter((id): id is string => Boolean(id));
  }

  const partners = await listPartnersForApi();
  const ids = new Set<string>();
  for (const partner of partners) {
    const id = partner.relationshipOwner?.spocId;
    if (id) ids.add(id);
  }
  return [...ids];
}
