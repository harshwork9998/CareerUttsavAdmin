import { describe, expect, it } from "vitest";

import { SEMINAR_FULL } from "@/lib/seminar-allocation";
import {
  assertSeminarCapacityInTransaction,
  type SeminarCapacityTransaction,
} from "@/lib/server/seminar-capacity-lock";
import type { Partner } from "@/types";

type Row = {
  seminarId: string;
  slots: number;
  partnership: { partnerId: string; eventId: string; seminarSlotCount: number };
};

function partner(id: string): Partner {
  return {
    id,
    seminarSlotAssignments: [
      { eventId: "evt-001", seminarId: "sem-a", slots: 1 },
    ],
    eventPartnerships: [
      {
        eventId: "evt-001",
        deliverables: [],
        seminarSlotCount: 1,
      },
    ],
  } as unknown as Partner;
}

function lockedClaims(panelistSlots: number, holders: Row[]) {
  let tail = Promise.resolve();
  const releases: Array<() => void> = [];
  const tx = {
    $queryRaw: () => {
      const ticket = tail;
      let release: () => void = () => undefined;
      tail = new Promise((resolve) => {
        release = resolve;
      });
      releases.push(release);
      return ticket;
    },
    seminar: {
      findMany: async () => [
        { id: "sem-a", eventId: "evt-001", panelistSlots },
      ],
    },
    partnerEventPartnership: {
      findMany: async (args: { where: { partnerId: string } }) => [
        { eventId: "evt-001", seminarSlotCount: 1, partnerId: args.where.partnerId },
      ],
    },
    partnerSeminarSlotAssignment: {
      findMany: async (args: {
        where: {
          partnership:
            | { partnerId?: string }
            | { is?: { partnerId: { not: string } } };
        };
      }) => {
        const ownId =
          "partnerId" in args.where.partnership
            ? args.where.partnership.partnerId
            : undefined;
        if (ownId) {
          return holders.filter((row) => row.partnership.partnerId === ownId);
        }
        const excluded =
          "is" in args.where.partnership
            ? args.where.partnership.is?.partnerId.not
            : undefined;
        return holders.filter((row) => row.partnership.partnerId !== excluded);
      },
    },
  } as SeminarCapacityTransaction;

  async function claim(id: string) {
    try {
      await assertSeminarCapacityInTransaction(tx, partner(id));
      holders.push({
        seminarId: "sem-a",
        slots: 1,
        partnership: {
          partnerId: id,
          eventId: "evt-001",
          seminarSlotCount: 1,
        },
      });
      return { ok: true as const };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "",
      };
    } finally {
      releases.shift()?.();
    }
  }

  return claim;
}

describe("seminar capacity lock", () => {
  it("lets only one concurrent claim take the last seat", async () => {
    const holders: Row[] = [];
    const claim = lockedClaims(1, holders);
    const results = await Promise.all([claim("partner-a"), claim("partner-b")]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.some((result) => !result.ok && result.error === SEMINAR_FULL)).toBe(
      true
    );
    expect(holders).toHaveLength(1);
  });

  it("counts a legacy stack toward the locked seat total", async () => {
    const holders: Row[] = [
      {
        seminarId: "sem-a",
        slots: 2,
        partnership: {
          partnerId: "legacy",
          eventId: "evt-001",
          seminarSlotCount: 1,
        },
      },
    ];
    const claim = lockedClaims(3, holders);
    const results = await Promise.all([claim("partner-a"), claim("partner-b")]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.some((result) => !result.ok && result.error === SEMINAR_FULL)).toBe(
      true
    );
    expect(holders.reduce((sum, row) => sum + row.slots, 0)).toBe(3);
  });
});
