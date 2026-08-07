import {
  formatWeekLabel,
  getIsoWeekParts,
  weekStartMonday,
} from "@/lib/build-dashboard-student-analytics";
import { isStudentRegistration } from "@/lib/registration-kinds";
import { resolveEventCity } from "@/lib/resolve-event-city";
import { citiesMatch } from "@/lib/event-cities";
import type { Event, Registration } from "@/types";

export type RegistrationTrendGrouping =
  | "day"
  | "week"
  | "month"
  | "quarter"
  | "year";

export type RegistrationTrendPoint = {
  name: string;
  value: number;
  /** ISO start of the bucket (for sorting / tooltips) */
  bucketStart: string;
};

export type RegistrationTrendSeries = {
  grouping: RegistrationTrendGrouping;
  from: string;
  to: string;
  total: number;
  points: RegistrationTrendPoint[];
};

const DAY_MS = 86_400_000;

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function parseInputDate(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function toInputDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Inclusive calendar-day span between two start-of-day dates. */
export function inclusiveDaySpan(from: Date, to: Date): number {
  const start = startOfDay(from);
  const end = startOfDay(to);
  const orderedStart = start <= end ? start : end;
  const orderedEnd = start <= end ? end : start;
  return Math.round((orderedEnd.getTime() - orderedStart.getTime()) / DAY_MS) + 1;
}

export function resolveTrendGrouping(daySpan: number): RegistrationTrendGrouping {
  if (daySpan <= 31) return "day";
  if (daySpan <= 180) return "week";
  if (daySpan <= 730) return "month";
  // Beyond ~2 years: quarters; beyond ~5 years: years for readability.
  if (daySpan <= 1825) return "quarter";
  return "year";
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfQuarter(date: Date): Date {
  const quarter = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), quarter * 3, 1);
}

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function bucketStartForGrouping(
  date: Date,
  grouping: RegistrationTrendGrouping
): Date {
  switch (grouping) {
    case "day":
      return startOfDay(date);
    case "week":
      return weekStartMonday(date);
    case "month":
      return startOfMonth(date);
    case "quarter":
      return startOfQuarter(date);
    case "year":
      return startOfYear(date);
  }
}

function nextBucketStart(
  bucketStart: Date,
  grouping: RegistrationTrendGrouping
): Date {
  switch (grouping) {
    case "day":
      return addDays(bucketStart, 1);
    case "week":
      return addDays(bucketStart, 7);
    case "month":
      return addMonths(bucketStart, 1);
    case "quarter":
      return addMonths(bucketStart, 3);
    case "year":
      return new Date(bucketStart.getFullYear() + 1, 0, 1);
  }
}

function formatDayLabel(date: Date, includeYear: boolean): string {
  const day = date.getDate();
  const month = MONTH_ABBR[date.getMonth()];
  return includeYear ? `${day} ${month} ${date.getFullYear()}` : `${day} ${month}`;
}

function formatMonthLabel(date: Date): string {
  return `${MONTH_ABBR[date.getMonth()]} ${date.getFullYear()}`;
}

function formatQuarterLabel(date: Date): string {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `Q${quarter} ${date.getFullYear()}`;
}

function formatBucketLabel(
  bucketStart: Date,
  grouping: RegistrationTrendGrouping,
  rangeSpansYears: boolean
): string {
  switch (grouping) {
    case "day":
      return formatDayLabel(bucketStart, rangeSpansYears);
    case "week":
      return formatWeekLabel(bucketStart);
    case "month":
      return formatMonthLabel(bucketStart);
    case "quarter":
      return formatQuarterLabel(bucketStart);
    case "year":
      return String(bucketStart.getFullYear());
  }
}

function filterScopedStudentTimestamps(
  registrations: Registration[],
  events: Event[],
  city: string | "all"
): Date[] {
  const studentRegistrations = registrations.filter(isStudentRegistration);
  const eventIds = new Set(events.map((event) => event.id));
  const eventCityById = new Map(events.map((event) => [event.id, event.city]));

  return studentRegistrations
    .filter((registration) => eventIds.has(registration.eventId))
    .filter((registration) => {
      if (city === "all") return true;
      const eventCity = resolveEventCity(registration, eventCityById);
      return eventCity ? citiesMatch(eventCity, city) : false;
    })
    .map((registration) => new Date(registration.registeredAt))
    .filter((date) => !Number.isNaN(date.getTime()));
}

/**
 * Build a continuous, chronologically sorted registration time series for a
 * custom date range. Grouping is chosen automatically from the span length.
 */
export function buildRegistrationTrendSeries(input: {
  registrations: Registration[];
  events: Event[];
  city?: string | "all";
  from: string;
  to: string;
}): RegistrationTrendSeries {
  const fromDate = parseInputDate(input.from);
  const toDate = parseInputDate(input.to);
  if (!fromDate || !toDate) {
    return {
      grouping: "day",
      from: input.from,
      to: input.to,
      total: 0,
      points: [],
    };
  }

  const rangeStart = startOfDay(fromDate <= toDate ? fromDate : toDate);
  const rangeEnd = endOfDay(fromDate <= toDate ? toDate : fromDate);
  const rangeEndDay = startOfDay(fromDate <= toDate ? toDate : fromDate);
  const daySpan = inclusiveDaySpan(rangeStart, rangeEndDay);
  const grouping = resolveTrendGrouping(daySpan);
  const rangeSpansYears = rangeStart.getFullYear() !== rangeEndDay.getFullYear();

  const timestamps = filterScopedStudentTimestamps(
    input.registrations,
    input.events,
    input.city ?? "all"
  ).filter((date) => date >= rangeStart && date <= rangeEnd);

  const counts = new Map<number, number>();
  for (const date of timestamps) {
    const key = bucketStartForGrouping(date, grouping).getTime();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const firstBucket = bucketStartForGrouping(rangeStart, grouping);
  const lastBucket = bucketStartForGrouping(rangeEndDay, grouping);
  const points: RegistrationTrendPoint[] = [];
  let cursor = firstBucket;
  let total = 0;

  while (cursor.getTime() <= lastBucket.getTime()) {
    const key = cursor.getTime();
    const value = counts.get(key) ?? 0;
    total += value;
    points.push({
      name: formatBucketLabel(cursor, grouping, rangeSpansYears),
      value,
      bucketStart: toInputDate(cursor),
    });
    cursor = nextBucketStart(cursor, grouping);
  }

  return {
    grouping,
    from: toInputDate(rangeStart),
    to: toInputDate(rangeEndDay),
    total,
    points,
  };
}

export function groupingLabel(grouping: RegistrationTrendGrouping): string {
  switch (grouping) {
    case "day":
      return "Grouped by day";
    case "week":
      return "Grouped by week";
    case "month":
      return "Grouped by month";
    case "quarter":
      return "Grouped by quarter";
    case "year":
      return "Grouped by year";
  }
}

// Re-export for callers that need week helpers alongside series builders.
export { getIsoWeekParts, weekStartMonday };
