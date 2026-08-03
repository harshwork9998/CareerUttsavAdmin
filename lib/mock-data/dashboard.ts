import type {
  DashboardData,
  PartnerSalesAnalytics,
  StudentRegistrationAnalytics,
} from "@/types";
import {
  buildAllCitiesRegistrationsByCity,
  mockCitySlices,
  OPERATING_CITIES,
} from "@/lib/mock-data/dashboard-city-slices";
import { CAREER_UTTSAV_SEMINARS, SEMINAR_POPULARITY } from "@/features/dashboard/seminars";

function sumChart(
  pick: (city: (typeof mockCitySlices)[keyof typeof mockCitySlices]) => Array<{ name: string; value: number }>
) {
  const map = new Map<string, number>();
  for (const city of OPERATING_CITIES) {
    for (const row of pick(mockCitySlices[city])) {
      map.set(String(row.name), (map.get(String(row.name)) ?? 0) + Number(row.value));
    }
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function buildAllCitiesStudentRegistration(): StudentRegistrationAnalytics {
  const slices = OPERATING_CITIES.map((c) => mockCitySlices[c].studentRegistration);
  const total = slices.reduce((s, x) => s + x.total, 0);
  const todayCount = slices.reduce((s, x) => s + x.todayCount, 0);
  const weightSum = Object.values(SEMINAR_POPULARITY).reduce((s, w) => s + w, 0) || 1;
  const bySeminar = CAREER_UTTSAV_SEMINARS.map((name) => ({
    name,
    value: Math.max(1, Math.round(((SEMINAR_POPULARITY[name] ?? 20) / weightSum) * total * 0.85)),
  })).sort((a, b) => b.value - a.value);

  return {
    total,
    todayCount,
    byClass: (() => {
      const map = new Map<string, { value: number; segment?: string | number }>();
      for (const city of OPERATING_CITIES) {
        for (const row of mockCitySlices[city].studentRegistration.byClass) {
          const prev = map.get(String(row.name));
          map.set(String(row.name), {
            value: (prev?.value ?? 0) + Number(row.value),
            segment: row.segment ?? prev?.segment,
          });
        }
      }
      return Array.from(map.entries()).map(([name, v]) => ({
        name,
        value: v.value,
        ...(v.segment !== undefined ? { segment: v.segment } : {}),
      }));
    })(),
    byStream: sumChart((s) => s.studentRegistration.byStream),
    byBoard: sumChart((s) => s.studentRegistration.byBoard),
    byGender: sumChart((s) => s.studentRegistration.byGender),
    byCity: buildAllCitiesRegistrationsByCity(),
    byRegistrantCity: sumChart((s) => s.studentRegistration.byRegistrantCity),
    bySeminar,
    weeklyTrend: (() => {
      const map = new Map<string, number>();
      for (const city of OPERATING_CITIES) {
        for (const row of mockCitySlices[city].studentRegistration.weeklyTrend ??
          []) {
          map.set(
            String(row.name),
            (map.get(String(row.name)) ?? 0) + Number(row.value)
          );
        }
      }
      // Preserve chronological order from first city slice
      const order =
        mockCitySlices.Bangalore.studentRegistration.weeklyTrend?.map((r) =>
          String(r.name)
        ) ?? Array.from(map.keys());
      return order.map((name) => ({ name, value: map.get(name) ?? 0 }));
    })(),
    topSchools: OPERATING_CITIES.flatMap((c) =>
      mockCitySlices[c].studentRegistration.topSchools.map((school) => ({
        ...school,
        city: school.city ?? c,
      }))
    )
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    liveFeed: OPERATING_CITIES.flatMap(
      (c) => mockCitySlices[c].studentRegistration.liveFeed
    )
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, 12),
  };
}

function buildAllCitiesPartnerSales(): PartnerSalesAnalytics {
  const slices = OPERATING_CITIES.map((c) => mockCitySlices[c].partnerSales);
  const confirmed = slices.reduce((s, x) => s + x.confirmed, 0);
  const inProcess = slices.reduce(
    (s, x) => s + (x.inDiscussion ?? x.inProcess ?? 0),
    0
  );
  const lost = slices.reduce(
    (s, x) => s + (x.notProceeding ?? x.lost ?? 0),
    0
  );
  const stageMap = new Map<string, { count: number; amount: number }>();
  for (const slice of slices) {
    for (const stage of slice.byStage) {
      let name = String(stage.name);
      if (name === "Discussion" || name === "Proposal Sent") name = "Negotiation";
      const prev = stageMap.get(name) ?? { count: 0, amount: 0 };
      stageMap.set(name, {
        count: prev.count + stage.count,
        amount: prev.amount + stage.amount,
      });
    }
  }

  return {
    totalPartners: slices.reduce((s, x) => s + x.totalPartners, 0),
    confirmed,
    inDiscussion: inProcess,
    notProceeding: lost,
    inProcess,
    lost,
    pipelineValue: slices.reduce((s, x) => s + (x.pipelineValue ?? 0), 0),
    wonValue: slices.reduce((s, x) => s + (x.wonValue ?? 0), 0),
    byTier: sumChart((s) => s.partnerSales.byTier),
    byStage: Array.from(stageMap.entries()).map(([name, v]) => ({
      name: name as PartnerSalesAnalytics["byStage"][number]["name"],
      count: v.count,
      amount: v.amount,
    })),
    byStatus: [
      { name: "Confirmed", value: confirmed },
      { name: "In Discussion", value: inProcess },
      { name: "Not Proceeding", value: lost },
    ],
    byCity: OPERATING_CITIES.map((c) => ({
      name: c,
      value: mockCitySlices[c].partnerSales.confirmed,
    })),
    tierProgress: mockCitySlices.Bangalore.partnerSales.tierProgress,
    recentActivity: OPERATING_CITIES.flatMap(
      (c) => mockCitySlices[c].partnerSales.recentActivity
    )
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, 10),
    deals: OPERATING_CITIES.flatMap((c) => mockCitySlices[c].partnerSales.deals),
  };
}

export const mockDashboardData: DashboardData = {
  kpis: [
    {
      id: "kpi-registrations",
      label: "Total Registrations",
      value: 43620,
      change: 18.4,
      changeType: "increase",
      format: "number",
    },
    {
      id: "kpi-events",
      label: "Active Events",
      value: 3,
      change: 0,
      changeType: "neutral",
      format: "number",
    },
    {
      id: "kpi-universities",
      label: "Approved Universities",
      value: 12,
      change: 2,
      changeType: "increase",
      format: "number",
    },
    {
      id: "kpi-revenue",
      label: "Registration Revenue",
      value: 9845000,
      change: 22.1,
      changeType: "increase",
      format: "currency",
    },
    {
      id: "kpi-checkins",
      label: "Check-ins Today",
      value: 6780,
      change: 45.2,
      changeType: "increase",
      format: "number",
    },
    {
      id: "kpi-conversion",
      label: "Registration Conversion",
      value: 72.5,
      change: 3.8,
      changeType: "increase",
      format: "percentage",
    },
  ],
  registrationTrend: [
    { name: "Jan", value: 1200, registrations: 1200 },
    { name: "Feb", value: 980, registrations: 980 },
    { name: "Mar", value: 1450, registrations: 1450 },
    { name: "Apr", value: 2100, registrations: 2100 },
    { name: "May", value: 3200, registrations: 3200 },
    { name: "Jun", value: 5800, registrations: 5800 },
    { name: "Jul", value: 8400, registrations: 8400 },
  ],
  eventPerformance: [
    { name: "Delhi NCR", value: 12450, registrations: 12450, checkIns: 6780 },
    { name: "Bengaluru", value: 8420, registrations: 8420, checkIns: 0 },
    { name: "Mumbai", value: 11890, registrations: 11890, checkIns: 9340 },
    { name: "Hyderabad", value: 3210, registrations: 3210, checkIns: 0 },
    { name: "Pune", value: 7650, registrations: 7650, checkIns: 6120 },
  ],
  registrationsByCity: [
    { name: "New Delhi", value: 4200 },
    { name: "Bengaluru", value: 3800 },
    { name: "Mumbai", value: 5100 },
    { name: "Hyderabad", value: 2100 },
    { name: "Pune", value: 2900 },
    { name: "Noida", value: 1800 },
    { name: "Chennai", value: 950 },
    { name: "Others", value: 3200 },
  ],
  registrationsByStatus: [
    { name: "Confirmed", value: 18500 },
    { name: "Checked In", value: 22240 },
    { name: "Pending", value: 890 },
    { name: "Cancelled", value: 1990 },
  ],
  recentActivities: [
    {
      id: "ra-001",
      type: "registration",
      title: "New registration",
      description: "Kavya Iyer registered for Delhi NCR 2026",
      timestamp: "2026-07-09T07:30:00+05:30",
      link: "/registrations/reg-030",
    },
    {
      id: "ra-002",
      type: "event",
      title: "Event live",
      description: "Career Uttsav Delhi NCR 2026 is now live",
      timestamp: "2026-07-05T08:00:00+05:30",
      link: "/events/evt-002",
    },
    {
      id: "ra-003",
      type: "university",
      title: "University pending",
      description: "LPU application submitted for review",
      timestamp: "2026-06-28T10:00:00+05:30",
      link: "/universities/uni-015",
    },
    {
      id: "ra-004",
      type: "partner",
      title: "Partner confirmed",
      description: "Knowledge Partner package confirmed for Bangalore",
      timestamp: "2026-06-25T09:00:00+05:30",
      link: "/partners",
    },
    {
      id: "ra-005",
      type: "registration",
      title: "Check-in recorded",
      description: "Mohammed Faizan checked in at Delhi NCR",
      timestamp: "2026-07-06T10:00:00+05:30",
      link: "/registrations/reg-029",
    },
    {
      id: "ra-006",
      type: "partner",
      title: "Partner onboarded",
      description: "Zoho Corporation joined as Technology Partner",
      timestamp: "2026-05-01T10:00:00+05:30",
      link: "/partners/ptr-012",
    },
    {
      id: "ra-007",
      type: "system",
      title: "Registration fee updated",
      description: "Registration fee updated to ₹299",
      timestamp: "2026-06-01T11:00:00+05:30",
    },
  ],
  upcomingTasks: [
    {
      id: "task-001",
      title: "Review LPU university application",
      priority: "High",
      dueDate: "2026-07-12T17:00:00+05:30",
      status: "Pending",
      assignedTo: "usr-002",
      relatedResource: "university",
    },
    {
      id: "task-002",
      title: "Approve Amity University document updates",
      priority: "High",
      dueDate: "2026-07-15T17:00:00+05:30",
      status: "In Progress",
      assignedTo: "usr-002",
      relatedResource: "university",
    },
    {
      id: "task-003",
      title: "Follow up Bangalore stall partner pipeline",
      priority: "Medium",
      dueDate: "2026-07-20T17:00:00+05:30",
      status: "Pending",
      assignedTo: "usr-004",
      relatedResource: "partner",
    },
    {
      id: "task-004",
      title: "Review Bengaluru early bird registration pace",
      priority: "Medium",
      dueDate: "2026-07-25T10:00:00+05:30",
      status: "Pending",
      assignedTo: "usr-003",
      relatedResource: "registration",
    },
    {
      id: "task-005",
      title: "Confirm Hyderabad venue floor plan",
      priority: "Low",
      dueDate: "2026-07-18T17:00:00+05:30",
      status: "In Progress",
      assignedTo: "usr-009",
      relatedResource: "event",
    },
    {
      id: "task-006",
      title: "Generate Delhi NCR post-event report",
      priority: "High",
      dueDate: "2026-07-10T17:00:00+05:30",
      status: "Pending",
      assignedTo: "usr-008",
      relatedResource: "report",
    },
  ],
  upcomingEvents: [
    {
      id: "evt-002",
      title: "Career Uttsav Delhi NCR 2026",
      startDate: "2026-07-05T10:00:00+05:30",
      city: "New Delhi",
      status: "Live",
      registrationCount: 12450,
      maxCapacity: 20000,
    },
    {
      id: "evt-001",
      title: "Career Uttsav Bengaluru 2026",
      startDate: "2026-08-15T09:00:00+05:30",
      city: "Bengaluru",
      status: "Published",
      registrationCount: 8420,
      maxCapacity: 15000,
    },
    {
      id: "evt-003",
      title: "Career Uttsav Hubli 2025",
      startDate: "2025-12-10T09:30:00+05:30",
      city: "Hubli",
      status: "Completed",
      registrationCount: 5890,
      maxCapacity: 6000,
    },
    {
      id: "evt-006",
      title: "Career Uttsav Chennai 2026",
      startDate: "2026-11-08T09:00:00+05:30",
      city: "Chennai",
      status: "Draft",
      registrationCount: 0,
      maxCapacity: 10000,
    },
  ],
  targets: [
    {
      id: "tgt-students",
      label: "Student registrations",
      current: 43620,
      target: 50000,
      format: "number",
      periodLabel: "This season",
    },
    {
      id: "tgt-partners",
      label: "Confirmed universities",
      current: 34,
      target: 50,
      format: "number",
      periodLabel: "This season",
    },
  ],
  insights: [
    {
      id: "ins-001",
      severity: "info",
      title: "Bangalore leads registrations",
      description: "Over half of students joining are from Bangalore.",
    },
  ],
  studentRegistration: buildAllCitiesStudentRegistration(),
  partnerSales: buildAllCitiesPartnerSales(),
  eventCities: [...OPERATING_CITIES],
  citySlices: mockCitySlices,
};
