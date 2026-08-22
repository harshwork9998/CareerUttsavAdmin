import { EventStatus as PrismaEventStatus } from "@/lib/generated/prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Event, EventSeminar } from "@/types";

const EVENT_ID = "evt-001";
const SEM_A = "sem-001-a";
const SEM_B = "sem-001-b";

function baseSeminar(overrides: Partial<EventSeminar> = {}): EventSeminar {
  return {
    id: SEM_A,
    title: "Seminar A",
    date: "2026-08-15",
    startTime: "10:00",
    endTime: "11:00",
    panelistSlots: 3,
    hall: 1,
    ...overrides,
  };
}

function prismaEventRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: EVENT_ID,
    title: "Career Uttsav",
    slug: "career-uttsav",
    description: "Desc",
    shortDescription: null,
    status: PrismaEventStatus.Published,
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
    registrationDeadline: new Date("2026-08-10T18:29:59.000Z"),
    maxCapacity: 15000,
    registrationCount: 8429,
    checkInCount: 0,
    bannerImage: null,
    isFeatured: true,
    tags: [],
    createdBy: "usr-001",
    createdAt: new Date("2025-11-01T04:30:00.000Z"),
    updatedAt: new Date("2026-06-20T09:00:00.000Z"),
    seminars: [
      {
        id: SEM_A,
        eventId: EVENT_ID,
        title: "Seminar A",
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

const {
  eventCreate,
  eventUpdate,
  eventFindUnique,
  eventFindMany,
  eventDelete,
  seminarUpdate,
  seminarCreate,
  seminarDeleteMany,
  registrationCount,
  registrationSeminarUpdateMany,
  partnerAssignmentCount,
  partnerAssignmentUpdateMany,
  transaction,
} = vi.hoisted(() => ({
  eventCreate: vi.fn(),
  eventUpdate: vi.fn(),
  eventFindUnique: vi.fn(),
  eventFindMany: vi.fn(),
  eventDelete: vi.fn(),
  seminarUpdate: vi.fn(),
  seminarCreate: vi.fn(),
  seminarDeleteMany: vi.fn(),
  registrationCount: vi.fn(),
  registrationSeminarUpdateMany: vi.fn(),
  partnerAssignmentCount: vi.fn(),
  partnerAssignmentUpdateMany: vi.fn(),
  transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      event: {
        create: eventCreate,
        update: eventUpdate,
        findUniqueOrThrow: eventFindUnique,
        delete: eventDelete,
      },
      seminar: {
        update: seminarUpdate,
        create: seminarCreate,
        deleteMany: seminarDeleteMany,
      },
      registrationSeminar: {
        updateMany: registrationSeminarUpdateMany,
      },
      partnerSeminarSlotAssignment: {
        updateMany: partnerAssignmentUpdateMany,
      },
    })
  ),
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    event: {
      create: eventCreate,
      update: eventUpdate,
      findUnique: eventFindUnique,
      findMany: eventFindMany,
      delete: eventDelete,
    },
    seminar: {
      update: seminarUpdate,
      create: seminarCreate,
      deleteMany: seminarDeleteMany,
    },
    registration: {
      count: registrationCount,
    },
    partnerSeminarSlotAssignment: {
      count: partnerAssignmentCount,
      updateMany: partnerAssignmentUpdateMany,
    },
    registrationSeminar: {
      updateMany: registrationSeminarUpdateMany,
    },
    $transaction: transaction,
  },
}));

vi.mock("@/lib/utils", () => ({
  generateId: vi.fn(() => "evt-generated"),
}));

import {
  createPrismaEventForApi,
  deletePrismaEventForApi,
  patchPrismaEventForApi,
} from "@/lib/server/event-prisma-write-store";

function createInput(overrides: Partial<Event> = {}): Omit<
  Event,
  "id" | "createdAt" | "updatedAt"
> {
  return {
    title: "New Event",
    slug: "new-event",
    description: "Desc",
    status: "Draft",
    venue: "Venue",
    address: "Address",
    city: "Bangalore",
    state: "Karnataka",
    pincode: "560001",
    startDate: "2026-09-01",
    endDate: "2026-09-02",
    startTime: "09:00",
    endTime: "18:00",
    hallCount: 2,
    seminars: [baseSeminar()],
    registrationDeadline: "2026-08-31T23:59:59+05:30",
    maxCapacity: 1000,
    registrationCount: 999,
    checkInCount: 888,
    isFeatured: false,
    tags: [],
    createdBy: "usr-001",
    ...overrides,
  };
}

describe("event prisma write store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventCreate.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      ...prismaEventRecord(),
      ...args.data,
      seminars: [
        {
          id: SEM_A,
          eventId: "evt-generated",
          title: "Seminar A",
          date: "2026-08-15",
          startTime: "10:00",
          endTime: "11:00",
          panelistSlots: 3,
          hall: 1,
        },
      ],
    }));
    eventFindUnique.mockResolvedValue(prismaEventRecord());
    eventFindMany.mockResolvedValue([]);
    partnerAssignmentCount.mockResolvedValue(0);
    registrationCount.mockResolvedValue(0);
    eventFindUnique.mockImplementation(async () => prismaEventRecord());
    eventFindUnique.mockImplementation(async (args: { where: { id: string } }) => {
      if (args.where.id === "missing") return null;
      return prismaEventRecord();
    });
  });

  it("creates event with seminars atomically and zero counters", async () => {
    const created = await createPrismaEventForApi(createInput());
    expect(created.id).toBe("evt-generated");
    expect(created.registrationCount).toBe(0);
    expect(created.checkInCount).toBe(0);
    expect(eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: "evt-generated",
          registrationCount: 0,
          checkInCount: 0,
          seminars: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({ id: SEM_A }),
            ]),
          }),
        }),
      })
    );
  });

  it("ignores client-provided counters on create", async () => {
    await createPrismaEventForApi(
      createInput({ registrationCount: 999, checkInCount: 888 })
    );
    expect(eventCreate.mock.calls[0]?.[0].data.registrationCount).toBe(0);
    expect(eventCreate.mock.calls[0]?.[0].data.checkInCount).toBe(0);
  });

  it("patches scalar fields without changing counters", async () => {
    eventFindUnique
      .mockResolvedValueOnce(prismaEventRecord())
      .mockResolvedValueOnce(
        prismaEventRecord({
          title: "Updated title",
          registrationCount: 8429,
          checkInCount: 0,
        })
      );

    const updated = await patchPrismaEventForApi(EVENT_ID, {
      title: "Updated title",
      registrationCount: 0,
      checkInCount: 999,
    });

    expect(updated.title).toBe("Updated title");
    expect(updated.registrationCount).toBe(8429);
    expect(updated.checkInCount).toBe(0);
    expect(eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          registrationCount: expect.anything(),
          checkInCount: expect.anything(),
        }),
      })
    );
  });

  it("updates existing seminars and creates new seminars via diff", async () => {
    eventFindUnique
      .mockResolvedValueOnce(prismaEventRecord())
      .mockResolvedValueOnce(
        prismaEventRecord({
          seminars: [
            prismaEventRecord().seminars[0],
            {
              id: SEM_B,
              eventId: EVENT_ID,
              title: "Seminar B",
              date: "2026-08-15",
              startTime: "12:00",
              endTime: "13:00",
              panelistSlots: 2,
              hall: 2,
            },
          ],
        })
      );

    await patchPrismaEventForApi(EVENT_ID, {
      seminars: [
        baseSeminar({ title: "Seminar A updated" }),
        baseSeminar({
          id: SEM_B,
          title: "Seminar B",
          startTime: "12:00",
          endTime: "13:00",
          hall: 2,
          panelistSlots: 2,
        }),
      ],
    });

    expect(seminarUpdate).toHaveBeenCalled();
    expect(seminarCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ id: SEM_B }),
      })
    );
    expect(seminarDeleteMany).not.toHaveBeenCalled();
  });

  it("deletes removed seminars when no partner assignments exist", async () => {
    eventFindUnique
      .mockResolvedValueOnce(prismaEventRecord())
      .mockResolvedValueOnce(prismaEventRecord({ seminars: [] }));

    await patchPrismaEventForApi(EVENT_ID, { seminars: [] });

    expect(seminarDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: [SEM_A] }, eventId: EVENT_ID },
    });
  });

  it("blocks seminar deletion when partner slot assignments exist", async () => {
    partnerAssignmentCount.mockResolvedValue(1);
    await expect(
      patchPrismaEventForApi(EVENT_ID, { seminars: [] })
    ).rejects.toMatchObject({ status: 409 });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("syncs registration seminar titles by seminarId on title change", async () => {
    eventFindUnique
      .mockResolvedValueOnce(prismaEventRecord())
      .mockResolvedValueOnce(
        prismaEventRecord({
          seminars: [
            {
              ...prismaEventRecord().seminars[0],
              title: "Renamed Seminar",
            },
          ],
        })
      );

    await patchPrismaEventForApi(EVENT_ID, {
      seminars: [baseSeminar({ title: "Renamed Seminar" })],
    });

    expect(registrationSeminarUpdateMany).toHaveBeenCalledWith({
      where: { seminarId: SEM_A },
      data: { seminarTitle: "Renamed Seminar" },
    });
    expect(partnerAssignmentUpdateMany).toHaveBeenCalledWith({
      where: { seminarId: SEM_A },
      data: { seminarTitle: "Renamed Seminar" },
    });
  });

  it("blocks event delete when registrations exist", async () => {
    registrationCount.mockResolvedValue(24);
    await expect(deletePrismaEventForApi(EVENT_ID)).rejects.toMatchObject({
      status: 409,
    });
    expect(eventDelete).not.toHaveBeenCalled();
  });

  it("deletes event when no registrations exist", async () => {
    registrationCount.mockResolvedValue(0);
    eventFindMany.mockResolvedValue([]);
    const remaining = await deletePrismaEventForApi(EVENT_ID);
    expect(remaining).toEqual([]);
    expect(eventDelete).toHaveBeenCalledWith({ where: { id: EVENT_ID } });
  });
});
