import { filterRegistrationsForEventCatalog } from "@/lib/registration-event-links";
import { loadEvents, saveEvents } from "@/lib/server/events-persistence";
import {
  createPrismaEventForApi,
  deletePrismaEventForApi,
  patchPrismaEventForApi,
  type CreateEventInput,
  type PatchEventInput,
} from "@/lib/server/event-prisma-write-store";
import { listPrismaEvents } from "@/lib/server/event-prisma-store";
import { isPrismaEventWritePersistence } from "@/lib/server/event-write-persistence-mode";
import { EventWriteError, isEventWriteError } from "@/lib/server/event-write-errors";
import { prunePartnersForEventCatalog } from "@/lib/server/partner-service";
import { pruneSeminarRostersForEventCatalog } from "@/lib/server/seminar-roster-service";
import {
  loadRawRegistrations,
  saveRegistrations,
} from "@/lib/server/registrations-persistence";
import { generateId } from "@/lib/utils";
import type { Event } from "@/types";

export type EventWriteResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

function toWriteResult<T>(promise: Promise<T>): Promise<EventWriteResult<T>> {
  return promise
    .then((data) => ({ ok: true as const, data }))
    .catch((error: unknown) => {
      if (isEventWriteError(error)) {
        return { ok: false as const, status: error.status, error: error.message };
      }
      return {
        ok: false as const,
        status: 400,
        error: error instanceof Error ? error.message : "Event write failed",
      };
    });
}

function pruneJsonRegistrationsForEventCatalog(events: Event[]): void {
  const validEventIds = new Set(events.map((event) => event.id));
  const registrations = loadRawRegistrations();
  const next = filterRegistrationsForEventCatalog(registrations, validEventIds);
  if (next.length !== registrations.length) {
    saveRegistrations(next);
  }
}

export async function createEventForApi(
  input: CreateEventInput
): Promise<EventWriteResult<Event>> {
  if (isPrismaEventWritePersistence()) {
    return toWriteResult(createPrismaEventForApi(input));
  }

  const city = input.city?.trim() ?? "";
  if (city.length < 2) {
    return {
      ok: false,
      status: 400,
      error: "Event city is required (at least 2 characters)",
    };
  }

  const now = new Date().toISOString();
  const created: Event = {
    ...input,
    city,
    id: generateId(),
    seminars: input.seminars ?? [],
    startTime: input.startTime ?? "09:00",
    endTime: input.endTime ?? "18:00",
    hallCount: input.hallCount ?? 1,
    venue: input.venue ?? "",
    registrationCount: 0,
    checkInCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  const events = [created, ...loadEvents()];
  saveEvents(events);
  return { ok: true, data: created };
}

export async function patchEventForApi(
  eventId: string,
  patch: PatchEventInput
): Promise<EventWriteResult<Event>> {
  if (isPrismaEventWritePersistence()) {
    return toWriteResult(patchPrismaEventForApi(eventId, patch));
  }

  if (patch.city !== undefined && patch.city.trim().length < 2) {
    return {
      ok: false,
      status: 400,
      error: "Event city is required (at least 2 characters)",
    };
  }

  const events = loadEvents();
  const idx = events.findIndex((entry) => entry.id === eventId);
  if (idx === -1) {
    return { ok: false, status: 404, error: "Not found" };
  }

  const updated: Event = {
    ...events[idx],
    ...patch,
    ...(patch.city !== undefined ? { city: patch.city.trim() } : {}),
    id: events[idx].id,
    updatedAt: new Date().toISOString(),
  };

  const next = [...events];
  next[idx] = updated;
  saveEvents(next);
  await pruneSeminarRostersForEventCatalog(next);
  return { ok: true, data: updated };
}

export async function deleteEventForApi(
  eventId: string
): Promise<EventWriteResult<Event[]>> {
  if (isPrismaEventWritePersistence()) {
    return toWriteResult(deletePrismaEventForApi(eventId));
  }

  const current = loadEvents();
  const events = current.filter((entry) => entry.id !== eventId);
  if (events.length === current.length) {
    return { ok: false, status: 404, error: "Not found" };
  }

  saveEvents(events);
  await prunePartnersForEventCatalog(events);
  pruneJsonRegistrationsForEventCatalog(events);
  await pruneSeminarRostersForEventCatalog(events);
  return { ok: true, data: events };
}

export async function listEventsAfterDeleteForApi(): Promise<Event[]> {
  if (isPrismaEventWritePersistence()) {
    return listPrismaEvents();
  }
  return loadEvents();
}

export { EventWriteError };
