"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Bell,
  Building2,
  CalendarDays,
  Download,
  GraduationCap,
  Handshake,
  IndianRupee,
  Megaphone,
  Plus,
  TrendingUp,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  dashboardService,
  notificationsService,
  partnersService,
  universitiesService,
} from "@/services/api";
import { BRAND } from "@/constants";
import {
  cn,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
} from "@/lib/utils";
import type { DashboardKPI, Notification, Partner, University } from "@/types";
import {
  CardSkeleton,
  EmptyState,
  ErrorState,
  KpiCard,
  PageHeader,
  StatusChip,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const CHART_COLORS = [
  BRAND.primary,
  BRAND.secondary,
  BRAND.accent,
  "#6366F1",
  "#8B5CF6",
  "#EC4899",
];

const KPI_ICONS: Record<string, LucideIcon> = {
  registrations: Users,
  universities: GraduationCap,
  partners: Handshake,
  checkins: UserCheck,
  events: CalendarDays,
  revenue: IndianRupee,
};

function formatKpiValue(kpi: DashboardKPI): string {
  switch (kpi.format) {
    case "currency":
      return formatCurrency(kpi.value);
    case "percentage":
      return `${kpi.value}%`;
    default:
      return formatNumber(kpi.value);
  }
}

function aggregateUniversityStatus(universities: University[]) {
  const counts = universities.reduce<Record<string, number>>((acc, uni) => {
    acc[uni.status] = (acc[uni.status] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

function aggregatePartnerCategories(partners: Partner[]) {
  const counts = partners.reduce<Record<string, number>>((acc, partner) => {
    acc[partner.category] = (acc[partner.category] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

function getActivityIcon(type: string) {
  switch (type) {
    case "registration":
      return Users;
    case "event":
      return CalendarDays;
    case "university":
      return GraduationCap;
    case "partner":
      return Handshake;
    default:
      return Bell;
  }
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <CardSkeleton count={6} className="lg:grid-cols-3 xl:grid-cols-6" />
      <div className="grid gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[260px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export function DashboardView() {
  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dashboardService.getData(),
  });

  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsService.getAll(),
  });

  const universitiesQuery = useQuery({
    queryKey: ["universities"],
    queryFn: () => universitiesService.getAll(),
  });

  const partnersQuery = useQuery({
    queryKey: ["partners"],
    queryFn: () => partnersService.getAll(),
  });

  const isLoading =
    dashboardQuery.isLoading ||
    notificationsQuery.isLoading ||
    universitiesQuery.isLoading ||
    partnersQuery.isLoading;

  const isError =
    dashboardQuery.isError ||
    notificationsQuery.isError ||
    universitiesQuery.isError ||
    partnersQuery.isError;

  const retry = () => {
    void dashboardQuery.refetch();
    void notificationsQuery.refetch();
    void universitiesQuery.refetch();
    void partnersQuery.refetch();
  };

  const dashboard = dashboardQuery.data;
  const partners = partnersQuery.data ?? [];
  const universities = universitiesQuery.data ?? [];
  const notifications = notificationsQuery.data ?? [];

  const kpiCards = useMemo(() => {
    if (!dashboard) return [];

    const kpiMap = Object.fromEntries(
      dashboard.kpis.map((kpi) => [kpi.id, kpi])
    );

    const upcomingCount = dashboard.upcomingEvents.filter(
      (e) => e.status !== "Completed" && e.status !== "Archived"
    ).length;

    const items: Array<{
      id: string;
      title: string;
      value: string;
      icon: LucideIcon;
      trend?: { value: number; label: string };
    }> = [
      {
        id: "registrations",
        title: "Total Registrations",
        value: kpiMap["kpi-registrations"]
          ? formatKpiValue(kpiMap["kpi-registrations"])
          : "—",
        icon: KPI_ICONS.registrations,
        trend: kpiMap["kpi-registrations"]
          ? {
              value: kpiMap["kpi-registrations"].change,
              label: "vs last month",
            }
          : undefined,
      },
      {
        id: "universities",
        title: "Universities Confirmed",
        value: kpiMap["kpi-universities"]
          ? formatKpiValue(kpiMap["kpi-universities"])
          : "—",
        icon: KPI_ICONS.universities,
        trend: kpiMap["kpi-universities"]
          ? {
              value: kpiMap["kpi-universities"].change,
              label: "new this month",
            }
          : undefined,
      },
      {
        id: "partners",
        title: "Partners",
        value: formatNumber(partners.length),
        icon: KPI_ICONS.partners,
        trend: { value: 8.3, label: "vs last quarter" },
      },
      {
        id: "checkins",
        title: "Today's Check-ins",
        value: kpiMap["kpi-checkins"]
          ? formatKpiValue(kpiMap["kpi-checkins"])
          : "—",
        icon: KPI_ICONS.checkins,
        trend: kpiMap["kpi-checkins"]
          ? { value: kpiMap["kpi-checkins"].change, label: "vs yesterday" }
          : undefined,
      },
      {
        id: "events",
        title: "Upcoming Events",
        value: formatNumber(upcomingCount),
        icon: KPI_ICONS.events,
        trend: { value: 0, label: "scheduled" },
      },
      {
        id: "revenue",
        title: "Revenue",
        value: kpiMap["kpi-revenue"]
          ? formatKpiValue(kpiMap["kpi-revenue"])
          : "—",
        icon: KPI_ICONS.revenue,
        trend: kpiMap["kpi-revenue"]
          ? { value: kpiMap["kpi-revenue"].change, label: "vs last month" }
          : undefined,
      },
    ];

    return items;
  }, [dashboard, partners.length]);

  const universityChartData = useMemo(
    () => aggregateUniversityStatus(universities),
    [universities]
  );

  const partnerChartData = useMemo(
    () => aggregatePartnerCategories(partners),
    [partners]
  );

  const recentNotifications = useMemo(
    () =>
      [...notifications]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 5),
    [notifications]
  );

  if (isLoading) return <DashboardSkeleton />;

  if (isError || !dashboard) {
    return (
      <ErrorState
        title="Failed to load dashboard"
        message="We couldn't fetch dashboard data. Please check your connection and try again."
        onRetry={retry}
      />
    );
  }

  const quickActions = [
    {
      label: "Create Event",
      href: "/events/new",
      icon: Plus,
      description: "Launch a new career fair",
    },
    {
      label: "Broadcast Message",
      href: "/notifications",
      icon: Megaphone,
      description: "Send alerts to audiences",
    },
    {
      label: "Export Report",
      href: "/reports",
      icon: Download,
      description: "Download analytics reports",
    },
    {
      label: "Invite University",
      href: "/universities",
      icon: Building2,
      description: "Onboard institution partners",
    },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      <motion.div variants={itemVariants}>
        <PageHeader
          title="Dashboard"
          description="Overview of registrations, events, and platform activity across Career Utsav."
          actions={
            <Button asChild>
              <Link href="/events/new">
                <Plus className="h-4 w-4" />
                Create Event
              </Link>
            </Button>
          }
        />
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      >
        {kpiCards.map((kpi, index) => (
          <KpiCard
            key={kpi.id}
            title={kpi.title}
            value={kpi.value}
            icon={kpi.icon}
            trend={kpi.trend}
            className={cn(index === 0 && "sm:col-span-2 xl:col-span-1")}
          />
        ))}
      </motion.div>

      <motion.div variants={itemVariants} className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              Registrations Trend
            </CardTitle>
            <CardDescription>
              Monthly registration volume across all events
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard.registrationTrend.length === 0 ? (
              <EmptyState
                title="No trend data"
                description="Registration trends will appear once data is available."
                className="py-12"
              />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={dashboard.registrationTrend}>
                  <defs>
                    <linearGradient id="regGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={BRAND.primary} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={BRAND.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatNumber(v)}
                  />
                  <Tooltip
                    formatter={(value) => [
                      formatNumber(Number(value ?? 0)),
                      "Registrations",
                    ]}
                    contentStyle={{
                      borderRadius: "0.625rem",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="registrations"
                    stroke={BRAND.primary}
                    strokeWidth={2}
                    fill="url(#regGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <GraduationCap className="h-5 w-5 text-primary" />
              University Status
            </CardTitle>
            <CardDescription>Application pipeline breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {universityChartData.length === 0 ? (
              <EmptyState
                title="No university data"
                description="University status distribution will appear here."
                className="py-12"
              />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={universityChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {universityChartData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      formatNumber(Number(value ?? 0)),
                      String(name),
                    ]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value) => (
                      <span className="text-xs text-muted-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Handshake className="h-5 w-5 text-primary" />
              Partner Distribution
            </CardTitle>
            <CardDescription>Partners by sponsorship category</CardDescription>
          </CardHeader>
          <CardContent>
            {partnerChartData.length === 0 ? (
              <EmptyState
                title="No partner data"
                description="Partner distribution will appear once partners are onboarded."
                className="py-12"
              />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={partnerChartData} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    formatter={(value) => [Number(value ?? 0), "Partners"]}
                    contentStyle={{
                      borderRadius: "0.625rem",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {partnerChartData.map((_, index) => (
                      <Cell
                        key={`bar-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Recent Activities</CardTitle>
              <CardDescription>Latest platform events and updates</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard.recentActivities.length === 0 ? (
                <EmptyState
                  title="No recent activity"
                  description="Activity will show up as users interact with the platform."
                  className="py-10"
                />
              ) : (
                <ScrollArea className="h-[340px] pr-4">
                  <div className="relative space-y-0">
                    <div className="absolute left-[17px] top-2 bottom-2 w-px bg-border" />
                    {dashboard.recentActivities.map((activity, index) => {
                      const Icon = getActivityIcon(activity.type);
                      return (
                        <motion.div
                          key={activity.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="relative flex gap-4 pb-6 last:pb-0"
                        >
                          <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-card shadow-sm">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="font-medium text-foreground">
                                  {activity.title}
                                </p>
                                <p className="mt-0.5 text-sm text-muted-foreground">
                                  {activity.description}
                                </p>
                              </div>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(activity.timestamp), {
                                  addSuffix: true,
                                })}
                              </span>
                            </div>
                            {activity.link && (
                              <Link
                                href={activity.link}
                                className="mt-1.5 inline-block text-xs font-medium text-primary hover:underline"
                              >
                                View details →
                              </Link>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Tasks</CardTitle>
              <CardDescription>Items requiring your attention</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.upcomingTasks.length === 0 ? (
                <EmptyState
                  title="All caught up"
                  description="No pending tasks at the moment."
                  className="py-8"
                />
              ) : (
                dashboard.upcomingTasks.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    className="rounded-lg border bg-muted/30 p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug">{task.title}</p>
                      <Badge
                        variant={
                          task.priority === "High"
                            ? "destructive"
                            : task.priority === "Medium"
                              ? "warning"
                              : "muted"
                        }
                        className="shrink-0 text-[10px]"
                      >
                        {task.priority}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <StatusChip status={task.status} dot={false} />
                      <span>Due {formatDate(task.dueDate)}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Recent Notifications</CardTitle>
                <CardDescription>Latest sent & scheduled</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/notifications">View all</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentNotifications.length === 0 ? (
                <EmptyState
                  title="No notifications"
                  description="Notifications you send will appear here."
                  className="py-8"
                />
              ) : (
                recentNotifications.map((notification: Notification) => (
                  <div
                    key={notification.id}
                    className="flex gap-3 rounded-lg border p-3"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Bell className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {notification.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {notification.message}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <StatusChip status={notification.status} />
                        <span className="text-[10px] text-muted-foreground">
                          {formatDateTime(notification.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common admin workflows at a glance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="group rounded-xl border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-card"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/15">
                    <action.icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="mt-3 font-medium text-foreground">{action.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {action.description}
                  </p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Upcoming Events
            </CardTitle>
            <CardDescription>Events on the horizon</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard.upcomingEvents.length === 0 ? (
              <EmptyState
                title="No upcoming events"
                description="Create an event to get started."
                action={{
                  label: "Create Event",
                  onClick: () => {},
                }}
                className="py-10"
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {dashboard.upcomingEvents.map((event) => {
                  const fillPercent = Math.round(
                    (event.registrationCount / event.maxCapacity) * 100
                  );
                  return (
                    <Link
                      key={event.id}
                      href={`/events/${event.id}`}
                      className="group rounded-xl border p-4 transition-all hover:border-primary/30 hover:shadow-card"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium group-hover:text-primary">
                            {event.title}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {event.city} · {formatDate(event.startDate)}
                          </p>
                        </div>
                        <StatusChip status={event.status} />
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            {formatNumber(event.registrationCount)} /{" "}
                            {formatNumber(event.maxCapacity)} registered
                          </span>
                          <span>{fillPercent}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${Math.min(fillPercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
