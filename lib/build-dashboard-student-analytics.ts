import { canonicalizeSeminarTitle } from "@/features/dashboard/seminars";
import { isStudentRegistration } from "@/lib/registration-kinds";
import { canonicalizeClassLabel } from "@/lib/registration-validation";
import { resolveEventCity } from "@/lib/resolve-event-city";
import { citiesMatch, getEventCities } from "@/lib/event-cities";
import type {
  ChartDataPoint,
  Event,
  InstitutionRanking,
  LiveRegistrationItem,
  Registration,
  StudentRegistration,
  StudentRegistrationAnalytics,
} from "@/types";

function countBy(
  registrations: StudentRegistration[],
  getter: (registration: StudentRegistration) => string | undefined
): ChartDataPoint[] {
  const map = new Map<string, number>();
  for (const registration of registrations) {
    const key = getter(registration)?.trim();
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function classSegment(classLabel: string): "lower" | "core" | undefined {
  const match = classLabel.match(/Class\s*(\d+)/i);
  if (!match) return undefined;
  const classNumber = Number(match[1]);
  if (classNumber <= 8) return "lower";
  if (classNumber >= 9) return "core";
  return undefined;
}

function buildByClass(registrations: StudentRegistration[]): ChartDataPoint[] {
  const map = new Map<string, { value: number; segment?: "lower" | "core" }>();
  for (const registration of registrations) {
    const name = canonicalizeClassLabel(registration.classLabel);
    if (!name) continue;
    const prev = map.get(name);
    map.set(name, {
      value: (prev?.value ?? 0) + 1,
      segment: classSegment(name) ?? prev?.segment,
    });
  }
  return Array.from(map.entries())
    .map(([name, row]) => ({
      name,
      value: row.value,
      ...(row.segment ? { segment: row.segment } : {}),
    }))
    .sort((a, b) => {
      const classNumber = (label: string) =>
        Number(label.match(/Class (\d+)/)?.[1] ?? 0);
      return classNumber(String(a.name)) - classNumber(String(b.name));
    });
}

function buildBySeminar(registrations: StudentRegistration[]): ChartDataPoint[] {
  const map = new Map<string, number>();
  for (const registration of registrations) {
    for (const seminar of registration.seminarInterests ?? []) {
      const title = canonicalizeSeminarTitle(seminar);
      if (!title) continue;
      map.set(title, (map.get(title) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function weekStartMonday(date: Date): Date {
  const day = new Date(date);
  const weekday = day.getDay();
  const diff = day.getDate() - weekday + (weekday === 0 ? -6 : 1);
  day.setDate(diff);
  day.setHours(0, 0, 0, 0);
  return day;
}

/**
 * ISO week number for a date (weeks start Monday; week 1 contains the year's first Thursday).
 */
export function getIsoWeekParts(date: Date): { week: number; year: number } {
  const monday = weekStartMonday(date);
  // Thursday of this week decides the ISO week-year.
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  const year = thursday.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const week1Monday = weekStartMonday(jan4);
  const week =
    Math.round((monday.getTime() - week1Monday.getTime()) / (7 * 86_400_000)) +
    1;
  return { week, year };
}

/** Locale-stable week label using the ISO week number. */
export function formatWeekLabel(date: Date): string {
  const { week, year } = getIsoWeekParts(date);
  return `Week ${week}, ${year}`;
}

function buildWeeklyTrend(registrations: StudentRegistration[]): ChartDataPoint[] {
  const map = new Map<string, { value: number; sortKey: number }>();
  for (const registration of registrations) {
    const raw = registration.registeredAt;
    if (!raw) continue;
    const registeredOn = new Date(raw);
    if (Number.isNaN(registeredOn.getTime())) continue;
    const weekStart = weekStartMonday(registeredOn);
    const label = formatWeekLabel(weekStart);
    const prev = map.get(label);
    map.set(label, {
      value: (prev?.value ?? 0) + 1,
      sortKey: weekStart.getTime(),
    });
  }
  return Array.from(map.entries())
    .sort((a, b) => a[1].sortKey - b[1].sortKey)
    .map(([name, row]) => ({ name, value: row.value }));
}

function buildTopSchools(
  registrations: StudentRegistration[],
  city?: string
): InstitutionRanking[] {
  return countBy(registrations, (registration) => registration.college)
    .slice(0, 8)
    .map((row) => ({
      name: String(row.name),
      value: Number(row.value),
      ...(city ? { city } : {}),
    }));
}

function buildLiveFeed(registrations: StudentRegistration[]): LiveRegistrationItem[] {
  return [...registrations]
    .sort(
      (a, b) =>
        new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()
    )
    .slice(0, 12)
    .map((registration) => ({
      id: registration.id,
      studentName: registration.studentName,
      classLabel: canonicalizeClassLabel(registration.classLabel) || "Class 10",
      stream: registration.interestedStream,
      board: registration.board,
      school: registration.college,
      city: registration.city,
      seminar: registration.seminarInterests?.[0],
      timestamp: registration.registeredAt,
    }));
}

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function filterRegistrationsForScope(
  registrations: StudentRegistration[],
  events: Event[],
  city: string | "all"
): StudentRegistration[] {
  const eventIds = new Set(events.map((event) => event.id));
  const eventCityById = new Map(events.map((event) => [event.id, event.city]));

  const scoped = registrations.filter((registration) =>
    eventIds.has(registration.eventId)
  );

  if (city === "all") {
    return scoped;
  }

  return scoped.filter((registration) => {
    const eventCity = resolveEventCity(registration, eventCityById);
    return eventCity ? citiesMatch(eventCity, city) : false;
  });
}

/** ISO timestamps for student registrations in the same city/event scope as analytics. */
export function getScopedStudentRegistrationDates(
  registrations: Registration[],
  events: Event[],
  city: string | "all"
): string[] {
  const studentRegistrations = registrations.filter(isStudentRegistration);
  return filterRegistrationsForScope(studentRegistrations, events, city)
    .map((registration) => registration.registeredAt)
    .filter((value): value is string => Boolean(value));
}

export function buildStudentRegistrationAnalytics(
  registrations: Registration[],
  events: Event[],
  city: string | "all"
): StudentRegistrationAnalytics {
  const studentRegistrations = registrations.filter(isStudentRegistration);
  const filtered = filterRegistrationsForScope(studentRegistrations, events, city);
  const eventCities = getEventCities(events);
  const today = startOfToday();

  const todayCount = filtered.filter((registration) => {
    const registeredOn = new Date(registration.registeredAt);
    registeredOn.setHours(0, 0, 0, 0);
    return registeredOn.getTime() === today.getTime();
  }).length;

  const byCity =
    city === "all"
      ? eventCities.map((eventCity) => ({
          name: eventCity,
          value: filterRegistrationsForScope(
            studentRegistrations,
            events,
            eventCity
          ).length,
        })).filter((row) => row.value > 0)
      : [{ name: city, value: filtered.length }];

  return {
    total: filtered.length,
    todayCount,
    byClass: buildByClass(filtered),
    byStream: countBy(filtered, (registration) => registration.interestedStream),
    byBoard: countBy(filtered, (registration) => registration.board),
    byGender: countBy(filtered, (registration) => registration.gender),
    byCity,
    byRegistrantCity: countBy(filtered, (registration) => registration.city),
    bySeminar: buildBySeminar(filtered),
    weeklyTrend: buildWeeklyTrend(filtered),
    topSchools: buildTopSchools(
      filtered,
      city === "all" ? undefined : city
    ),
    liveFeed: buildLiveFeed(filtered),
  };
}
