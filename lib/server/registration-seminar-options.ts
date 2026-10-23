import {
  CAREER_UTTSAV_SEMINARS,
  canonicalizeSeminarTitle,
  isLegacyCareerUttsavSeminarTitle,
  seminarTitlesMatch,
} from "@/features/dashboard/seminars";
import { CURRENT_EVENT_ID } from "@/lib/current-events";
import { getEventForApi } from "@/lib/server/event-service";

export type RegistrationSeminarOption = {
  id: string;
  title: string;
  date?: string;
  startTime?: string;
};

function catalogSeminarId(canonicalTitle: string): string {
  const slug = canonicalTitle
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return `cat-${slug || "seminar"}`;
}

/**
 * Current seminar catalog for student registration.
 * Returns the canonical 14 titles and reuses current-event seminar IDs
 * when the event record uses the same title.
 * Legacy 20-title event rows are not added as extra current choices.
 * A custom title on the current event is still included.
 */
export async function getRegistrationSeminarOptions(): Promise<
  RegistrationSeminarOption[]
> {
  const event = await getEventForApi(CURRENT_EVENT_ID);
  const eventSeminars = (event?.seminars ?? []).filter(
    (seminar) => seminar.id && seminar.title?.trim()
  );

  const options: RegistrationSeminarOption[] = [];
  const claimedEventIds = new Set<string>();

  for (const catalogTitle of CAREER_UTTSAV_SEMINARS) {
    const title = canonicalizeSeminarTitle(catalogTitle);
    const eventMatch = eventSeminars.find(
      (seminar) =>
        !claimedEventIds.has(seminar.id) &&
        !isLegacyCareerUttsavSeminarTitle(seminar.title) &&
        seminarTitlesMatch(seminar.title, title)
    );

    if (eventMatch) {
      options.push({
        id: eventMatch.id,
        title: eventMatch.title.trim(),
        date: eventMatch.date ?? undefined,
        startTime: eventMatch.startTime ?? undefined,
      });
      claimedEventIds.add(eventMatch.id);
      continue;
    }

    options.push({
      id: catalogSeminarId(title),
      title,
    });
  }

  for (const seminar of eventSeminars) {
    if (claimedEventIds.has(seminar.id)) {
      continue;
    }
    if (isLegacyCareerUttsavSeminarTitle(seminar.title)) {
      continue;
    }
    options.push({
      id: seminar.id,
      title: seminar.title.trim(),
      date: seminar.date ?? undefined,
      startTime: seminar.startTime ?? undefined,
    });
  }

  return options;
}
