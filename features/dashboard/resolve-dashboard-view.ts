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
  OperatingCity,
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

function isOperatingCity(value: DashboardCityFilter): value is OperatingCity {
  return value === "Bangalore" || value === "Mysore" || value === "Hubli";
}

export function resolveDashboardView(
  dashboard: DashboardData,
  cityFilter: DashboardCityFilter
): ResolvedDashboardView {
  if (isOperatingCity(cityFilter)) {
    const slice: CityDashboardSlice = dashboard.citySlices[cityFilter];
    return {
      cityFilter,
      cityLabel: cityFilter,
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
