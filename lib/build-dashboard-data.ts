import { buildPartnerSalesAnalytics } from "@/lib/build-dashboard-partner-analytics";
import { buildStudentRegistrationAnalytics } from "@/lib/build-dashboard-student-analytics";import { OPERATING_CITIES } from "@/lib/operating-cities";
import type {
  DashboardData,
  Event,
  Partner,
  Registration,
} from "@/types";

/** Overlay live student and partner analytics onto dashboard mock slices. */
export function buildDashboardData(
  base: DashboardData,
  registrations: Registration[],
  events: Event[],
  partners: Partner[]
): DashboardData {
  const consolidatedStudents = buildStudentRegistrationAnalytics(
    registrations,
    events,
    "all"
  );
  const consolidatedPartners = buildPartnerSalesAnalytics(partners, "all");

  const citySlices = { ...base.citySlices };
  for (const city of OPERATING_CITIES) {
    citySlices[city] = {
      ...citySlices[city],
      studentRegistration: buildStudentRegistrationAnalytics(
        registrations,
        events,
        city
      ),
      partnerSales: buildPartnerSalesAnalytics(partners, city),
    };
  }

  return {
    ...base,
    studentRegistration: consolidatedStudents,
    partnerSales: consolidatedPartners,
    citySlices,
    registrationsByCity: consolidatedStudents.byRegistrantCity.slice(0, 8),
  };
}
