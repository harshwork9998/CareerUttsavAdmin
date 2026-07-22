import { resolveEventCity } from "@/lib/resolve-event-city";
import { isOperatingCity, OPERATING_CITIES } from "@/lib/operating-cities";
import type {
  ChartDataPoint,
  Event,
  InstitutionRanking,
  LiveRegistrationItem,
  OperatingCity,
  Registration,
  StudentRegistrationAnalytics,
} from "@/types";

function countBy(
  registrations: Registration[],
  getter: (registration: Registration) => string | undefined
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
  const match = classLabel.match(/Class (\d+)/);
  if (!match) return undefined;
  const grade = Number(match[1]);
  if (grade <= 8) return "lower";
  if (grade >= 9) return "core";
  return undefined;
}

function buildByClass(registrations: Registration[]): ChartDataPoint[] {
  const map = new Map<string, { value: number; segment?: "lower" | "core" }>();
  for (const registration of registrations) {
    const name = registration.classLabel?.trim();
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
      const grade = (label: string) =>
        Number(label.match(/Class (\d+)/)?.[1] ?? 0);
      return grade(String(a.name)) - grade(String(b.name));
    });
}

function buildBySeminar(registrations: Registration[]): ChartDataPoint[] {
  const map = new Map<string, number>();
  for (const registration of registrations) {
    for (const seminar of registration.seminarInterests ?? []) {
      const title = seminar.trim();
      if (!title) continue;
      map.set(title, (map.get(title) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function weekStartMonday(date: Date): Date {
  const day = new Date(date);
  const weekday = day.getDay();
  const diff = day.getDate() - weekday + (weekday === 0 ? -6 : 1);
  day.setDate(diff);
  day.setHours(0, 0, 0, 0);
  return day;
}

const MONTH_INDEX: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

function parseWeekLabel(label: string): number {
  const [dayText, monthText] = label.split(" ");
  const month = MONTH_INDEX[monthText] ?? 0;
  const day = Number(dayText) || 1;
  return new Date(2026, month, day).getTime();
}

function buildWeeklyTrend(registrations: Registration[]): ChartDataPoint[] {
  const map = new Map<string, number>();
  for (const registration of registrations) {
    const label = weekStartMonday(new Date(registration.registeredAt)).toLocaleDateString(
      "en-IN",
      { day: "numeric", month: "short" }
    );
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => parseWeekLabel(a[0]) - parseWeekLabel(b[0]))
    .map(([name, value]) => ({ name, value }));
}

function buildTopSchools(
  registrations: Registration[],
  city?: OperatingCity
): InstitutionRanking[] {
  return countBy(registrations, (registration) => registration.college)
    .slice(0, 8)
    .map((row) => ({
      name: String(row.name),
      value: Number(row.value),
      ...(city ? { city } : {}),
    }));
}

function buildLiveFeed(registrations: Registration[]): LiveRegistrationItem[] {
  return [...registrations]
    .sort(
      (a, b) =>
        new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()
    )
    .slice(0, 12)
    .map((registration) => ({
      id: registration.id,
      studentName: registration.studentName,
      classLabel: registration.classLabel ?? "Class 10",
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
  registrations: Registration[],
  events: Event[],
  city: OperatingCity | "all"
): Registration[] {
  const eventIds = new Set(events.map((event) => event.id));
  const eventCityById = new Map(events.map((event) => [event.id, event.city]));

  const scoped = registrations.filter((registration) =>
    eventIds.has(registration.eventId)
  );

  if (city === "all") {
    return scoped.filter((registration) => {
      const eventCity = resolveEventCity(registration, eventCityById);
      return eventCity && isOperatingCity(eventCity);
    });
  }

  return scoped.filter(
    (registration) =>
      resolveEventCity(registration, eventCityById) === city
  );
}

export function buildStudentRegistrationAnalytics(
  registrations: Registration[],
  events: Event[],
  city: OperatingCity | "all"
): StudentRegistrationAnalytics {
  const filtered = filterRegistrationsForScope(registrations, events, city);
  const today = startOfToday();

  const todayCount = filtered.filter((registration) => {
    const registeredOn = new Date(registration.registeredAt);
    registeredOn.setHours(0, 0, 0, 0);
    return registeredOn.getTime() === today.getTime();
  }).length;

  const byCity =
    city === "all"
      ? OPERATING_CITIES.map((operatingCity) => ({
          name: operatingCity,
          value: filterRegistrationsForScope(
            registrations,
            events,
            operatingCity
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
