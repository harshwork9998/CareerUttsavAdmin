import {
  CAREER_UTTSAV_SEMINARS,
  canonicalizeSeminarTitle,
  isCurrentCareerUttsavSeminar,
} from "@/features/dashboard/seminars";
import { isStudentRegistration } from "@/lib/registration-kinds";
import type { Registration } from "@/types";

export function selectCurrentEventSeminars<T extends { title: string }>(
  seminars: readonly T[]
): T[] {
  return seminars.filter((seminar) =>
    isCurrentCareerUttsavSeminar(seminar.title)
  );
}

/**
 * Partner seat management keeps current seminars, plus any legacy seminar
 * that already has an assignment. Unassigned legacy rows are not offered
 * for a new seat.
 */
export function seminarsAvailableForPartnerSlots<
  T extends { id: string; title: string },
>(seminars: readonly T[], assignedSeminarIds: ReadonlySet<string>): T[] {
  return seminars.filter(
    (seminar) =>
      isCurrentCareerUttsavSeminar(seminar.title) ||
      assignedSeminarIds.has(seminar.id)
  );
}

/**
 * Cards for the current dashboard and current seminar programme.
 * The catalogue is shown as-is. Stored historical titles stay on the
 * registration record and are not added as extra current cards.
 */
export function buildCurrentCatalogueSeminarRows(
  items: readonly { name: string; value: number }[],
  catalog: readonly string[] = CAREER_UTTSAV_SEMINARS
): Array<{ name: string; value: number }> {
  const allowed = new Set(catalog);
  const byName = new Map<string, number>();
  for (const item of items) {
    const name = canonicalizeSeminarTitle(item.name, catalog);
    if (!allowed.has(name)) continue;
    byName.set(name, (byName.get(name) ?? 0) + Number(item.value));
  }

  return catalog
    .map((name) => ({
      name,
      value: byName.get(name) ?? 0,
    }))
    .sort((a, b) => b.value - a.value);
}

export function buildCurrentSeminarInterestItems(
  registrations: Registration[],
  seminarTitles: readonly string[]
): Array<{ name: string; value: number }> {
  if (seminarTitles.length === 0) return [];

  const counts = new Map<string, number>();
  for (const title of seminarTitles) {
    counts.set(title, 0);
  }

  for (const registration of registrations) {
    if (!isStudentRegistration(registration)) continue;
    for (const interest of registration.seminarInterests ?? []) {
      const trimmed = interest.trim();
      if (!trimmed || !counts.has(trimmed)) continue;
      counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
    }
  }

  return seminarTitles.map((name) => ({
    name,
    value: counts.get(name) ?? 0,
  }));
}
