import { seminarTitlesMatch } from "@/features/dashboard/seminars";
import { citiesMatch, getEventCities } from "@/lib/event-cities";
import { isStudentRegistration } from "@/lib/registration-kinds";
import { canonicalizeClassLabel } from "@/lib/registration-validation";
import { resolveEventCity } from "@/lib/resolve-event-city";
import type { ChartDataPoint, Event, Registration, StudentRegistration } from "@/types";

export interface LiveSeminarCityBreakdown {
  city: string;
  total: number;
  byClass: ChartDataPoint[];
}

export interface LiveSeminarBreakdown {
  name: string;
  total: number;
  byCity: LiveSeminarCityBreakdown[];
}

export interface LiveSeminarCityProfile {
  name: string;
  city: string;
  total: number;
  byGender: ChartDataPoint[];
  byClass: ChartDataPoint[];
  byBoard: ChartDataPoint[];
  byStream: ChartDataPoint[];
}

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

function buildByClass(registrations: StudentRegistration[]): ChartDataPoint[] {
  const map = new Map<string, number>();
  for (const registration of registrations) {
    const name = canonicalizeClassLabel(registration.classLabel);
    if (!name) continue;
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => {
      const classNumber = (label: string) =>
        Number(label.match(/Class (\d+)/)?.[1] ?? 0);
      return classNumber(a.name) - classNumber(b.name);
    });
}

function registrationHasSeminar(
  registration: StudentRegistration,
  seminarName: string
): boolean {
  return (registration.seminarInterests ?? []).some((seminar) =>
    seminarTitlesMatch(seminar, seminarName)
  );
}

function filterRegistrationsForSeminar(
  registrations: Registration[],
  events: Event[],
  seminarName: string,
  city?: string
): StudentRegistration[] {
  const eventIds = new Set(events.map((event) => event.id));
  const eventCityById = new Map(events.map((event) => [event.id, event.city]));

  return registrations.filter(
    (registration): registration is StudentRegistration => {
      if (!isStudentRegistration(registration)) return false;
      if (!eventIds.has(registration.eventId)) return false;
      if (!registrationHasSeminar(registration, seminarName)) return false;
      if (!city) return true;
      const eventCity = resolveEventCity(registration, eventCityById);
      return eventCity ? citiesMatch(eventCity, city) : false;
    }
  );
}

export function buildLiveSeminarBreakdown(
  registrations: Registration[],
  events: Event[],
  seminarName: string
): LiveSeminarBreakdown {
  const eventCities = getEventCities(events);
  const allForSeminar = filterRegistrationsForSeminar(
    registrations,
    events,
    seminarName
  );

  const byCity = eventCities.map((city) => {
    const filtered = filterRegistrationsForSeminar(
      registrations,
      events,
      seminarName,
      city
    );
    return {
      city,
      total: filtered.length,
      byClass: buildByClass(filtered),
    };
  });

  return {
    name: seminarName,
    total: allForSeminar.length,
    byCity,
  };
}

export function buildLiveSeminarCityProfile(
  registrations: Registration[],
  events: Event[],
  seminarName: string,
  city: string
): LiveSeminarCityProfile {
  const filtered = filterRegistrationsForSeminar(
    registrations,
    events,
    seminarName,
    city
  );

  return {
    name: seminarName,
    city,
    total: filtered.length,
    byGender: countBy(filtered, (registration) => registration.gender),
    byClass: buildByClass(filtered),
    byBoard: countBy(filtered, (registration) => registration.board),
    byStream: countBy(
      filtered,
      (registration) => registration.interestedStream
    ),
  };
}
