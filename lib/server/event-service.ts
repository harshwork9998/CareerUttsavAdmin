import { loadEvents } from "@/lib/server/events-persistence";
import {
  getPrismaEventById,
  listPrismaEvents,
} from "@/lib/server/event-prisma-store";
import { isPrismaRegistrationPersistence } from "@/lib/server/registration-persistence-mode";
import type { Event } from "@/types";

/**
 * Event reads coordinated with REGISTRATION_PERSISTENCE for cutover consistency.
 * Event writes remain JSON-backed until a dedicated event-write migration step.
 */
export async function listEventsForApi(): Promise<Event[]> {
  if (isPrismaRegistrationPersistence()) {
    return listPrismaEvents();
  }
  return loadEvents();
}

export async function getEventForApi(id: string): Promise<Event | null> {
  if (isPrismaRegistrationPersistence()) {
    return getPrismaEventById(id);
  }
  return loadEvents().find((event) => event.id === id) ?? null;
}
