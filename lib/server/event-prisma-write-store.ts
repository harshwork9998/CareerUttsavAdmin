import { EVENT_STATUSES } from "@/constants";
import type { EventStatus as PrismaEventStatus } from "@/lib/generated/prisma/client";
import {
  mapPrismaEventToApi,
  type PrismaEventRecord,
} from "@/lib/server/event-prisma-map";
import { prisma } from "@/lib/server/prisma";
import { EventWriteError } from "@/lib/server/event-write-errors";
import { generateId } from "@/lib/utils";
import type { Event, EventSeminar, EventStatus } from "@/types";

const eventInclude = {
  seminars: { orderBy: { id: "asc" as const } },
} as const;

export const PATCH_PROTECTED_EVENT_FIELDS = [
  "id",
  "createdAt",
  "registrationCount",
  "checkInCount",
] as const;

export const PATCH_EDITABLE_EVENT_SCALAR_FIELDS = [
  "title",
  "slug",
  "description",
  "shortDescription",
  "status",
  "venue",
  "address",
  "city",
  "state",
  "pincode",
  "startDate",
  "endDate",
  "startTime",
  "endTime",
  "hallCount",
  "registrationDeadline",
  "maxCapacity",
  "bannerImage",
  "isFeatured",
  "tags",
  "createdBy",
] as const;

export type CreateEventInput = Omit<Event, "id" | "createdAt" | "updatedAt">;

export type PatchEventInput = Partial<Event>;

function parseRequiredDate(value: unknown, fieldName: string): Date {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new EventWriteError(400, `Invalid ${fieldName}`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new EventWriteError(400, `Invalid ${fieldName}`);
  }
  return date;
}

function assertEventStatus(status: unknown): EventStatus {
  if (typeof status !== "string" || !EVENT_STATUSES.includes(status as EventStatus)) {
    throw new EventWriteError(400, `Invalid event status: ${String(status)}`);
  }
  return status as EventStatus;
}

function validateSeminarPayload(seminars: EventSeminar[]): void {
  const seenIds = new Set<string>();
  for (const seminar of seminars) {
    if (!seminar.id?.trim()) {
      throw new EventWriteError(400, "Seminar id is required");
    }
    if (seenIds.has(seminar.id)) {
      throw new EventWriteError(400, `Duplicate seminar id: ${seminar.id}`);
    }
    seenIds.add(seminar.id);
    if (!seminar.title?.trim()) {
      throw new EventWriteError(400, `Seminar ${seminar.id} title is required`);
    }
  }
}

function normalizeCreateInput(
  input: CreateEventInput
): Omit<Event, "id" | "createdAt" | "updatedAt" | "registrationCount" | "checkInCount"> {
  const seminars = input.seminars ?? [];
  validateSeminarPayload(seminars);

  return {
    title: input.title,
    slug: input.slug,
    description: input.description,
    shortDescription: input.shortDescription,
    status: assertEventStatus(input.status),
    venue: input.venue ?? "",
    address: input.address,
    city: input.city.trim(),
    state: input.state,
    pincode: input.pincode,
    startDate: input.startDate,
    endDate: input.endDate,
    startTime: input.startTime ?? "09:00",
    endTime: input.endTime ?? "18:00",
    hallCount: input.hallCount ?? 1,
    seminars,
    registrationDeadline: input.registrationDeadline,
    maxCapacity: input.maxCapacity,
    bannerImage: input.bannerImage,
    isFeatured: input.isFeatured,
    tags: input.tags ?? [],
    createdBy: input.createdBy,
  };
}

function pickEditableScalarPatch(patch: PatchEventInput): Partial<Event> {
  const picked: Partial<Event> = {};
  for (const field of PATCH_EDITABLE_EVENT_SCALAR_FIELDS) {
    if (patch[field] !== undefined) {
      (picked as Record<string, unknown>)[field] = patch[field];
    }
  }
  return picked;
}

async function assertSeminarsSafeToDelete(seminarIds: string[]): Promise<void> {
  if (seminarIds.length === 0) return;

  const assignmentCount = await prisma.partnerSeminarSlotAssignment.count({
    where: { seminarId: { in: seminarIds } },
  });

  if (assignmentCount > 0) {
    throw new EventWriteError(
      409,
      "Cannot remove seminar with active partner slot assignments"
    );
  }
}

async function syncDenormalizedSeminarTitles(
  seminarId: string,
  nextTitle: string
): Promise<void> {
  await prisma.registrationSeminar.updateMany({
    where: { seminarId },
    data: { seminarTitle: nextTitle },
  });
  await prisma.partnerSeminarSlotAssignment.updateMany({
    where: { seminarId },
    data: { seminarTitle: nextTitle },
  });
}

export async function createPrismaEventForApi(
  input: CreateEventInput
): Promise<Event> {
  const normalized = normalizeCreateInput(input);
  const now = new Date();
  const eventId = generateId();

  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        id: eventId,
        title: normalized.title,
        slug: normalized.slug,
        description: normalized.description,
        shortDescription: normalized.shortDescription ?? null,
        status: normalized.status as PrismaEventStatus,
        venue: normalized.venue,
        address: normalized.address,
        city: normalized.city,
        state: normalized.state,
        pincode: normalized.pincode,
        startDate: normalized.startDate,
        endDate: normalized.endDate,
        startTime: normalized.startTime,
        endTime: normalized.endTime,
        hallCount: normalized.hallCount,
        registrationDeadline: parseRequiredDate(
          normalized.registrationDeadline,
          "registrationDeadline"
        ),
        maxCapacity: normalized.maxCapacity,
        registrationCount: 0,
        checkInCount: 0,
        bannerImage: normalized.bannerImage ?? null,
        isFeatured: normalized.isFeatured,
        tags: normalized.tags,
        createdBy: normalized.createdBy,
        createdAt: now,
        updatedAt: now,
        seminars: {
          create: normalized.seminars.map((seminar) => ({
            id: seminar.id,
            title: seminar.title,
            date: seminar.date,
            startTime: seminar.startTime,
            endTime: seminar.endTime,
            panelistSlots: seminar.panelistSlots,
            hall: seminar.hall,
          })),
        },
      },
      include: eventInclude,
    });
    return created;
  });

  return mapPrismaEventToApi(record);
}

export async function patchPrismaEventForApi(
  eventId: string,
  patch: PatchEventInput
): Promise<Event> {
  const existing = await prisma.event.findUnique({
    where: { id: eventId },
    include: eventInclude,
  });
  if (!existing) {
    throw new EventWriteError(404, "Not found");
  }

  const scalarPatch = pickEditableScalarPatch(patch);
  if (scalarPatch.city !== undefined) {
    scalarPatch.city = scalarPatch.city.trim();
    if (scalarPatch.city.length < 2) {
      throw new EventWriteError(400, "Event city is required (at least 2 characters)");
    }
  }
  if (scalarPatch.status !== undefined) {
    scalarPatch.status = assertEventStatus(scalarPatch.status);
  }

  const seminarsPatch = patch.seminars;
  if (seminarsPatch !== undefined) {
    validateSeminarPayload(seminarsPatch);
  }

  const existingSeminarsById = new Map(
    existing.seminars.map((seminar) => [seminar.id, seminar])
  );
  const incomingSeminars = seminarsPatch ?? null;
  const toDelete =
    incomingSeminars === null
      ? []
      : [...existingSeminarsById.keys()].filter(
          (id) => !incomingSeminars.some((seminar) => seminar.id === id)
        );

  await assertSeminarsSafeToDelete(toDelete);

  const now = new Date();
  const record = await prisma.$transaction(async (tx) => {
    const updateData: Record<string, unknown> = { updatedAt: now };

    if (scalarPatch.title !== undefined) updateData.title = scalarPatch.title;
    if (scalarPatch.slug !== undefined) updateData.slug = scalarPatch.slug;
    if (scalarPatch.description !== undefined) {
      updateData.description = scalarPatch.description;
    }
    if (scalarPatch.shortDescription !== undefined) {
      updateData.shortDescription = scalarPatch.shortDescription ?? null;
    }
    if (scalarPatch.status !== undefined) {
      updateData.status = scalarPatch.status as PrismaEventStatus;
    }
    if (scalarPatch.venue !== undefined) updateData.venue = scalarPatch.venue;
    if (scalarPatch.address !== undefined) updateData.address = scalarPatch.address;
    if (scalarPatch.city !== undefined) updateData.city = scalarPatch.city;
    if (scalarPatch.state !== undefined) updateData.state = scalarPatch.state;
    if (scalarPatch.pincode !== undefined) updateData.pincode = scalarPatch.pincode;
    if (scalarPatch.startDate !== undefined) updateData.startDate = scalarPatch.startDate;
    if (scalarPatch.endDate !== undefined) updateData.endDate = scalarPatch.endDate;
    if (scalarPatch.startTime !== undefined) updateData.startTime = scalarPatch.startTime;
    if (scalarPatch.endTime !== undefined) updateData.endTime = scalarPatch.endTime;
    if (scalarPatch.hallCount !== undefined) updateData.hallCount = scalarPatch.hallCount;
    if (scalarPatch.registrationDeadline !== undefined) {
      updateData.registrationDeadline = parseRequiredDate(
        scalarPatch.registrationDeadline,
        "registrationDeadline"
      );
    }
    if (scalarPatch.maxCapacity !== undefined) {
      updateData.maxCapacity = scalarPatch.maxCapacity;
    }
    if (scalarPatch.bannerImage !== undefined) {
      updateData.bannerImage = scalarPatch.bannerImage ?? null;
    }
    if (scalarPatch.isFeatured !== undefined) {
      updateData.isFeatured = scalarPatch.isFeatured;
    }
    if (scalarPatch.tags !== undefined) updateData.tags = scalarPatch.tags;
    if (scalarPatch.createdBy !== undefined) {
      updateData.createdBy = scalarPatch.createdBy;
    }

    await tx.event.update({
      where: { id: eventId },
      data: updateData,
    });

    if (incomingSeminars) {
      for (const seminar of incomingSeminars) {
        const previous = existingSeminarsById.get(seminar.id);
        if (previous) {
          await tx.seminar.update({
            where: { id: seminar.id },
            data: {
              title: seminar.title,
              date: seminar.date,
              startTime: seminar.startTime,
              endTime: seminar.endTime,
              panelistSlots: seminar.panelistSlots,
              hall: seminar.hall,
            },
          });
          if (previous.title !== seminar.title) {
            await tx.registrationSeminar.updateMany({
              where: { seminarId: seminar.id },
              data: { seminarTitle: seminar.title },
            });
            await tx.partnerSeminarSlotAssignment.updateMany({
              where: { seminarId: seminar.id },
              data: { seminarTitle: seminar.title },
            });
          }
        } else {
          await tx.seminar.create({
            data: {
              id: seminar.id,
              eventId,
              title: seminar.title,
              date: seminar.date,
              startTime: seminar.startTime,
              endTime: seminar.endTime,
              panelistSlots: seminar.panelistSlots,
              hall: seminar.hall,
            },
          });
        }
      }

      if (toDelete.length > 0) {
        await tx.seminar.deleteMany({
          where: { id: { in: toDelete }, eventId },
        });
      }
    }

    return tx.event.findUniqueOrThrow({
      where: { id: eventId },
      include: eventInclude,
    });
  });

  return mapPrismaEventToApi(record);
}

export async function deletePrismaEventForApi(eventId: string): Promise<Event[]> {
  const existing = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!existing) {
    throw new EventWriteError(404, "Not found");
  }

  const registrationCount = await prisma.registration.count({
    where: { eventId },
  });
  if (registrationCount > 0) {
    throw new EventWriteError(
      409,
      "Cannot delete event with existing registrations"
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.event.delete({ where: { id: eventId } });
  });

  const remaining = await prisma.event.findMany({
    include: eventInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return remaining.map((row: PrismaEventRecord) => mapPrismaEventToApi(row));
}
