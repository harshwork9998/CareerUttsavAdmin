import {
  CAREER_UTTSAV_SEMINARS,
  isCurrentCareerUttsavSeminar,
} from "@/features/dashboard/seminars";
import { generateId } from "@/lib/utils";
import { savedSeminarSchedule } from "@/lib/seminar-schedule";
import type { EventSeminar } from "@/types";

export type SeminarDraft = {
  key: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  panelistSlots: number | null;
  hall: number | null;
};

function toDateOnly(value: string | null | undefined): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return value.slice(0, 10);
}

/** Load every stored seminar, including legacy rows, into the event editor. */
export function seminarDraftsFromEvent(event: {
  seminars?: EventSeminar[] | null;
}): SeminarDraft[] {
  return (event.seminars ?? []).map((seminar) => ({
    key: seminar.id || generateId(),
    title: seminar.title,
    date: toDateOnly(seminar.date),
    startTime: seminar.startTime ?? "",
    endTime: seminar.endTime ?? "",
    panelistSlots:
      typeof seminar.panelistSlots === "number" && seminar.panelistSlots >= 1
        ? seminar.panelistSlots
        : null,
    hall: typeof seminar.hall === "number" && seminar.hall >= 1 ? seminar.hall : null,
  }));
}

/** Save payload keeps every editor row. Empty schedule fields are stored as null. */
export function seminarSavePayload(drafts: readonly SeminarDraft[]): EventSeminar[] {
  return drafts.map((row) => ({
    id: row.key,
    title: row.title,
    ...savedSeminarSchedule(row),
  }));
}

/** Catalogue suggestions for a seminar the user is adding. Not an edit-form seed. */
export function newSeminarTitleSuggestions(): readonly string[] {
  return CAREER_UTTSAV_SEMINARS;
}

export function seminarEditorLegacyLabel(title: string): "Legacy seminar" | null {
  if (!title.trim() || isCurrentCareerUttsavSeminar(title)) return null;
  return "Legacy seminar";
}

export function eventSaveErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message) return message;
  }
  return fallback;
}
