import { Prisma } from "@/lib/generated/prisma/client";
import {
  SeminarAllocationWriteError,
  decideSeminarClaims,
  occupiedSeatCount,
  type SeminarAssignmentRef,
  type SeminarPartnershipCount,
} from "@/lib/seminar-allocation";
import { resolvePartnershipsForImport } from "@/lib/server/partner-prisma-import-map";
import type { Partner } from "@/types";

type AssignmentRow = {
  seminarId: string;
  slots: number;
  partnership: { partnerId: string; eventId: string; seminarSlotCount: number };
};

/**
 * Narrow view of the Prisma transaction used to lock seminar rows.
 * `FOR UPDATE` is held until the surrounding transaction commits.
 */
export type SeminarCapacityTransaction = {
  $queryRaw: (
    query: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<unknown>;
  seminar: {
    findMany: (args: {
      where: { id: { in: string[] } };
      select: { id: true; eventId: true; panelistSlots: true };
    }) => Promise<
      Array<{ id: string; eventId: string; panelistSlots: number | null }>
    >;
  };
  partnerEventPartnership: {
    findMany: (args: {
      where: { partnerId: string };
      select: { eventId: true; seminarSlotCount: true };
    }) => Promise<SeminarPartnershipCount[]>;
  };
  partnerSeminarSlotAssignment: {
    findMany: (args: {
      where: {
        seminarId?: { in: string[] };
        slots?: { gt: number };
        partnership:
          | { partnerId: string }
          | { is: { partnerId: { not: string } } };
      };
      select: {
        seminarId: true;
        slots: true;
        partnership: {
          select: { partnerId: true; eventId: true; seminarSlotCount: true };
        };
      };
    }) => Promise<AssignmentRow[]>;
  };
};

function activeIds(assignments: readonly SeminarAssignmentRef[]): string[] {
  return [
    ...new Set(
      assignments
        .filter((assignment) => assignment.slots > 0 && assignment.seminarId)
        .map((assignment) => assignment.seminarId)
    ),
  ].sort();
}

/**
 * Lock the seminar rows, then accept the partner's next topic set only if it
 * still fits. Call this inside the same transaction that writes the assignments.
 */
export async function assertSeminarCapacityInTransaction(
  tx: SeminarCapacityTransaction,
  partner: Partner
): Promise<void> {
  const nextAssignments = partner.seminarSlotAssignments ?? [];
  const ownBefore = await tx.partnerSeminarSlotAssignment.findMany({
    where: { partnership: { partnerId: partner.id } },
    select: {
      seminarId: true,
      slots: true,
      partnership: {
        select: { partnerId: true, eventId: true, seminarSlotCount: true },
      },
    },
  });
  const ids = activeIds([
    ...ownBefore.map((row) => ({
      eventId: row.partnership.eventId,
      seminarId: row.seminarId,
      slots: row.slots,
    })),
    ...nextAssignments,
  ]);
  if (ids.length === 0) return;

  // Lock in id order so two writers cannot deadlock on the same seminars.
  await tx.$queryRaw`
    SELECT "id" FROM "seminars"
    WHERE "id" IN (${Prisma.join(ids)})
    ORDER BY "id"
    FOR UPDATE
  `;

  const [seminars, ownAfter, others, previousPartnerships] = await Promise.all([
    tx.seminar.findMany({
      where: { id: { in: ids } },
      select: { id: true, eventId: true, panelistSlots: true },
    }),
    tx.partnerSeminarSlotAssignment.findMany({
      where: { partnership: { partnerId: partner.id } },
      select: {
        seminarId: true,
        slots: true,
        partnership: {
          select: { partnerId: true, eventId: true, seminarSlotCount: true },
        },
      },
    }),
    tx.partnerSeminarSlotAssignment.findMany({
      where: {
        seminarId: { in: ids },
        slots: { gt: 0 },
        partnership: { is: { partnerId: { not: partner.id } } },
      },
      select: {
        seminarId: true,
        slots: true,
        partnership: {
          select: { partnerId: true, eventId: true, seminarSlotCount: true },
        },
      },
    }),
    tx.partnerEventPartnership.findMany({
      where: { partnerId: partner.id },
      select: { eventId: true, seminarSlotCount: true },
    }),
  ]);

  const otherOccupancy = new Map<string, number>();
  const seen = new Set<string>();
  for (const row of others) {
    const key = `${row.partnership.partnerId}:${row.seminarId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    otherOccupancy.set(
      row.seminarId,
      (otherOccupancy.get(row.seminarId) ?? 0) + occupiedSeatCount(row.slots)
    );
  }

  const decision = decideSeminarClaims({
    existingAssignments: ownAfter.map((row) => ({
      eventId: row.partnership.eventId,
      seminarId: row.seminarId,
      slots: row.slots,
    })),
    nextAssignments,
    previousPartnerships,
    nextPartnerships: resolvePartnershipsForImport(partner).map((partnership) => ({
      eventId: partnership.eventId,
      seminarSlotCount: partnership.seminarSlotCount ?? 0,
    })),
    seminars,
    otherOccupancy,
  });
  if (!decision.ok) {
    throw new SeminarAllocationWriteError(decision.status, decision.error);
  }
}
