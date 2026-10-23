import type { SeminarOption } from "@/lib/server/whatsapp/registration-conversation";
import {
  CAREER_UTTSAV_2026_ARTWORK_EVENT_SEMINARS,
  CAREER_UTTSAV_2026_EVENT_END_DATE,
  CAREER_UTTSAV_2026_EVENT_START_DATE,
} from "@/lib/server/career-uttsav-2026-artwork-event-seminars";
import {
  eventArtworkSeminarsToSeminarOptions,
  resolveArtworkSeminarSelection,
  type ArtworkSeminarResolution,
} from "@/lib/server/whatsapp/whatsapp-artwork-seminar-catalog";
import {
  buildWhatsAppSeminarDayCatalog,
  type WhatsAppSeminarDayCatalog,
} from "@/lib/server/whatsapp/whatsapp-seminar-day-catalog";

export const TEST_EVENT_START_DATE = CAREER_UTTSAV_2026_EVENT_START_DATE;
export const TEST_EVENT_END_DATE = CAREER_UTTSAV_2026_EVENT_END_DATE;

/** Current-event artwork seminars (same IDs/titles as evt-001 JSON fixture). */
export function buildTestEventArtworkSeminarOptions(): SeminarOption[] {
  return eventArtworkSeminarsToSeminarOptions(
    CAREER_UTTSAV_2026_ARTWORK_EVENT_SEMINARS
  );
}

/** @deprecated Use buildTestEventArtworkSeminarOptions for artwork mapping tests. */
export function buildTestSeminarOptions(): SeminarOption[] {
  return buildTestEventArtworkSeminarOptions();
}

export function buildTestSeminarDayCatalog(
  options: SeminarOption[] = buildTestEventArtworkSeminarOptions()
): WhatsAppSeminarDayCatalog {
  return buildWhatsAppSeminarDayCatalog(
    options,
    TEST_EVENT_START_DATE,
    TEST_EVENT_END_DATE
  );
}

export function buildTestArtworkSeminarResolution(
  options: SeminarOption[] = buildTestEventArtworkSeminarOptions()
): ArtworkSeminarResolution {
  return resolveArtworkSeminarSelection(options);
}

export function seminarTurnContext(
  options: SeminarOption[] = buildTestEventArtworkSeminarOptions()
) {
  return {
    seminarOptions: options,
    eventArtworkSeminarOptions: options,
    seminarDayCatalog: buildTestSeminarDayCatalog(options),
    artworkSeminarResolution: buildTestArtworkSeminarResolution(options),
  };
}
