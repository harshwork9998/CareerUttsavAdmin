import type { EventSeminar } from "@/types";

export const SEMINAR_SCHEDULE_UNSET_LABEL = "TBD";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function seminarScheduleText(
  value: string | null | undefined
): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : SEMINAR_SCHEDULE_UNSET_LABEL;
}

export function seminarTimeLabel(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed || !TIME_PATTERN.test(trimmed)) {
    return trimmed ? trimmed : SEMINAR_SCHEDULE_UNSET_LABEL;
  }
  const [hourText, minuteText] = trimmed.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function seminarDayLabel(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed || !DATE_PATTERN.test(trimmed)) {
    return SEMINAR_SCHEDULE_UNSET_LABEL;
  }
  const date = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(date.getTime())) return SEMINAR_SCHEDULE_UNSET_LABEL;
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function seminarHallLabel(hall: number | null | undefined): string {
  return typeof hall === "number" && hall >= 1
    ? `Audi ${hall}`
    : SEMINAR_SCHEDULE_UNSET_LABEL;
}

export function seminarCapacityLabel(
  slots: number | null | undefined
): string {
  if (typeof slots !== "number") return SEMINAR_SCHEDULE_UNSET_LABEL;
  return `${slots} panelist${slots === 1 ? "" : "s"}`;
}

export function isSeminarCapacityDecided(
  slots: number | null | undefined
): slots is number {
  return typeof slots === "number" && Number.isInteger(slots) && slots >= 1;
}

function scheduleRank(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "\uffff";
}

export function compareScheduledSeminars<
  T extends {
    date?: string | null;
    startTime?: string | null;
    hall?: number | null;
    title?: string | null;
  },
>(left: T, right: T): number {
  const byDate = scheduleRank(left.date).localeCompare(scheduleRank(right.date));
  if (byDate !== 0) return byDate;
  const byTime = scheduleRank(left.startTime).localeCompare(
    scheduleRank(right.startTime)
  );
  if (byTime !== 0) return byTime;
  const leftHall = left.hall ?? Number.MAX_SAFE_INTEGER;
  const rightHall = right.hall ?? Number.MAX_SAFE_INTEGER;
  if (leftHall !== rightHall) return leftHall - rightHall;
  return (left.title ?? "").localeCompare(right.title ?? "");
}

export function blankScheduleString(
  value: string | null | undefined
): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

export type SeminarDraftScheduleInput = {
  date: string;
  startTime: string;
  endTime: string;
  hall: number | null;
  panelistSlots: number | null;
  allowedDates?: readonly string[];
  hallCount?: number;
};

export type SeminarDraftScheduleErrors = {
  date?: string;
  startTime?: string;
  endTime?: string;
  hall?: string;
  panelistSlots?: string;
};

export function seminarDraftScheduleErrors(
  input: SeminarDraftScheduleInput
): SeminarDraftScheduleErrors {
  const errors: SeminarDraftScheduleErrors = {};
  const date = input.date.trim();
  const startTime = input.startTime.trim();
  const endTime = input.endTime.trim();

  if (date && !DATE_PATTERN.test(date)) {
    errors.date = "Enter a valid date";
  } else if (
    date &&
    input.allowedDates &&
    !input.allowedDates.includes(date)
  ) {
    errors.date = "Select a day";
  }

  if (startTime && !TIME_PATTERN.test(startTime)) {
    errors.startTime = "Enter a valid time";
  }
  if (endTime && !TIME_PATTERN.test(endTime)) {
    errors.endTime = "Enter a valid time";
  }
  if (
    !errors.startTime &&
    !errors.endTime &&
    startTime &&
    endTime &&
    endTime <= startTime
  ) {
    errors.endTime = "Must be after start";
  }

  if (input.hall != null) {
    if (!Number.isInteger(input.hall) || input.hall < 1) {
      errors.hall = "Select an audi";
    } else if (input.hallCount != null && input.hall > input.hallCount) {
      errors.hall = "Select an audi";
    }
  }

  if (input.panelistSlots != null) {
    if (!Number.isInteger(input.panelistSlots) || input.panelistSlots < 1) {
      errors.panelistSlots = "Enter at least 1 slot";
    }
  }

  return errors;
}

export function savedSeminarSchedule(input: SeminarDraftScheduleInput): Pick<
  EventSeminar,
  "date" | "startTime" | "endTime" | "hall" | "panelistSlots"
> {
  return {
    date: blankScheduleString(input.date),
    startTime: blankScheduleString(input.startTime),
    endTime: blankScheduleString(input.endTime),
    hall:
      input.hall != null && Number.isInteger(input.hall) && input.hall >= 1
        ? input.hall
        : null,
    panelistSlots:
      input.panelistSlots != null &&
      Number.isInteger(input.panelistSlots) &&
      input.panelistSlots >= 1
        ? input.panelistSlots
        : null,
  };
}

export function seminarAllocationIncreaseError(input: {
  existing: ReadonlyArray<{ eventId: string; seminarId: string; slots: number }>;
  next: ReadonlyArray<{ eventId: string; seminarId: string; slots: number }>;
  seminars: ReadonlyArray<{ id: string; panelistSlots: number | null }>;
}): string | null {
  const capacityById = new Map(
    input.seminars.map((seminar) => [seminar.id, seminar.panelistSlots])
  );
  for (const assignment of input.next) {
    if (assignment.slots <= 0) continue;
    if (!capacityById.has(assignment.seminarId)) continue;
    if (isSeminarCapacityDecided(capacityById.get(assignment.seminarId))) {
      continue;
    }
    const previous =
      input.existing.find(
        (row) =>
          row.eventId === assignment.eventId &&
          row.seminarId === assignment.seminarId
      )?.slots ?? 0;
    if (assignment.slots > previous) {
      return "Seminar capacity is not decided yet, so new seats cannot be allocated.";
    }
  }
  return null;
}
