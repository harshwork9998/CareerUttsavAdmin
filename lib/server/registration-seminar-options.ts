import {
  CAREER_UTTSAV_SEMINARS,
  canonicalizeSeminarTitle,
  seminarTitlesMatch,
} from "@/features/dashboard/seminars";
import { CURRENT_EVENT_ID } from "@/lib/current-events";
import { getEventForApi } from "@/lib/server/event-service";

export type RegistrationSeminarOption = {
  id: string;
  title: string;
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
 * Canonical seminar catalog for student registration (website + WhatsApp).
 * Uses the shared Career Uttsav catalogue titles and reuses current-event
 * seminar IDs when titles match.
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
        seminarTitlesMatch(seminar.title, title)
    );

    if (eventMatch) {
      options.push({
        id: eventMatch.id,
        title: eventMatch.title.trim(),
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
    options.push({
      id: seminar.id,
      title: seminar.title.trim(),
    });
  }

  return options;
}
