import { buildPartnerSalesAnalytics } from "@/lib/build-dashboard-partner-analytics";
import { buildStudentRegistrationAnalytics } from "@/lib/build-dashboard-student-analytics";
import { getEventCities } from "@/lib/event-cities";
import type {
  CityDashboardSlice,
  DashboardData,
  Event,
  Partner,
  Registration,
} from "@/types";

function getCitySliceTemplate(
  base: DashboardData,
  city: string
): CityDashboardSlice {
  if (base.citySlices[city]) {
    return base.citySlices[city];
  }
  const fallback =
    base.citySlices.Bangalore ??
    base.citySlices.Mysore ??
    base.citySlices.Hubli ??
    Object.values(base.citySlices)[0];
  if (!fallback) {
    throw new Error("Dashboard mock data is missing city slices.");
  }
  return fallback;
}

/** Overlay live student and partner analytics onto dashboard mock slices. */
export function buildDashboardData(
  base: DashboardData,
  registrations: Registration[],
  events: Event[],
  partners: Partner[]
): DashboardData {
  const eventCities = getEventCities(events);
  const consolidatedStudents = buildStudentRegistrationAnalytics(
    registrations,
    events,
    "all"
  );
  const consolidatedPartners = buildPartnerSalesAnalytics(
    partners,
    events,
    "all",
    eventCities
  );

  const citySlices: Record<string, CityDashboardSlice> = {};
  for (const city of eventCities) {
    citySlices[city] = {
      ...getCitySliceTemplate(base, city),
      studentRegistration: buildStudentRegistrationAnalytics(
        registrations,
        events,
        city
      ),
      partnerSales: buildPartnerSalesAnalytics(
        partners,
        events,
        city,
        eventCities
      ),
    };
  }

  return {
    ...base,
    eventCities,
    studentRegistration: consolidatedStudents,
    partnerSales: consolidatedPartners,
    citySlices,
    registrationsByCity: consolidatedStudents.byRegistrantCity.slice(0, 8),
  };
}
