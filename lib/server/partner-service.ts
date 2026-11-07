import { preservePartnershipActivity } from "@/lib/partner-communication-policy";
import { applyPartnerCredentialFields } from "@/lib/partner-credentials";
import { portalLoginLookupFilter } from "@/lib/partner-login-identity";
import {
  partnerNeedsEventLinkPrune,
  prunePartnerEventLinks,
} from "@/lib/partner-event-config";
import {
  SeminarAllocationWriteError,
  decideSeminarClaims,
  occupancyBySeminar,
  preserveSeminarConfirmation,
  seminarAllocationSignature,
} from "@/lib/seminar-allocation";
import { withSeminarAllocationLock } from "@/lib/server/seminar-allocation-lock";
import { resolvePartnershipsForImport } from "@/lib/server/partner-prisma-import-map";
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
import { listEventsForApi } from "@/lib/server/event-service";
import {
  normalizePartnerSeminarConfirmations,
  preserveAssignmentConfirmation,
} from "@/lib/seminar-assignment-confirmation";
import type { Event, Partner } from "@/types";

export type PartnerWriteResult =
  | { ok: true; partner: Partner }
  | { ok: false; status: number; error: string };

export type PartnerDeleteResult =
  | { ok: true; partners: Partner[] }
  | { ok: false; status: number; error: string };

function presentPartner(partner: Partner): Partner {
  return normalizePartnerSeminarConfirmations(partner);
}

export async function listPartnersForApi(): Promise<Partner[]> {
  const partners = isPrismaPartnerPersistence()
    ? await listPrismaPartners()
    : loadPartners();
  return partners.map(presentPartner);
}

export async function getPartnerByIdForApi(id: string): Promise<Partner | null> {
  const partner = isPrismaPartnerPersistence()
    ? await getPrismaPartnerById(id)
    : loadPartners().find((row) => row.id === id) ?? null;
  return partner ? presentPartner(partner) : null;
}

export async function findPartnersByPortalLoginForApi(
  login: string
): Promise<Partner[]> {
  if (isPrismaPartnerPersistence()) {
    return (await findPrismaPartnersByPortalLogin(login)).map(presentPartner);
  }

  const where = portalLoginLookupFilter(login);
  if (!where) return [];

  return loadPartners()
    .filter((partner) => {
      return partner.portalLogin?.trim().toLowerCase() === where.portalLoginNormalized;
    })
    .map(presentPartner);
}

function partnershipCounts(partner: Partner) {
  return resolvePartnershipsForImport(partner).map((partnership) => ({
    eventId: partnership.eventId,
    seminarSlotCount: partnership.seminarSlotCount ?? 0,
  }));
}

async function seminarCatalog() {
  const events = await listEventsForApi();
  return events.flatMap((event) =>
    (event.seminars ?? []).map((seminar) => ({
      id: seminar.id,
      eventId: event.id,
      panelistSlots: seminar.panelistSlots,
    }))
  );
}

async function allocationVerdict(
  existing: Partner,
  next: Partner
): Promise<PartnerWriteResult | null> {
  const confirmationChanged =
    (next.seminarSlotsConfirmedAt?.trim() ?? "") !==
    (existing.seminarSlotsConfirmedAt?.trim() ?? "");
  if (
    seminarAllocationSignature(existing) === seminarAllocationSignature(next) &&
    !confirmationChanged
  ) {
    return null;
  }
  const [seminars, partners] = await Promise.all([
    seminarCatalog(),
    listPartnersForApi(),
  ]);
  const decision = decideSeminarClaims({
    existingAssignments: existing.seminarSlotAssignments ?? [],
    nextAssignments: next.seminarSlotAssignments ?? [],
    previousPartnerships: partnershipCounts(existing),
    nextPartnerships: partnershipCounts(next),
    seminars,
    otherOccupancy: occupancyBySeminar(partners, next.id),
  });
  if (!decision.ok) {
    return { ok: false, status: decision.status, error: decision.error };
  }
  return null;
}

function emptyAllocationBaseline(partner: Partner): Partner {
  return {
    ...partner,
    seminarSlotAssignments: [],
    eventPartnerships: (partner.eventPartnerships ?? []).map((partnership) => ({
      ...partnership,
      seminarSlotCount: 0,
    })),
    seminarSlotsConfirmedAt: undefined,
  };
}

function writeError(error: unknown, fallback: string): PartnerWriteResult {
  if (error instanceof SeminarAllocationWriteError) {
    return { ok: false, status: error.status, error: error.message };
  }
  return {
    ok: false,
    status: 400,
    error: error instanceof Error ? error.message : fallback,
  };
}

export async function createPartnerForApi(
  partner: Partner
): Promise<PartnerWriteResult> {
  return withSeminarAllocationLock(async () => {
    const verdict = await allocationVerdict(emptyAllocationBaseline(partner), partner);
    if (verdict) return verdict;
    return createPartnerRecord(partner);
  });
}

async function createPartnerRecord(
  partner: Partner
): Promise<PartnerWriteResult> {
  if (isPrismaPartnerPersistence()) {
    try {
      const created = await createPrismaPartner(presentPartner(partner));
      return { ok: true, partner: presentPartner(created) };
    } catch (error) {
      return writeError(error, "Could not create partner");
    }
  }

  const partners = loadPartners();
  const created = presentPartner(partner);
  savePartners([created, ...partners]);
  return { ok: true, partner: created };
}

export async function updatePartnerForApi(
  id: string,
  patch: Partial<Partner>
): Promise<PartnerWriteResult> {
  return withSeminarAllocationLock(() => updatePartnerRecord(id, patch));
}

/** Partner write without taking the seminar lock. Callers must already hold it. */
export async function updatePartnerRecordForApi(
  id: string,
  patch: Partial<Partner>,
  options?: { skipAllocationCheck?: boolean }
): Promise<PartnerWriteResult> {
  return updatePartnerRecord(id, patch, options);
}

async function updatePartnerRecord(
  id: string,
  patch: Partial<Partner>,
  options?: { skipAllocationCheck?: boolean }
): Promise<PartnerWriteResult> {
  const existing = await getPartnerByIdForApi(id);
  if (!existing) {
    return { ok: false, status: 404, error: "Not found" };
  }

  const phones = validatePartnerContactPhones(patch, existing);
  if (!phones.ok) {
    return { ok: false, status: 400, error: phones.error };
  }

  const updated = preserveAssignmentConfirmation(
    existing,
    preserveSeminarConfirmation(
      existing,
      preservePartnershipActivity(
        existing,
        applyPartnerCredentialFields(existing, {
          ...phones.patch,
          updatedAt: new Date().toISOString(),
        })
      )
    )
  );
  const verdict = options?.skipAllocationCheck
    ? null
    : await allocationVerdict(existing, updated);
  if (verdict) return verdict;

  if (isPrismaPartnerPersistence()) {
    try {
      const saved = await updatePrismaPartner(updated);
      return { ok: true, partner: presentPartner(saved) };
    } catch (error) {
      return writeError(error, "Could not update partner");
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
    return { ok: true, partners: partners.map(presentPartner) };
  }

  const partners = loadPartners();
  const next = partners.filter((partner) => partner.id !== id);
  if (next.length === partners.length) {
    return { ok: false, status: 404, error: "Not found" };
  }
  savePartners(next);
  return { ok: true, partners: next.map(presentPartner) };
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
