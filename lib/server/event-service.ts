import { loadEvents } from "@/lib/server/events-persistence";
import {
  getPrismaEventById,
  listPrismaEvents,
} from "@/lib/server/event-prisma-store";
import { isPrismaEventWritePersistence } from "@/lib/server/event-write-persistence-mode";
import { isPrismaRegistrationPersistence } from "@/lib/server/registration-persistence-mode";
import type { Event } from "@/types";

function shouldReadEventsFromPrisma(): boolean {
  return (
    isPrismaRegistrationPersistence() || isPrismaEventWritePersistence()
  );
}

/**
 * Event reads follow the active persistence cutover switches.
 * Prisma is used when either registrations or event writes have moved to Prisma.
 */
export async function listEventsForApi(): Promise<Event[]> {
  if (shouldReadEventsFromPrisma()) {
    return listPrismaEvents();
  }
  return loadEvents();
}

export async function getEventForApi(id: string): Promise<Event | null> {
  if (shouldReadEventsFromPrisma()) {
    return getPrismaEventById(id);
  }
  return loadEvents().find((event) => event.id === id) ?? null;
}
