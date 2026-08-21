import type { EventStatus as PrismaEventStatus } from "@/lib/generated/prisma/client";
import type { Event, EventSeminar, EventStatus } from "@/types";
import type { Prisma } from "@/lib/generated/prisma/client";

export type PrismaEventRecord = Prisma.EventGetPayload<{
  include: { seminars: { orderBy: { id: "asc" } } };
}>;

function optionalString(value: string | null | undefined): string | undefined {
  return value ?? undefined;
}

function dateTimeToApiString(value: Date): string {
  return value.toISOString();
}

function mapPrismaEventStatus(status: PrismaEventStatus): EventStatus {
  return status as EventStatus;
}

export function mapPrismaSeminarToApi(
  seminar: PrismaEventRecord["seminars"][number]
): EventSeminar {
  return {
    id: seminar.id,
    title: seminar.title,
    date: seminar.date,
    startTime: seminar.startTime,
    endTime: seminar.endTime,
    panelistSlots: seminar.panelistSlots,
    hall: seminar.hall,
  };
}

export function mapPrismaEventToApi(record: PrismaEventRecord): Event {
  return {
    id: record.id,
    title: record.title,
    slug: record.slug,
    description: record.description,
    shortDescription: optionalString(record.shortDescription),
    status: mapPrismaEventStatus(record.status),
    venue: record.venue,
    address: record.address,
    city: record.city,
    state: record.state,
    pincode: record.pincode,
    startDate: record.startDate,
    endDate: record.endDate,
    startTime: record.startTime,
    endTime: record.endTime,
    hallCount: record.hallCount,
    seminars: record.seminars.map(mapPrismaSeminarToApi),
    registrationDeadline: dateTimeToApiString(record.registrationDeadline),
    maxCapacity: record.maxCapacity,
    registrationCount: record.registrationCount,
    checkInCount: record.checkInCount,
    bannerImage: optionalString(record.bannerImage),
    isFeatured: record.isFeatured,
    tags: record.tags,
    createdBy: record.createdBy,
    createdAt: dateTimeToApiString(record.createdAt),
    updatedAt: dateTimeToApiString(record.updatedAt),
  };
}

export function mapPrismaEventsToApi(records: PrismaEventRecord[]): Event[] {
  return records.map(mapPrismaEventToApi);
}
