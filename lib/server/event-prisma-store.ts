import { prisma } from "@/lib/server/prisma";
import {
  mapPrismaEventToApi,
  mapPrismaEventsToApi,
} from "@/lib/server/event-prisma-map";
import type { Event } from "@/types";

const eventInclude = {
  seminars: { orderBy: { id: "asc" as const } },
} as const;

export async function listPrismaEvents(): Promise<Event[]> {
  const records = await prisma.event.findMany({
    include: eventInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return mapPrismaEventsToApi(records);
}

export async function getPrismaEventById(id: string): Promise<Event | null> {
  const record = await prisma.event.findUnique({
    where: { id },
    include: eventInclude,
  });
  return record ? mapPrismaEventToApi(record) : null;
}

/** Read-only facts for migration verification scripts. */
export async function readPrismaEventFacts() {
  const [eventCount, seminarCount, registrationCount, evt001] =
    await Promise.all([
      prisma.event.count(),
      prisma.seminar.count(),
      prisma.registration.count(),
      prisma.event.findUnique({
        where: { id: "evt-001" },
        select: {
          id: true,
          registrationCount: true,
          checkInCount: true,
          _count: { select: { seminars: true } },
        },
      }),
    ]);

  return {
    eventCount,
    seminarCount,
    registrationCount,
    evt001: evt001
      ? {
          id: evt001.id,
          registrationCount: evt001.registrationCount,
          checkInCount: evt001.checkInCount,
          seminarCount: evt001._count.seminars,
        }
      : null,
  };
}
