import { listEventsForApi } from "@/lib/server/event-service";
import { notifyConfirmedSeminarCommunications } from "@/lib/server/partner-communication-service";
import {
  getPartnerByIdForApi,
  listPartnersForApi,
  updatePartnerRecordForApi,
} from "@/lib/server/partner-service";
import {
  getSeminarRosterForApi,
  upsertSeminarRosterForApi,
} from "@/lib/server/seminar-roster-service";
import { withSeminarAllocationLock } from "@/lib/server/seminar-allocation-lock";
import {
  planAdminSeminarMove,
  planAdminSeminarRemoval,
  rosterWithoutPartnerSeats,
  type SeminarAdminPlan,
} from "@/lib/seminar-admin";
import type { Partner } from "@/types";

export type SeminarAdminWriteResult =
  | { ok: true; partner: Partner }
  | { ok: false; status: number; error: string };

const ROSTER_ROLLBACK =
  "The seminar roster could not be updated. The assignment was left unchanged.";

async function clearPartnerRosterSeat(
  eventId: string,
  seminarId: string,
  partnerId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const roster = await getSeminarRosterForApi(eventId, seminarId);
  if (!roster) return { ok: true };
  const next = rosterWithoutPartnerSeats(roster, partnerId);
  const moderatorSame =
    (next.moderator?.id ?? null) === (roster.moderator?.id ?? null);
  const panelistsSame =
    next.panelists.length === roster.panelists.length &&
    next.panelists.every((speaker, index) => speaker.id === roster.panelists[index]?.id);
  if (moderatorSame && panelistsSame) return { ok: true };
  try {
    const saved = await upsertSeminarRosterForApi({
      ...next,
      updatedAt: new Date().toISOString(),
    });
    if (!saved.ok) return saved;
    return { ok: true };
  } catch {
    return { ok: false, status: 500, error: ROSTER_ROLLBACK };
  }
}

async function applyAssignmentChange(
  partnerId: string,
  source: { eventId: string; seminarId: string },
  plan: SeminarAdminPlan
): Promise<SeminarAdminWriteResult> {
  if (!plan.ok) return plan;
  const existing = await getPartnerByIdForApi(partnerId);
  if (!existing) return { ok: false, status: 404, error: "Not found" };

  const saved = await updatePartnerRecordForApi(partnerId, {
    seminarSlotAssignments: plan.assignments,
    seminarSlotsConfirmedAt: plan.seminarSlotsConfirmedAt ?? undefined,
  });
  if (!saved.ok) return saved;

  const roster = await clearPartnerRosterSeat(
    source.eventId,
    source.seminarId,
    partnerId
  );
  if (roster.ok) return saved;

  const restored = await updatePartnerRecordForApi(
    partnerId,
    {
      seminarSlotAssignments: existing.seminarSlotAssignments,
      seminarSlotsConfirmedAt: existing.seminarSlotsConfirmedAt,
    },
    { skipAllocationCheck: true }
  );
  if (!restored.ok) return restored;
  return roster;
}

export async function movePartnerSeminarForApi(input: {
  partnerId: string;
  eventId: string;
  seminarId: string;
  destinationSeminarId: string;
  now?: string;
}): Promise<SeminarAdminWriteResult> {
  const result = await withSeminarAllocationLock(async () => {
    const partner = await getPartnerByIdForApi(input.partnerId);
    if (!partner) return { ok: false as const, status: 404, error: "Not found" };
    const source = (partner.seminarSlotAssignments ?? []).find(
      (row) => row.eventId === input.eventId && row.seminarId === input.seminarId
    );
    const [events, partners] = await Promise.all([
      listEventsForApi(),
      listPartnersForApi(),
    ]);
    const plan = planAdminSeminarMove({
      partner,
      events,
      partners,
      eventId: input.eventId,
      seminarId: input.seminarId,
      destinationSeminarId: input.destinationSeminarId,
      now: input.now ?? new Date().toISOString(),
    });
    const applied = await applyAssignmentChange(
      input.partnerId,
      { eventId: input.eventId, seminarId: input.seminarId },
      plan
    );
    if (!applied.ok) return applied;
    return {
      ok: true as const,
      partner: applied.partner,
      confirmedReassignment: Boolean(source?.confirmedAt?.trim()),
    };
  });
  if (result.ok && result.confirmedReassignment) {
    try {
      await notifyConfirmedSeminarCommunications(result.partner);
    } catch (error) {
      console.info("[partner-communication]", {
        partnerId: input.partnerId,
        outcome: "unknown",
        error: error instanceof Error ? error.message : "Seminar communication failed",
      });
    }
  }
  if (!result.ok) return result;
  return { ok: true, partner: result.partner };
}

export async function removePartnerSeminarForApi(input: {
  partnerId: string;
  eventId: string;
  seminarId: string;
}): Promise<SeminarAdminWriteResult> {
  return withSeminarAllocationLock(async () => {
    const partner = await getPartnerByIdForApi(input.partnerId);
    if (!partner) return { ok: false, status: 404, error: "Not found" };
    const plan = planAdminSeminarRemoval({
      partner,
      eventId: input.eventId,
      seminarId: input.seminarId,
    });
    return applyAssignmentChange(
      input.partnerId,
      { eventId: input.eventId, seminarId: input.seminarId },
      plan
    );
  });
}
