import { isStudentRegistration } from "@/lib/registration-kinds";
import { normalizeRegistration } from "@/features/registrations/normalize-registration";
import type { Event, Registration, StudentRegistration } from "@/types";

function pickSeminarInterests(
  registration: StudentRegistration,
  event: Event | undefined
): string[] {
  if (registration.seminarInterests?.length) {
    return registration.seminarInterests;
  }
  if (!event?.seminars.length) return [];

  const titles = event.seminars.map((seminar) => seminar.title);
  const stream = (registration.interestedStream ?? "").toLowerCase();
  const course = (registration.course ?? "").toLowerCase();

  if (course.includes("pcb") || course.includes("medical")) {
    const match = titles.find((title) => /medicine/i.test(title));
    if (match) return [match];
  }

  if (
    stream.includes("commerce") ||
    course.includes("commerce") ||
    course.includes("b.com")
  ) {
    const match = titles.find((title) =>
      /management|entrepreneurship|ca \/ cs/i.test(title)
    );
    if (match) return [match];
  }

  if (
    stream.includes("science") ||
    course.includes("pcm") ||
    course.includes("science")
  ) {
    const match = titles.find((title) =>
      /artificial intelligence|engineering|competitive|stream/i.test(title)
    );
    if (match) return [match];
  }

  if (stream.includes("arts") || course.includes("humanities")) {
    const match = titles.find((title) => /stream|overseas/i.test(title));
    if (match) return [match];
  }

  const hash = registration.id
    .split("")
    .reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return [titles[hash % titles.length]];
}

export function resolveRegistration(
  registration: Registration,
  events: Event[]
): Registration {
  if (!isStudentRegistration(registration)) {
    return registration;
  }

  const normalized = normalizeRegistration(registration);
  const event = events.find((item) => item.id === normalized.eventId);
  const seminarInterests = pickSeminarInterests(normalized, event);

  if (!seminarInterests.length) return normalized;
  return { ...normalized, seminarInterests };
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
  return items.join(" · ");
}
