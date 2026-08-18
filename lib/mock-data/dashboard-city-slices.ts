import type {
  ChartDataPoint,
  CityComparisonMetric,
  CityDashboardSlice,
  DashboardInsight,
  DashboardKPI,
  DashboardTarget,
  OperatingCity,
  PartnerSalesAnalytics,
  RecentActivity,
  DashboardTask,
  UpcomingEventSummary,
  StudentRegistrationAnalytics,
} from "@/types";
import { CAREER_UTTSAV_SEMINARS, SEMINAR_POPULARITY } from "@/features/dashboard/seminars";

export type { OperatingCity, CityComparisonMetric, CityDashboardSlice };

export const OPERATING_CITIES: OperatingCity[] = ["Bangalore"];

function buildSeminarInterest(total: number): ChartDataPoint[] {
  const weightSum = Object.values(SEMINAR_POPULARITY).reduce((s, w) => s + w, 0) || 1;
  return CAREER_UTTSAV_SEMINARS.map((name) => ({
    name,
    value: Math.max(
      1,
      Math.round(((SEMINAR_POPULARITY[name] ?? 20) / weightSum) * total * 0.85)
    ),
  })).sort((a, b) => b.value - a.value);
}

/** Week-start labels Mon Aug 3 → Mon Dec 28, 2026 */
const WEEKLY_TREND_LABELS_2026 = [
  "3 Aug",
  "10 Aug",
  "17 Aug",
  "24 Aug",
  "31 Aug",
  "7 Sep",
  "14 Sep",
  "21 Sep",
  "28 Sep",
  "5 Oct",
  "12 Oct",
  "19 Oct",
  "26 Oct",
  "2 Nov",
  "9 Nov",
  "16 Nov",
  "23 Nov",
  "30 Nov",
  "7 Dec",
  "14 Dec",
  "21 Dec",
  "28 Dec",
] as const;

/**
 * Ramp Aug → peak late Oct / early Nov → soft Dec taper.
 * Values scale so the series sums roughly to `total`.
 */
function buildWeeklyTrend2026(total: number, accent = 1): ChartDataPoint[] {
  const shape = [
    0.35, 0.42, 0.48, 0.55, 0.62, 0.7, 0.78, 0.88, 0.95, 1.05, 1.15, 1.22, 1.28,
    1.32, 1.3, 1.22, 1.12, 1.02, 0.92, 0.82, 0.72, 0.62,
  ];
  const weightSum = shape.reduce((s, w) => s + w * accent, 0) || 1;
  return WEEKLY_TREND_LABELS_2026.map((name, i) => ({
    name,
    value: Math.max(
      1,
      Math.round(((shape[i] ?? 1) * accent * total) / weightSum)
    ),
  }));
}

/** All-cities totals used for reconciliation (see mockDashboardData). */
const ALL_CITIES_REGISTRATIONS = 43620;
const ALL_CITIES_REVENUE = 9845000;
const ALL_CITIES_CHECKINS = 6780;
const ALL_CITIES_PIPELINE = 24850000;
const ALL_CITIES_CONVERSION = 72.5;
const CITY_COUNT = OPERATING_CITIES.length;

const AVG_REGISTRATIONS = Math.round(ALL_CITIES_REGISTRATIONS / CITY_COUNT);
const AVG_REVENUE = Math.round(ALL_CITIES_REVENUE / CITY_COUNT);
const AVG_CHECKINS = Math.round(ALL_CITIES_CHECKINS / CITY_COUNT);
const AVG_PIPELINE = Math.round(ALL_CITIES_PIPELINE / CITY_COUNT);
const AVG_CONVERSION = ALL_CITIES_CONVERSION;

function deltaVsAverage(cityValue: number, averageValue: number): number {
  if (averageValue === 0) return 0;
  return Math.round(((cityValue - averageValue) / averageValue) * 1000) / 10;
}

function buildVsAverage(metrics: {
  registrations: number;
  revenue: number;
  conversion: number;
  pipeline: number;
  checkIns: number;
}): CityComparisonMetric[] {
  return [
    {
      id: "vs-registrations",
      label: "Students joining",
      cityValue: metrics.registrations,
      averageValue: AVG_REGISTRATIONS,
      format: "number",
      deltaPercent: deltaVsAverage(metrics.registrations, AVG_REGISTRATIONS),
    },
    {
      id: "vs-checkins",
      label: "Activity today",
      cityValue: metrics.checkIns,
      averageValue: AVG_CHECKINS,
      format: "number",
      deltaPercent: deltaVsAverage(metrics.checkIns, AVG_CHECKINS),
    },
    {
      id: "vs-partners",
      label: "Partner conversations",
      cityValue: metrics.pipeline,
      averageValue: AVG_PIPELINE,
      format: "number",
      deltaPercent: deltaVsAverage(metrics.pipeline, AVG_PIPELINE),
    },
  ];
}

// ─── Bangalore (~52.3% volume) ──────────────────────────────────────────────

const bangaloreStudentRegistration: StudentRegistrationAnalytics = {
  total: 22800,
  target: 28000,
  todayCount: 218,
  weeklyGrowth: 16.8,
  dailyTrend: [
    { name: "Jun 26", value: 98 },
    { name: "Jun 27", value: 112 },
    { name: "Jun 28", value: 104 },
    { name: "Jun 29", value: 126 },
    { name: "Jun 30", value: 141 },
    { name: "Jul 1", value: 155 },
    { name: "Jul 2", value: 164 },
    { name: "Jul 3", value: 146 },
    { name: "Jul 4", value: 188 },
    { name: "Jul 5", value: 256 },
    { name: "Jul 6", value: 272 },
    { name: "Jul 7", value: 208 },
    { name: "Jul 8", value: 192 },
    { name: "Jul 9", value: 228 },
    { name: "Jul 10", value: 218 },
  ],
  byClass: [
    { name: "Class 4", value: 220, segment: "lower" },
    { name: "Class 5", value: 355, segment: "lower" },
    { name: "Class 6", value: 585, segment: "lower" },
    { name: "Class 7", value: 825, segment: "lower" },
    { name: "Class 8", value: 1220, segment: "lower" },
    { name: "Class 9", value: 3200, segment: "core" },
    { name: "Class 10", value: 4680, segment: "core" },
    { name: "Class 11", value: 5380, segment: "core" },
    { name: "Class 12", value: 6335, segment: "core" },
  ],
  byStream: [
    { name: "Science", value: 11240 },
    { name: "Commerce", value: 6720 },
    { name: "Arts", value: 4840 },
  ],
  byBoard: [
    { name: "CBSE", value: 9720 },
    { name: "State Board", value: 4860 },
    { name: "ICSE", value: 3920 },
    { name: "PUC", value: 2680 },
    { name: "IB / IGCSE", value: 1620 },
  ],
  byGender: [
    { name: "Female", value: 11190 },
    { name: "Male", value: 11610 },
  ],
  byCity: [{ name: "Bangalore", value: 22800 }],
  byRegistrantCity: [
    { name: "Bangalore", value: 14280 },
    { name: "Whitefield", value: 1860 },
    { name: "Electronic City", value: 1420 },
    { name: "Yelahanka", value: 1180 },
    { name: "Tumkur", value: 980 },
    { name: "Kolar", value: 720 },
    { name: "Chikkaballapur", value: 640 },
    { name: "Ramanagara", value: 520 },
    { name: "Other / Out of state", value: 1200 },
  ],
  bySeminar: buildSeminarInterest(22800),
  weeklyTrend: buildWeeklyTrend2026(22800, 1.08),
  bySession: [
    { name: "Morning", value: 9640 },
    { name: "Afternoon", value: 7980 },
    { name: "Evening", value: 5180 },
  ],
  bySource: [
    { name: "School Outreach", value: 8820 },
    { name: "Website", value: 5860 },
    { name: "Social Media", value: 3580 },
    { name: "Referral", value: 2680 },
    { name: "Partner", value: 1860 },
  ],
  topSchools: [
    { name: "National Public School, Indiranagar", value: 654, city: "Bangalore" },
    { name: "Bishop Cotton Boys' School", value: 582, city: "Bangalore" },
    { name: "Delhi Public School, East", value: 518, city: "Bangalore" },
    { name: "Inventure Academy", value: 476, city: "Bangalore" },
    { name: "The International School Bangalore", value: 442, city: "Bangalore" },
    { name: "Ryan International, HSR", value: 398, city: "Bangalore" },
  ],
  topColleges: [
    { name: "Christ University", value: 318, city: "Bangalore" },
    { name: "St. Joseph's College", value: 274, city: "Bangalore" },
    { name: "Mount Carmel College", value: 248, city: "Bangalore" },
    { name: "PES University", value: 226, city: "Bangalore" },
    { name: "Jain University", value: 198, city: "Bangalore" },
    { name: "RV College of Engineering", value: 172, city: "Bangalore" },
  ],
  liveFeed: [
    {
      id: "blr-live-001",
      studentName: "Diya Krishnan",
      classLabel: "Class 11",
      stream: "Commerce",
      board: "PUC",
      school: "Mount Carmel PU College",
      city: "Bangalore",
      timestamp: "2026-07-10T21:42:00+05:30",
    },
    {
      id: "blr-live-002",
      studentName: "Vivaan Joshi",
      classLabel: "Class 8",
      board: "CBSE",
      school: "Ryan International, HSR",
      city: "Bangalore",
      timestamp: "2026-07-10T21:36:00+05:30",
    },
    {
      id: "blr-live-003",
      studentName: "Ananya Rao",
      classLabel: "Class 12",
      stream: "Science",
      board: "CBSE",
      school: "National Public School, Indiranagar",
      city: "Bangalore",
      timestamp: "2026-07-10T21:29:00+05:30",
    },
    {
      id: "blr-live-004",
      studentName: "Arjun Hegde",
      classLabel: "Class 10",
      stream: "Science",
      board: "ICSE",
      school: "Bishop Cotton Boys' School",
      city: "Bangalore",
      timestamp: "2026-07-10T21:21:00+05:30",
    },
    {
      id: "blr-live-005",
      studentName: "Meera Shetty",
      classLabel: "Class 9",
      stream: "Arts",
      board: "State Board",
      school: "Delhi Public School, East",
      city: "Bangalore",
      timestamp: "2026-07-10T21:14:00+05:30",
    },
    {
      id: "blr-live-006",
      studentName: "Kabir Menon",
      classLabel: "Class 12",
      stream: "Science",
      board: "IB / IGCSE",
      school: "The International School Bangalore",
      city: "Bangalore",
      timestamp: "2026-07-10T21:08:00+05:30",
    },
  ],
};

const bangalorePartnerSales: PartnerSalesAnalytics = {
  totalPartners: 44,
  confirmed: 18,
  inProcess: 21,
  lost: 5,
  pipelineValue: 13000000,
  wonValue: 4850000,
  conversionRate: 40.9,
  byTier: [
    { name: "Stall Partner", value: 9, amount: 900000 },
    { name: "Education Partner", value: 7, amount: 1400000 },
    { name: "Knowledge Partner (Silver)", value: 6, amount: 1800000 },
    { name: "Knowledge Partner (Gold)", value: 5, amount: 2500000 },
    { name: "University Partner", value: 8, amount: 2400000 },
    { name: "Co-Presenting Partner", value: 5, amount: 2500000 },
    { name: "Presenting Partner", value: 4, amount: 4000000 },
  ],
  byStage: [
    { name: "New", count: 7, amount: 1680000 },
    { name: "Contacted", count: 6, amount: 1440000 },
    { name: "Meeting Scheduled", count: 5, amount: 1620000 },
    { name: "Negotiation", count: 9, amount: 4080000 },
    { name: "Won", count: 12, amount: 4850000 },
    { name: "Lost", count: 5, amount: 1480000 },
  ],
  byStatus: [
    { name: "Confirmed", value: 18 },
    { name: "In Process", value: 21 },
    { name: "Lost", value: 5 },
  ],
  byCity: [
    { name: "Bangalore", value: 18 },
  ],
  tierProgress: [
    { name: "Stall Partner", current: 9, target: 12, value: 900000 },
    { name: "Education Partner", current: 7, target: 10, value: 1400000 },
    { name: "Knowledge Partner (Silver)", current: 6, target: 8, value: 1800000 },
    { name: "Knowledge Partner (Gold)", current: 5, target: 6, value: 2500000 },
    { name: "University Partner", current: 8, target: 9, value: 2400000 },
    { name: "Co-Presenting Partner", current: 5, target: 6, value: 2500000 },
    { name: "Presenting Partner", current: 4, target: 4, value: 4000000 },
  ],
  recentActivity: [
    {
      id: "blr-psa-001",
      title: "Negotiation",
      description: "Christ University received Knowledge Partner (Gold) proposal",
      timestamp: "2026-07-10T16:15:00+05:30",
      universityName: "Christ University",
      tier: "Knowledge Partner (Gold)",
      stage: "Negotiation",
      value: 550000,
    },
    {
      id: "blr-psa-002",
      title: "Deal won — Stall Partner",
      description: "Jain University confirmed Stall Partner for Bangalore",
      timestamp: "2026-07-06T09:30:00+05:30",
      universityName: "Jain University",
      tier: "Stall Partner",
      stage: "Won",
      value: 100000,
    },
    {
      id: "blr-psa-003",
      title: "New lead added",
      description: "PES University entered pipeline as Stall Partner",
      timestamp: "2026-07-03T10:05:00+05:30",
      universityName: "PES University",
      tier: "Stall Partner",
      stage: "New",
      value: 95000,
    },
    {
      id: "blr-psa-004",
      title: "Negotiation started",
      description: "RV University reviewing Co-Presenting terms",
      timestamp: "2026-07-09T14:20:00+05:30",
      universityName: "RV University",
      tier: "Co-Presenting Partner",
      stage: "Negotiation",
      value: 750000,
    },
    {
      id: "blr-psa-005",
      title: "Meeting scheduled",
      description: "MS Ramaiah University stall discussion set for Jul 14",
      timestamp: "2026-07-08T11:00:00+05:30",
      universityName: "MS Ramaiah University of Applied Sciences",
      tier: "University Partner",
      stage: "Meeting Scheduled",
      value: 380000,
    },
    {
      id: "blr-psa-006",
      title: "Deal won — Presenting Partner",
      description: "Alliance University confirmed Presenting Partner for Bangalore",
      timestamp: "2026-07-05T17:45:00+05:30",
      universityName: "Alliance University",
      tier: "Presenting Partner",
      stage: "Won",
      value: 1100000,
    },
  ],
  leaderboard: [
    { name: "Arjun Mehta", deals: 12, won: 6, value: 2100000 },
    { name: "Priya Nair", deals: 10, won: 5, value: 1850000 },
    { name: "Ananya Shah", deals: 9, won: 4, value: 980000 },
    { name: "Sneha Iyer", deals: 7, won: 2, value: 620000 },
    { name: "Rohan Kapoor", deals: 6, won: 1, value: 400000 },
  ],
  deals: [
    {
      id: "blr-deal-001",
      universityName: "Christ University",
      tier: "Knowledge Partner (Gold)",
      stage: "Negotiation",
      status: "In Process",
      value: 550000,
      city: "Bangalore",
      owner: "Arjun Mehta",
      lastActivity: "2026-07-10T16:15:00+05:30",
      notes: "Awaiting academic council review",
    },
    {
      id: "blr-deal-002",
      universityName: "Jain University",
      tier: "Stall Partner",
      stage: "Won",
      status: "Confirmed",
      value: 100000,
      city: "Bangalore",
      owner: "Ananya Shah",
      lastActivity: "2026-07-06T09:30:00+05:30",
    },
    {
      id: "blr-deal-003",
      universityName: "PES University",
      tier: "Stall Partner",
      stage: "New",
      status: "In Process",
      value: 95000,
      city: "Bangalore",
      owner: "Ananya Shah",
      lastActivity: "2026-07-03T10:05:00+05:30",
    },
    {
      id: "blr-deal-004",
      universityName: "RV University",
      tier: "Co-Presenting Partner",
      stage: "Negotiation",
      status: "In Process",
      value: 750000,
      city: "Bangalore",
      owner: "Priya Nair",
      lastActivity: "2026-07-09T14:20:00+05:30",
    },
    {
      id: "blr-deal-005",
      universityName: "MS Ramaiah University of Applied Sciences",
      tier: "University Partner",
      stage: "Meeting Scheduled",
      status: "In Process",
      value: 380000,
      city: "Bangalore",
      owner: "Sneha Iyer",
      lastActivity: "2026-07-08T11:00:00+05:30",
    },
    {
      id: "blr-deal-006",
      universityName: "Alliance University",
      tier: "Presenting Partner",
      stage: "Won",
      status: "Confirmed",
      value: 1100000,
      city: "Bangalore",
      owner: "Priya Nair",
      lastActivity: "2026-07-05T17:45:00+05:30",
    },
    {
      id: "blr-deal-007",
      universityName: "Reva University",
      tier: "Education Partner",
      stage: "Won",
      status: "Confirmed",
      value: 280000,
      city: "Bangalore",
      owner: "Arjun Mehta",
      lastActivity: "2026-07-04T12:30:00+05:30",
    },
    {
      id: "blr-deal-008",
      universityName: "Dayananda Sagar University",
      tier: "Knowledge Partner (Silver)",
      stage: "Contacted",
      status: "In Process",
      value: 300000,
      city: "Bangalore",
      owner: "Rohan Kapoor",
      lastActivity: "2026-07-07T15:10:00+05:30",
    },
    {
      id: "blr-deal-009",
      universityName: "CMR University",
      tier: "University Partner",
      stage: "Lost",
      status: "Lost",
      value: 350000,
      city: "Bangalore",
      owner: "Sneha Iyer",
      lastActivity: "2026-07-02T11:00:00+05:30",
      notes: "Budget freeze for Q3",
    },
    {
      id: "blr-deal-010",
      universityName: "Presidency University",
      tier: "Education Partner",
      stage: "Won",
      status: "Confirmed",
      value: 220000,
      city: "Bangalore",
      owner: "Ananya Shah",
      lastActivity: "2026-07-01T16:00:00+05:30",
    },
    {
      id: "blr-deal-011",
      universityName: "Dayananda Sagar University",
      tier: "Co-Presenting Partner",
      stage: "Won",
      status: "Confirmed",
      value: 700000,
      city: "Bangalore",
      owner: "Priya Nair",
      lastActivity: "2026-07-04T12:20:00+05:30",
    },
    {
      id: "blr-deal-012",
      universityName: "Kristu Jayanti College",
      tier: "Knowledge Partner (Gold)",
      stage: "Won",
      status: "Confirmed",
      value: 500000,
      city: "Bangalore",
      owner: "Arjun Mehta",
      lastActivity: "2026-07-07T10:40:00+05:30",
    },
    {
      id: "blr-deal-013",
      universityName: "Garden City University",
      tier: "University Partner",
      stage: "Won",
      status: "Confirmed",
      value: 320000,
      city: "Bangalore",
      owner: "Sneha Iyer",
      lastActivity: "2026-07-08T15:10:00+05:30",
    },
    {
      id: "blr-deal-014",
      universityName: "Atria University",
      tier: "Knowledge Partner (Silver)",
      stage: "Won",
      status: "Confirmed",
      value: 280000,
      city: "Bangalore",
      owner: "Rohan Kapoor",
      lastActivity: "2026-07-09T09:15:00+05:30",
    },
  ],
};

const bangaloreSlice: CityDashboardSlice = {
  kpis: [
    {
      id: "kpi-registrations",
      label: "Total Registrations",
      value: 22800,
      change: 21.2,
      changeType: "increase",
      format: "number",
    },
    {
      id: "kpi-events",
      label: "Active Events",
      value: 1,
      change: 0,
      changeType: "neutral",
      format: "number",
    },
    {
      id: "kpi-universities",
      label: "Approved Universities",
      value: 6,
      change: 1,
      changeType: "increase",
      format: "number",
    },
    {
      id: "kpi-revenue",
      label: "Registration Revenue",
      value: 5200000,
      change: 24.6,
      changeType: "increase",
      format: "currency",
    },
    {
      id: "kpi-checkins",
      label: "Check-ins Today",
      value: 3550,
      change: 48.1,
      changeType: "increase",
      format: "number",
    },
    {
      id: "kpi-conversion",
      label: "Registration Conversion",
      value: 76.2,
      change: 4.4,
      changeType: "increase",
      format: "percentage",
    },
  ],
  targets: [
    {
      id: "target-registrations",
      label: "Season Registrations",
      current: 22800,
      target: 28000,
      format: "number",
      periodLabel: "FY 2026 target",
    },
    {
      id: "target-revenue",
      label: "Registration Revenue",
      current: 5200000,
      target: 6200000,
      format: "currency",
      periodLabel: "FY 2026 target",
    },
    {
      id: "target-sponsorship",
      label: "Partner Sponsorship",
      current: 4850000,
      target: 5200000,
      format: "currency",
      periodLabel: "FY 2026 target",
    },
  ],
  insights: [
    {
      id: "blr-insight-001",
      severity: "success",
      title: "Bangalore leads all three cities",
      description:
        "Bangalore holds 22,800 registrations — 52% of total volume and 57% above the three-city average. Keep school outreach concentrated in East and South Bangalore through July.",
    },
    {
      id: "blr-insight-002",
      severity: "info",
      title: "IB / IGCSE share is highest here",
      description:
        "International board registrations are 7.1% of Bangalore volume vs 6.2% overall. Partner with international schools for early-bird packs before August.",
    },
    {
      id: "blr-insight-003",
      severity: "warning",
      title: "Evening session under-indexed",
      description:
        "Evening registrations are 22.7% of Bangalore volume. Push after-school SMS campaigns in Whitefield and Electronic City catchments.",
    },
    {
      id: "blr-insight-004",
      severity: "success",
      title: "Partner sponsorship at 93% of city target",
      description:
        "₹48.5L secured against ₹52L Bangalore goal. Presenting and Co-Presenting tiers are on track; Stall Partner still needs 3 more closes.",
    },
  ],
  registrationTrend: [
    { name: "Jan", value: 620, registrations: 620 },
    { name: "Feb", value: 510, registrations: 510 },
    { name: "Mar", value: 760, registrations: 760 },
    { name: "Apr", value: 1100, registrations: 1100 },
    { name: "May", value: 1680, registrations: 1680 },
    { name: "Jun", value: 3040, registrations: 3040 },
    { name: "Jul", value: 4400, registrations: 4400 },
  ],
  eventPerformance: [
    {
      name: "Career Uttsav Bangalore 2026",
      value: 22800,
      registrations: 22800,
      checkIns: 3550,
    },
  ],
  registrationsByStatus: [
    { name: "Confirmed", value: 11180 },
    { name: "Checked In", value: 11620 },
  ],
  recentActivities: [
    {
      id: "blr-ra-001",
      type: "registration",
      title: "New registration",
      description: "Diya Krishnan registered for Bangalore 2026",
      timestamp: "2026-07-10T21:42:00+05:30",
      link: "/registrations/reg-blr-218",
    },
    {
      id: "blr-ra-002",
      type: "partner",
      title: "Negotiation",
      description: "Christ University Knowledge Partner (Gold) proposal sent",
      timestamp: "2026-07-10T16:15:00+05:30",
      link: "/partners/ptr-blr-002",
    },
    {
      id: "blr-ra-003",
      type: "event",
      title: "Capacity update",
      description: "Bangalore 2026 crossed 15,000 registrations",
      timestamp: "2026-07-08T10:00:00+05:30",
      link: "/events/evt-blr-001",
    },
    {
      id: "blr-ra-004",
      type: "university",
      title: "University approved",
      description: "Alliance University approved for Bangalore stall",
      timestamp: "2026-07-05T14:30:00+05:30",
      link: "/universities/uni-blr-006",
    },
    {
      id: "blr-ra-005",
      type: "partner",
      title: "Partner confirmed",
      description: "Bangalore Knowledge Partner package confirmed",
      timestamp: "2026-07-03T09:00:00+05:30",
      link: "/partners",
    },
    {
      id: "blr-ra-006",
      type: "system",
      title: "Capacity updated",
      description: "Bangalore early-bird registration target reviewed",
      timestamp: "2026-07-02T11:00:00+05:30",
      link: "/events",
    },
  ],
  upcomingTasks: [
    {
      id: "blr-task-001",
      title: "Review Bangalore early bird registration pace",
      priority: "High",
      dueDate: "2026-07-25T10:00:00+05:30",
      status: "Pending",
      assignedTo: "usr-003",
      relatedResource: "registration",
    },
    {
      id: "blr-task-002",
      title: "Follow up Christ University Gold proposal",
      priority: "High",
      dueDate: "2026-07-14T17:00:00+05:30",
      status: "In Progress",
      assignedTo: "usr-002",
      relatedResource: "partner",
    },
    {
      id: "blr-task-003",
      title: "Confirm Palace Grounds AV walkthrough",
      priority: "Medium",
      dueDate: "2026-07-18T12:00:00+05:30",
      status: "Pending",
      assignedTo: "usr-005",
      relatedResource: "event",
    },
    {
      id: "blr-task-004",
      title: "Confirm Bangalore venue floor plan",
      priority: "Low",
      dueDate: "2026-07-20T17:00:00+05:30",
      status: "Pending",
      assignedTo: "usr-009",
      relatedResource: "event",
    },
  ],
  upcomingEvents: [
    {
      id: "evt-blr-001",
      title: "Career Uttsav Bangalore 2026",
      startDate: "2026-08-15T09:00:00+05:30",
      city: "Bangalore",
      status: "Published",
      registrationCount: 22800,
      maxCapacity: 35000,
    },
  ],
  studentRegistration: bangaloreStudentRegistration,
  partnerSales: bangalorePartnerSales,
  vsAverage: buildVsAverage({
    registrations: 22800,
    revenue: 5200000,
    conversion: 76.2,
    pipeline: 13000000,
    checkIns: 3550,
  }),
};


// ─── Exports ────────────────────────────────────────────────────────────────

export const mockCitySlices: Record<OperatingCity, CityDashboardSlice> = {
  Bangalore: bangaloreSlice,
};

export function buildAllCitiesRegistrationsByCity(): ChartDataPoint[] {
  return OPERATING_CITIES.map((city) => ({
    name: city,
    value: mockCitySlices[city].studentRegistration.total,
  }));
}
