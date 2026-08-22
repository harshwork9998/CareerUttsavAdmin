import { describe, expect, it } from "vitest";

import { reconcileEventJsonToPrisma } from "@/lib/server/event-reconciliation";
import type { Event } from "@/types";

function event(overrides: Partial<Event> = {}): Event {
  return {
    id: "evt-001",
    title: "Career Uttsav",
    slug: "career-uttsav",
    description: "Desc",
    shortDescription: "Short",
    status: "Published",
    venue: "Venue",
    address: "Address",
    city: "Bangalore",
    state: "Karnataka",
    pincode: "560001",
    startDate: "2026-08-15",
    endDate: "2026-08-16",
    startTime: "09:00",
    endTime: "18:00",
    hallCount: 3,
    seminars: [
      {
        id: "sem-b",
        title: "Seminar B",
        date: "2026-08-16",
        startTime: "10:00",
        endTime: "11:00",
        panelistSlots: 2,
        hall: 1,
      },
      {
        id: "sem-a",
        title: "Seminar A",
        date: "2026-08-15",
        startTime: "10:00",
        endTime: "11:00",
        panelistSlots: 3,
        hall: 1,
      },
    ],
    registrationDeadline: "2026-08-10T18:29:59.000Z",
    maxCapacity: 15000,
    registrationCount: 8420,
    checkInCount: 0,
    bannerImage: "/banner.jpg",
    isFeatured: true,
    tags: ["Engineering"],
    createdBy: "usr-001",
    createdAt: "2025-11-01T04:30:00.000Z",
    updatedAt: "2026-06-20T09:00:00.000Z",
    ...overrides,
  };
}

describe("event reconciliation", () => {
  it("compares seminars by ID regardless of array order", () => {
    const jsonEvents = [event()];
    const prismaEvents = [
      event({
        registrationCount: 8429,
        seminars: [
          {
            id: "sem-a",
            title: "Seminar A",
            date: "2026-08-15",
            startTime: "10:00",
            endTime: "11:00",
            panelistSlots: 3,
            hall: 1,
          },
          {
            id: "sem-b",
            title: "Seminar B",
            date: "2026-08-16",
            startTime: "10:00",
            endTime: "11:00",
            panelistSlots: 2,
            hall: 1,
          },
        ],
      }),
    ];

    const report = reconcileEventJsonToPrisma({ jsonEvents, prismaEvents });
    expect(report.rows[0]?.metadataExactMatch).toBe(true);
    expect(report.rows[0]?.seminarComparisons.every((row) => row.exactMatch)).toBe(
      true
    );
  });

  it("reports counter differences separately without failing metadata match", () => {
    const report = reconcileEventJsonToPrisma({
      jsonEvents: [event({ registrationCount: 8420 })],
      prismaEvents: [event({ registrationCount: 8429 })],
    });
    expect(report.rows[0]?.metadataExactMatch).toBe(true);
    expect(report.rows[0]?.registrationCountDiffers).toBe(true);
    expect(report.safeForWriteCutover).toBe(true);
  });

  it("does not treat counter drift as metadata mismatch", () => {
    const report = reconcileEventJsonToPrisma({
      jsonEvents: [event({ checkInCount: 0 })],
      prismaEvents: [event({ checkInCount: 0, registrationCount: 8429 })],
    });
    expect(report.rows[0]?.metadataMismatches).not.toContain("registrationCount");
    expect(report.rows[0]?.checkInCountDiffers).toBe(false);
  });

  it("flags seminar field mismatches by ID", () => {
    const report = reconcileEventJsonToPrisma({
      jsonEvents: [event()],
      prismaEvents: [
        event({
          seminars: [
            {
              id: "sem-a",
              title: "Different title",
              date: "2026-08-15",
              startTime: "10:00",
              endTime: "11:00",
              panelistSlots: 3,
              hall: 1,
            },
            event().seminars[0]!,
          ],
        }),
      ],
    });
    expect(report.safeForWriteCutover).toBe(false);
    expect(
      report.rows[0]?.seminarComparisons.find((row) => row.seminarId === "sem-a")
        ?.fieldMismatches
    ).toContain("title");
  });
});
