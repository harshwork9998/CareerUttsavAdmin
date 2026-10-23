import {
  CAREER_UTTSAV_SEMINARS,
  isCurrentCareerUttsavSeminar,
  seminarMatchKey,
} from "@/features/dashboard/seminars";
import { isStudentRegistration } from "@/lib/registration-kinds";
import type { Registration } from "@/types";

/** Explicit seminar titles stored on a registration (never invented). */
export function getRegistrationSeminarInterests(
  registration: Registration
): string[] {
  if (!isStudentRegistration(registration)) return [];
  return (registration.seminarInterests ?? [])
    .map((title) => title.trim())
    .filter(Boolean);
}

/** True when the student is registered for every seminar in `requiredSeminars`. */
export function registrationMatchesAllSeminars(
  registration: Registration,
  requiredSeminars: string[]
): boolean {
  if (requiredSeminars.length === 0) return true;

  const interests = new Set(
    getRegistrationSeminarInterests(registration).map(seminarMatchKey)
  );

  return requiredSeminars.every((seminar) =>
    interests.has(seminarMatchKey(seminar))
  );
}

/**
 * Current catalogue titles that exist on the event come first.
 * Any other title already stored on a registration stays available
 * so historical rows remain filterable and exportable.
 */
export function buildRegistrationSeminarFilterOptions(input: {
  registrationTitles: readonly string[];
  eventTitles: readonly string[];
}): Array<{ label: string; value: string }> {
  const stored = new Set<string>();
  for (const title of input.registrationTitles) {
    const trimmed = title.trim();
    if (trimmed) stored.add(trimmed);
  }

  const current = CAREER_UTTSAV_SEMINARS.filter((title) =>
    input.eventTitles.some(
      (eventTitle) =>
        eventTitle.trim() === title && isCurrentCareerUttsavSeminar(eventTitle)
    )
  );
  const historical = [...stored]
    .filter((title) => !isCurrentCareerUttsavSeminar(title))
    .sort((a, b) => a.localeCompare(b));

  return [...current, ...historical].map((value) => ({ label: value, value }));
}

export function slugifySeminarFilters(seminars: string[]): string {
  const slug = seminars
    .map((title) =>
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 24)
    )
    .filter(Boolean)
    .join("-and-");
  return slug || "filtered";
}
