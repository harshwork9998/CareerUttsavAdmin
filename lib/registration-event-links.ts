import type { Registration } from "@/types";

export function registrationMatchesEventFilter(
  registration: Registration,
  eventIds: string[]
): boolean {
  if (eventIds.length === 0) return true;
  return eventIds.includes(registration.eventId);
}

export function filterRegistrationsForEventCatalog(
  registrations: Registration[],
  validEventIds: Set<string>
): Registration[] {
  return registrations.filter((registration) =>
    validEventIds.has(registration.eventId)
  );
}

export function registrationsNeedEventLinkPrune(
  registrations: Registration[],
  validEventIds: Set<string>
): boolean {
  return registrations.some(
    (registration) => !validEventIds.has(registration.eventId)
  );
}
