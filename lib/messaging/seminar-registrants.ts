import { seminarTitlesMatch } from "@/features/dashboard/seminars";
import { isStudentRegistration } from "@/lib/registration-kinds";
import type { Registration, StudentRegistration } from "@/types";

/** Explicit seminar picks only — never invent interests. */
export function resolveSeminarInterests(
  registration: StudentRegistration,
  _eventSeminarTitles?: readonly string[]
): string[] {
  return (registration.seminarInterests ?? [])
    .map((title) => title.trim())
    .filter(Boolean);
}

export function filterRegistrantsForSeminar(
  registrations: Registration[],
  seminarTitle: string,
  _eventSeminarTitles?: readonly string[]
): StudentRegistration[] {
  return registrations.filter(
    (registration): registration is StudentRegistration => {
      if (!isStudentRegistration(registration)) return false;
      return resolveSeminarInterests(registration).some((interest) =>
        seminarTitlesMatch(interest, seminarTitle)
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
