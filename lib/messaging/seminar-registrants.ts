import { isStudentRegistration } from "@/lib/registration-kinds";
import type { Registration, StudentRegistration } from "@/types";

function hash01(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return (h % 1000) / 1000;
}

/** Deterministic seminar picks when explicit interests are not stored yet. */
export function resolveSeminarInterests(
  registration: StudentRegistration,
  eventSeminarTitles: readonly string[]
): string[] {
  if (registration.seminarInterests?.length) {
    return registration.seminarInterests;
  }

  const titles = [...new Set(eventSeminarTitles.filter(Boolean))];
  if (titles.length === 0) return [];

  const pickCount = Math.min(titles.length, hash01(registration.id) > 0.65 ? 2 : 1);
  const ordered = [...titles].sort(
    (a, b) =>
      hash01(`${registration.id}:${b}`) - hash01(`${registration.id}:${a}`)
  );

  return ordered.slice(0, pickCount);
}

export function filterRegistrantsForSeminar(
  registrations: Registration[],
  seminarTitle: string,
  eventSeminarTitles: readonly string[]
): StudentRegistration[] {
  return registrations.filter(
    (registration): registration is StudentRegistration => {
      if (!isStudentRegistration(registration)) return false;
      return resolveSeminarInterests(registration, eventSeminarTitles).includes(
        seminarTitle
      );
    }
  );
}

export const BROADCAST_PLACEHOLDERS = [
  { key: "{{studentName}}", label: "Student name" },
  { key: "{{seminarTitle}}", label: "Seminar title" },
  { key: "{{eventTitle}}", label: "Event name" },
  { key: "{{seminarTime}}", label: "Seminar time" },
  { key: "{{seminarHall}}", label: "Audi / hall" },
] as const;

export function renderBroadcastMessage(
  template: string,
  ctx: {
    studentName: string;
    seminarTitle: string;
    eventTitle: string;
    seminarTime?: string;
    seminarHall?: string;
  }
): string {
  return template
    .replaceAll("{{studentName}}", ctx.studentName)
    .replaceAll("{{seminarTitle}}", ctx.seminarTitle)
    .replaceAll("{{eventTitle}}", ctx.eventTitle)
    .replaceAll("{{seminarTime}}", ctx.seminarTime ?? "TBD")
    .replaceAll("{{seminarHall}}", ctx.seminarHall ?? "TBD");
}
