import { isStudentRegistration } from "@/lib/registration-kinds";
import { normalizeRegistration } from "@/features/registrations/normalize-registration";
import type { Event, Registration } from "@/types";

export function resolveRegistration(
  registration: Registration,
  _events: Event[]
): Registration {
  if (!isStudentRegistration(registration)) {
    return registration;
  }

  // Keep explicit seminar picks only — never invent interests for empty rows.
  return normalizeRegistration(registration);
}

export function resolveRegistrations(
  registrations: Registration[],
  events: Event[]
): Registration[] {
  return registrations.map((registration) =>
    resolveRegistration(registration, events)
  );
}

export function getPrimarySeminar(registration: Registration): string {
  if (!isStudentRegistration(registration)) return "—";
  return registration.seminarInterests?.[0] ?? "—";
}

export function formatSeminarInterests(registration: Registration): string {
  if (!isStudentRegistration(registration)) return "—";
  const items = (registration.seminarInterests ?? []).filter(Boolean);
  if (items.length === 0) return "—";
  return items.join(" - ");
}
