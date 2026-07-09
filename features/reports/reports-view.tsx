"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Building2,
  Download,
  FileSpreadsheet,
  GraduationCap,
  Handshake,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { dashboardService, reportsService } from "@/services/api";
import { BRAND } from "@/constants";
import { formatDate } from "@/lib/utils";
import type { Report } from "@/types";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const REPORT_CARDS = [
  {
    id: "registrations",
    title: "Registrations",
    description: "Registration trends, status breakdown, and city distribution.",
    icon: Users,
    color: BRAND.primary,
  },
  {
    id: "universities",
    title: "Universities",
    description: "Approved universities, stall performance, and engagement metrics.",
    icon: GraduationCap,
    color: BRAND.secondary,
  },
  {
    id: "partners",
    title: "Partners",
    description: "Sponsorship revenue, partner categories, and event coverage.",
    icon: Handshake,
    color: BRAND.accent,
  },
  {
    id: "attendance",
    title: "Attendance",
    description: "Check-ins, attendance rates, and event-day footfall.",
    icon: UserCheck,
    color: "#6366F1",
  },
] as const;

export function ReportsView() {
  const [dateFrom, setDateFrom] = useState("2026-01-01");
  const [dateTo, setDateTo] = useState("2026-07-09");
  const [activeReport, setActiveReport] = useState<string>("registrations");

  const { data: dashboard, isLoading: dashLoading, isError: dashError, refetch: refetchDash } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dashboardService.getData(),
  });

  const { data: reports, isLoading: reportsLoading, isError: reportsError, refetch: refetchReports } = useQuery({
    queryKey: ["reports"],
    queryFn: () => reportsService.getAll(),
  });

  const isLoading = dashLoading || reportsLoading;
  const isError = dashError || reportsError;

  const handleExport = (format: "PDF" | "Excel") => {
    toast.success(`${format} export started`, {
      description: `Report will download for ${dateFrom} to ${dateTo}`,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reports" />
        <CardSkeleton count={4} />
      </div>
    );
  }

  if (isError || !dashboard) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reports" />
        <ErrorState onRetry={() => { void refetchDash(); void refetchReports(); }} />
      </div>
    );
  }

  const regKpi = dashboard.kpis.find((k) => k.id.includes("registration"));
  const checkinKpi = dashboard.kpis.find((k) => k.id.includes("checkin"));

  const registrationChartData = dashboard.registrationTrend;
  const attendanceChartData = dashboard.eventPerformance.map((e) => ({
    name: e.name,
    checkIns: Number(e.checkIns ?? 0),
    registrations: Number(e.registrations),
  }));
  const genericChartData = activeReport === "universities"
    ? dashboard.eventPerformance.map((e) => ({ name: e.name, value: Number(e.registrations) }))
    : dashboard.registrationsByCity.slice(0, 6).map((e) => ({ name: e.name, value: Number(e.value) }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generate and export analytics across registrations, universities, partners, and attendance."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => handleExport("PDF")}>
              <Download className="h-4 w-4" />
              Export PDF
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => handleExport("Excel")}>
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Date Range</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <Label htmlFor="date-from">From</Label>
            <Input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date-to">To</Label>
            <Input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {REPORT_CARDS.map((card) => {
          const Icon = card.icon;
          const isActive = activeReport === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setActiveReport(card.id)}
              className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${
                isActive ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "bg-card"
              }`}
            >
              <div
                className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${card.color}20`, color: card.color }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{card.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{card.description}</p>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Registrations"
          value={regKpi?.value ?? 0}
          trend={regKpi ? { value: regKpi.change } : undefined}
          icon={Users}
        />
        <KpiCard
          title="Universities"
          value={dashboard.kpis.find((k) => k.id.includes("universit"))?.value ?? 12}
          icon={Building2}
        />
        <KpiCard
          title="Check-ins Today"
          value={checkinKpi?.value ?? 0}
          trend={checkinKpi ? { value: checkinKpi.change } : undefined}
          icon={UserCheck}
        />
        <KpiCard
          title="Active Events"
          value={dashboard.kpis.find((k) => k.id.includes("event"))?.value ?? 3}
          icon={GraduationCap}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {REPORT_CARDS.find((c) => c.id === activeReport)?.title} Chart
          </CardTitle>
          <CardDescription>
            {formatDate(dateFrom)} — {formatDate(dateTo)}
          </CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            {activeReport === "attendance" ? (
              <BarChart data={attendanceChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="checkIns" fill={BRAND.secondary} name="Check-ins" radius={[4, 4, 0, 0]} />
                <Bar dataKey="registrations" fill={BRAND.primary} name="Registrations" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={activeReport === "registrations" ? registrationChartData : genericChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey={activeReport === "registrations" ? "registrations" : "value"}
                  stroke={BRAND.primary}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generated Reports</CardTitle>
          <CardDescription>Previously generated report downloads.</CardDescription>
        </CardHeader>
        <CardContent>
          {!reports?.length ? (
            <EmptyState title="No reports generated" description="Export a report to see it here." />
          ) : (
            <div className="space-y-3">
              {reports.map((report: Report) => (
                <div
                  key={report.id}
                  className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{report.name}</p>
                    <p className="text-sm text-muted-foreground">{report.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(report.dateRange.from)} — {formatDate(report.dateRange.to)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusChip status={report.status} />
                    <BadgeFormat format={report.format} />
                    {report.status === "Ready" && (
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BadgeFormat({ format }: { format: string }) {
  return (
    <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">{format}</span>
  );
}
