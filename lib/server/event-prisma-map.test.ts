import { EventStatus as PrismaEventStatus } from "@/lib/generated/prisma/client";
import { describe, expect, it } from "vitest";

import {
  mapPrismaEventToApi,
  type PrismaEventRecord,
} from "@/lib/server/event-prisma-map";

function sampleEventRecord(
  overrides: Partial<PrismaEventRecord> = {}
): PrismaEventRecord {
  return {
    id: "evt-001",
    title: "Career Uttsav Bengaluru 2026",
    slug: "career-uttsav-bengaluru-2026",
    description: "Test description",
    shortDescription: "Short",
    status: PrismaEventStatus.Published,
    venue: "Palace Grounds",
    address: "Bellary Road",
    city: "Bangalore",
    state: "Karnataka",
    pincode: "560052",
    startDate: "2026-08-15",
    endDate: "2026-08-16",
    startTime: "09:00",
    endTime: "18:00",
    hallCount: 3,
    registrationDeadline: new Date("2026-08-10T18:29:59.000Z"),
    maxCapacity: 15000,
    registrationCount: 8429,
    checkInCount: 0,
    bannerImage: "/images/events/bengaluru-2026.jpg",
    isFeatured: true,
    tags: ["Engineering"],
    createdBy: "usr-001",
    createdAt: new Date("2025-11-01T04:30:00.000Z"),
    updatedAt: new Date("2026-06-20T09:00:00.000Z"),
    seminars: [
      {
        id: "sem-001-a",
        eventId: "evt-001",
        title: "How to select a stream – Art – Science – Commerce?",
        date: "2026-08-15",
        startTime: "10:00",
        endTime: "11:00",
        panelistSlots: 3,
        hall: 1,
      },
    ],
    ...overrides,
  };
}

describe("event prisma map", () => {
  it("maps Prisma event + seminars to the existing Event API shape", () => {
    const api = mapPrismaEventToApi(sampleEventRecord());

    expect(api.id).toBe("evt-001");
    expect(api.status).toBe("Published");
    expect(api.registrationCount).toBe(8429);
    expect(api.checkInCount).toBe(0);
    expect(api.registrationDeadline).toBe("2026-08-10T18:29:59.000Z");
    expect(api.seminars).toEqual([
      {
        id: "sem-001-a",
        title: "How to select a stream – Art – Science – Commerce?",
        date: "2026-08-15",
        startTime: "10:00",
        endTime: "11:00",
        panelistSlots: 3,
        hall: 1,
      },
    ]);
  });

  it("omits nullable optional fields when null", () => {
    const api = mapPrismaEventToApi(
      sampleEventRecord({ shortDescription: null, bannerImage: null })
    );
    expect(api.shortDescription).toBeUndefined();
    expect(api.bannerImage).toBeUndefined();
  });
});
