import { applyPartnerCredentialFields } from "@/lib/partner-credentials";
import {
  partnerNeedsEventLinkPrune,
  prunePartnerEventLinks,
} from "@/lib/partner-event-config";
import { isPrismaPartnerPersistence } from "@/lib/server/partner-persistence-mode";
import {
  createPrismaPartner,
  deletePrismaPartner,
  findPrismaPartnersByPortalLogin,
  getPrismaPartnerById,
  listPrismaPartners,
  prunePrismaPartnersForEventIds,
  updatePrismaPartner,
} from "@/lib/server/partner-prisma-store";
import {
  loadPartners,
  savePartners,
} from "@/lib/server/partners-persistence";
import { validatePartnerContactPhones } from "@/lib/partner-validation";
import type { Event, Partner } from "@/types";

export type PartnerWriteResult =
  | { ok: true; partner: Partner }
  | { ok: false; status: number; error: string };

export type PartnerDeleteResult =
  | { ok: true; partners: Partner[] }
  | { ok: false; status: number; error: string };

export async function listPartnersForApi(): Promise<Partner[]> {
  if (isPrismaPartnerPersistence()) {
    return listPrismaPartners();
  }
  return loadPartners();
}

export async function getPartnerByIdForApi(id: string): Promise<Partner | null> {
  if (isPrismaPartnerPersistence()) {
    return getPrismaPartnerById(id);
  }
  return loadPartners().find((partner) => partner.id === id) ?? null;
}

export async function findPartnersByPortalLoginForApi(
  login: string
): Promise<Partner[]> {
  if (isPrismaPartnerPersistence()) {
    return findPrismaPartnersByPortalLogin(login);
  }

  const normalized = login.trim().toLowerCase();
  if (!normalized) return [];

  return loadPartners().filter((partner) => {
    return (
      partner.portalLogin?.trim().toLowerCase() === normalized ||
      partner.portalInviteEmail?.trim().toLowerCase() === normalized
    );
  });
}

export async function createPartnerForApi(
  partner: Partner
): Promise<PartnerWriteResult> {
  if (isPrismaPartnerPersistence()) {
    try {
      const created = await createPrismaPartner(partner);
      return { ok: true, partner: created };
    } catch (error) {
      return {
        ok: false,
        status: 400,
        error:
          error instanceof Error ? error.message : "Could not create partner",
      };
    }
  }

  const partners = loadPartners();
  savePartners([partner, ...partners]);
  return { ok: true, partner };
}

export async function updatePartnerForApi(
  id: string,
  patch: Partial<Partner>
): Promise<PartnerWriteResult> {
  const existing = await getPartnerByIdForApi(id);
  if (!existing) {
    return { ok: false, status: 404, error: "Not found" };
  }

  const phones = validatePartnerContactPhones(patch, existing);
  if (!phones.ok) {
    return { ok: false, status: 400, error: phones.error };
  }

  const updated = applyPartnerCredentialFields(existing, {
    ...phones.patch,
    updatedAt: new Date().toISOString(),
  });

  if (isPrismaPartnerPersistence()) {
    try {
      const saved = await updatePrismaPartner(updated);
      return { ok: true, partner: saved };
    } catch (error) {
      return {
        ok: false,
        status: 400,
        error:
          error instanceof Error ? error.message : "Could not update partner",
      };
    }
  }

  const partners = loadPartners();
  const idx = partners.findIndex((partner) => partner.id === id);
  if (idx === -1) {
    return { ok: false, status: 404, error: "Not found" };
  }
  const next = [...partners];
  next[idx] = updated;
  savePartners(next);
  return { ok: true, partner: updated };
}

export async function deletePartnerForApi(
  id: string
): Promise<PartnerDeleteResult> {
  if (isPrismaPartnerPersistence()) {
    const existing = await getPrismaPartnerById(id);
    if (!existing) {
      return { ok: false, status: 404, error: "Not found" };
    }
    const partners = await deletePrismaPartner(id);
    return { ok: true, partners };
  }

  const partners = loadPartners();
  const next = partners.filter((partner) => partner.id !== id);
  if (next.length === partners.length) {
    return { ok: false, status: 404, error: "Not found" };
  }
  savePartners(next);
  return { ok: true, partners: next };
}

export async function prunePartnersForEventCatalog(events: Event[]): Promise<void> {
  const validEventIds = new Set(events.map((event) => event.id));

  if (isPrismaPartnerPersistence()) {
    await prunePrismaPartnersForEventIds(validEventIds);
    return;
  }

  const partners = loadPartners();
  let changed = false;
  const next = partners.map((partner) => {
    if (!partnerNeedsEventLinkPrune(partner, validEventIds)) {
      return partner;
    }
    changed = true;
    return prunePartnerEventLinks(partner, validEventIds);
  });
  if (changed) {
    savePartners(next);
  }
}
