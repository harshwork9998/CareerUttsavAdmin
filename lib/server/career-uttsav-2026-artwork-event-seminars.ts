import { CAREER_UTTSAV_SEMINARS } from "@/features/dashboard/seminars";
import type { EventSeminar } from "@/types";

/** Career Uttsav 2026 fair dates. Seminar session times are decided separately. */
export const CAREER_UTTSAV_2026_EVENT_START_DATE = "2026-12-19";
export const CAREER_UTTSAV_2026_EVENT_END_DATE = "2026-12-20";

/**
 * Canonical seminar identities for evt-001.
 * Schedule metadata stays null until an approved timetable is saved onto these same ids.
 */
export const CAREER_UTTSAV_2026_ARTWORK_EVENT_SEMINARS: EventSeminar[] =
  CAREER_UTTSAV_SEMINARS.map((title, index) => ({
    id: `sem-2026-${String(index + 1).padStart(2, "0")}`,
    title,
    date: null,
    startTime: null,
    endTime: null,
    panelistSlots: null,
    hall: null,
  }));
