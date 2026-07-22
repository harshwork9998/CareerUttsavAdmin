import { citiesMatch } from "@/lib/event-cities";
import type {
  CityComparisonMetric,
  CityDashboardSlice,
  DashboardCityFilter,
  DashboardData,
  DashboardInsight,
  DashboardKPI,
  DashboardTarget,
  PartnerSalesAnalytics,
  RecentActivity,
  DashboardTask,
  UpcomingEventSummary,
  StudentRegistrationAnalytics,
  ChartDataPoint,
} from "@/types";

export interface ResolvedDashboardView {
  cityFilter: DashboardCityFilter;
  cityLabel: string;
  isAllCities: boolean;
  kpis: DashboardKPI[];
  targets: DashboardTarget[];
  insights: DashboardInsight[];
  registrationTrend: ChartDataPoint[];
  eventPerformance: ChartDataPoint[];
  registrationsByCity: ChartDataPoint[];
  registrationsByStatus: ChartDataPoint[];
  recentActivities: RecentActivity[];
  upcomingTasks: DashboardTask[];
  upcomingEvents: UpcomingEventSummary[];
  studentRegistration: StudentRegistrationAnalytics;
  partnerSales: PartnerSalesAnalytics;
  vsAverage: CityComparisonMetric[];
  partnerWonValue: number;
}

function resolveCitySlice(
  dashboard: DashboardData,
  cityFilter: string
): CityDashboardSlice | undefined {
  const direct = dashboard.citySlices[cityFilter];
  if (direct) return direct;

  const matchedCity = dashboard.eventCities.find((city) =>
    citiesMatch(city, cityFilter)
  );
  return matchedCity ? dashboard.citySlices[matchedCity] : undefined;
}

export function resolveDashboardView(
  dashboard: DashboardData,
  cityFilter: DashboardCityFilter
): ResolvedDashboardView {
  if (cityFilter !== "all") {
    const slice = resolveCitySlice(dashboard, cityFilter);
    if (slice) {
      const cityLabel =
        dashboard.eventCities.find((city) => citiesMatch(city, cityFilter)) ??
        cityFilter;
      return {
        cityFilter: cityLabel,
        cityLabel,
        isAllCities: false,
        kpis: slice.kpis,
        targets: slice.targets,
        insights: slice.insights,
        registrationTrend: slice.registrationTrend,
        eventPerformance: slice.eventPerformance,
        registrationsByCity: dashboard.registrationsByCity,
        registrationsByStatus: slice.registrationsByStatus,
        recentActivities: slice.recentActivities,
        upcomingTasks: slice.upcomingTasks,
        upcomingEvents: slice.upcomingEvents,
        studentRegistration: slice.studentRegistration,
        partnerSales: slice.partnerSales,
        vsAverage: slice.vsAverage,
        partnerWonValue: slice.partnerSales.wonValue ?? 0,
      };
    }
  }

  return {
    cityFilter: "all",
    cityLabel: "All Cities",
    isAllCities: true,
    kpis: dashboard.kpis,
    targets: dashboard.targets,
    insights: dashboard.insights,
    registrationTrend: dashboard.registrationTrend,
    eventPerformance: dashboard.eventPerformance,
    registrationsByCity: dashboard.registrationsByCity,
    registrationsByStatus: dashboard.registrationsByStatus,
    recentActivities: dashboard.recentActivities,
    upcomingTasks: dashboard.upcomingTasks,
    upcomingEvents: dashboard.upcomingEvents,
    studentRegistration: dashboard.studentRegistration,
    partnerSales: dashboard.partnerSales,
    vsAverage: [],
    partnerWonValue: dashboard.partnerSales.wonValue ?? 0,
  };
}
