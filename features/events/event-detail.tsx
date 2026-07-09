"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarDays,
  Download,
  Edit,
  FileText,
  GraduationCap,
  Handshake,
  MapPin,
  Megaphone,
  Users,
} from "lucide-react";

import {
  eventsService,
  notificationsService,
  partnersService,
  registrationsService,
  reportsService,
  universitiesService,
} from "@/services/api";
import { BRAND } from "@/constants";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
} from "@/lib/utils";
import {
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  StatusChip,
  TableSkeleton,
  type ColumnDef,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import type {
  Notification,
  Partner,
  Registration,
  Report,
  University,
} from "@/types";

export interface EventDetailProps {
  eventId: string;
}

export function EventDetail({ eventId }: EventDetailProps) {
  const [activeTab, setActiveTab] = useState("overview");

  const eventQuery = useQuery({
    queryKey: ["events", eventId],
    queryFn: () => eventsService.getById(eventId),
  });

  const registrationsQuery = useQuery({
    queryKey: ["registrations", "event", eventId],
    queryFn: () => registrationsService.getByEvent(eventId),
    enabled: activeTab === "registrations" || activeTab === "overview",
  });

  const universitiesQuery = useQuery({
    queryKey: ["universities", "event", eventId],
    queryFn: () => universitiesService.getByEvent(eventId),
    enabled: activeTab === "universities" || activeTab === "overview",
  });

  const partnersQuery = useQuery({
    queryKey: ["partners", "event", eventId],
    queryFn: async () => {
      const all = await partnersService.getAll();
      return all.filter((p) => p.eventIds.includes(eventId));
    },
    enabled: activeTab === "partners" || activeTab === "overview",
  });

  const reportsQuery = useQuery({
    queryKey: ["reports"],
    queryFn: () => reportsService.getAll(),
    enabled: activeTab === "reports",
  });

  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsService.getAll(),
    enabled: activeTab === "notifications",
  });

  const event = eventQuery.data;
  const registrations = registrationsQuery.data ?? [];
  const universities = universitiesQuery.data ?? [];
  const partners = partnersQuery.data ?? [];
  const reports = reportsQuery.data ?? [];
  const notifications = notificationsQuery.data ?? [];

  const eventReports = useMemo(
    () =>
      reports.filter((r) =>
        r.name.toLowerCase().includes(event?.city.toLowerCase() ?? "")
      ),
    [reports, event?.city]
  );

  const eventNotifications = useMemo(
    () => notifications.filter((n) => n.eventId === eventId),
    [notifications, eventId]
  );

  const registrationStatusChart = useMemo(() => {
    const counts = registrations.reduce<Record<string, number>>((acc, reg) => {
      acc[reg.status] = (acc[reg.status] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [registrations]);

  const registrationColumns: ColumnDef<Registration>[] = [
    {
      accessorKey: "registrationNumber",
      header: "Reg. No.",
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.registrationNumber}</span>
      ),
    },
    {
      accessorKey: "studentName",
      header: "Student",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.studentName}</p>
          <p className="text-xs text-muted-foreground">{row.original.email}</p>
        </div>
      ),
    },
    {
      accessorKey: "college",
      header: "College",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusChip status={row.original.status} />,
    },
    {
      accessorKey: "paymentStatus",
      header: "Payment",
      cell: ({ row }) => <StatusChip status={row.original.paymentStatus} />,
    },
  ];

  const universityColumns: ColumnDef<University>[] = [
    {
      accessorKey: "name",
      header: "University",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          {row.original.shortName && (
            <p className="text-xs text-muted-foreground">{row.original.shortName}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusChip status={row.original.status} />,
    },
    {
      accessorKey: "stallNumber",
      header: "Stall",
      cell: ({ row }) => row.original.stallNumber ?? "—",
    },
    {
      accessorKey: "contactPerson",
      header: "Contact",
    },
  ];

  const partnerColumns: ColumnDef<Partner>[] = [
    {
      accessorKey: "name",
      header: "Partner",
      cell: ({ row }) => <p className="font-medium">{row.original.name}</p>,
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => <Badge variant="secondary">{row.original.category}</Badge>,
    },
    {
      accessorKey: "sponsorshipAmount",
      header: "Sponsorship",
      cell: ({ row }) =>
        row.original.sponsorshipAmount
          ? formatCurrency(row.original.sponsorshipAmount)
          : "—",
    },
    {
      accessorKey: "contactPerson",
      header: "Contact",
    },
    {
      accessorKey: "isActive",
      header: "Active",
      cell: ({ row }) => (
        <StatusChip status={row.original.isActive ? "Active" : "Inactive"} />
      ),
    },
  ];

  const reportColumns: ColumnDef<Report>[] = [
    {
      accessorKey: "name",
      header: "Report",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.type}</p>
        </div>
      ),
    },
    {
      accessorKey: "format",
      header: "Format",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusChip status={row.original.status} />,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) =>
        row.original.downloadUrl ? (
          <Button variant="ghost" size="sm" asChild>
            <a href={row.original.downloadUrl} download>
              <Download className="h-4 w-4" />
              Download
            </a>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
  ];

  const notificationColumns: ColumnDef<Notification>[] = [
    {
      accessorKey: "title",
      header: "Notification",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.title}</p>
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {row.original.message}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "channel",
      header: "Channel",
    },
    {
      accessorKey: "audience",
      header: "Audience",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusChip status={row.original.status} />,
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
  ];

  if (eventQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (eventQuery.isError || !event) {
    return (
      <ErrorState
        title="Event not found"
        message="This event doesn't exist or couldn't be loaded."
        onRetry={() => void eventQuery.refetch()}
      />
    );
  }

  const capacityPercent = Math.round(
    (event.registrationCount / event.maxCapacity) * 100
  );
  const checkInPercent =
    event.registrationCount > 0
      ? Math.round((event.checkInCount / event.registrationCount) * 100)
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <PageHeader
        title={event.title}
        description={event.shortDescription ?? event.description.slice(0, 120)}
        breadcrumbs={[
          { label: "Events", href: "/events" },
          { label: event.title },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/events/${event.id}/edit`}>
                <Edit className="h-4 w-4" />
                Edit
              </Link>
            </Button>
            <Button asChild>
              <Link href="/notifications">
                <Megaphone className="h-4 w-4" />
                Notify
              </Link>
            </Button>
          </div>
        }
      />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-secondary/5 to-transparent p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip status={event.status} />
                {event.isFeatured && <Badge variant="success">Featured</Badge>}
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  {formatDateTime(event.startDate)} – {formatDate(event.endDate)}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {event.venue}, {event.city}
                </span>
              </div>
              {event.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {event.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg border bg-card/80 px-4 py-3 backdrop-blur">
                <p className="text-2xl font-bold">{formatNumber(event.registrationCount)}</p>
                <p className="text-xs text-muted-foreground">Registrations</p>
              </div>
              <div className="rounded-lg border bg-card/80 px-4 py-3 backdrop-blur">
                <p className="text-2xl font-bold">{formatNumber(event.checkInCount)}</p>
                <p className="text-xs text-muted-foreground">Check-ins</p>
              </div>
              <div className="rounded-lg border bg-card/80 px-4 py-3 backdrop-blur">
                <p className="text-2xl font-bold">{capacityPercent}%</p>
                <p className="text-xs text-muted-foreground">Capacity</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/50 p-1">
          <TabsTrigger value="overview" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="registrations" className="gap-1.5">
            <Users className="h-4 w-4" />
            Registrations
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
              {event.registrationCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="universities" className="gap-1.5">
            <GraduationCap className="h-4 w-4" />
            Universities
          </TabsTrigger>
          <TabsTrigger value="partners" className="gap-1.5">
            <Handshake className="h-4 w-4" />
            Partners
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5">
            <Megaphone className="h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Event Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <div
                    className="prose prose-sm mt-1 max-w-none text-foreground"
                    dangerouslySetInnerHTML={{ __html: event.description }}
                  />
                </div>
                <Separator />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Venue</p>
                    <p className="text-sm font-medium">{event.venue}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Address</p>
                    <p className="text-sm font-medium">
                      {event.address}, {event.city} – {event.pincode}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Registration Deadline</p>
                    <p className="text-sm font-medium">
                      {formatDateTime(event.registrationDeadline)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Max Capacity</p>
                    <p className="text-sm font-medium">
                      {formatNumber(event.maxCapacity)} attendees
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Snapshot</CardTitle>
                <CardDescription>Key metrics at a glance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Capacity filled</span>
                    <span className="font-medium">{capacityPercent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(capacityPercent, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Check-in rate</span>
                    <span className="font-medium">{checkInPercent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-secondary"
                      style={{ width: `${Math.min(checkInPercent, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-lg font-bold">{universities.length}</p>
                      <p className="text-xs text-muted-foreground">Universities</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    <Handshake className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-lg font-bold">{partners.length}</p>
                      <p className="text-xs text-muted-foreground">Partners</p>
                    </div>
                  </div>
                </div>

                {registrationStatusChart.length > 0 && (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={registrationStatusChart} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" fill={BRAND.primary} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="registrations" className="mt-6">
          {registrationsQuery.isLoading ? (
            <TableSkeleton rows={5} columns={5} />
          ) : registrations.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No registrations yet"
              description="Student registrations for this event will appear here."
            />
          ) : (
            <DataTable
              columns={registrationColumns}
              data={registrations}
              getRowId={(row) => row.id}
              emptyMessage="No registrations found."
            />
          )}
        </TabsContent>

        <TabsContent value="universities" className="mt-6">
          {universitiesQuery.isLoading ? (
            <TableSkeleton rows={4} columns={5} />
          ) : universities.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No universities linked"
              description="Universities participating in this event will appear here."
              action={{
                label: "Invite University",
                onClick: () => {},
              }}
            />
          ) : (
            <DataTable
              columns={universityColumns}
              data={universities}
              getRowId={(row) => row.id}
            />
          )}
        </TabsContent>

        <TabsContent value="partners" className="mt-6">
          {partnersQuery.isLoading ? (
            <TableSkeleton rows={4} columns={5} />
          ) : partners.length === 0 ? (
            <EmptyState
              icon={Handshake}
              title="No partners linked"
              description="Sponsors and partners for this event will appear here."
            />
          ) : (
            <DataTable
              columns={partnerColumns}
              data={partners}
              getRowId={(row) => row.id}
            />
          )}
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          {reportsQuery.isLoading ? (
            <TableSkeleton rows={3} columns={4} />
          ) : eventReports.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No reports available"
              description="Generated reports related to this event will appear here."
              action={{
                label: "Generate Report",
                onClick: () => {},
              }}
            />
          ) : (
            <DataTable
              columns={reportColumns}
              data={eventReports}
              getRowId={(row) => row.id}
            />
          )}
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          {notificationsQuery.isLoading ? (
            <TableSkeleton rows={4} columns={5} />
          ) : eventNotifications.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No notifications sent"
              description="Notifications for this event will appear here."
              action={{
                label: "Send Notification",
                onClick: () => {},
              }}
            />
          ) : (
            <DataTable
              columns={notificationColumns}
              data={eventNotifications}
              getRowId={(row) => row.id}
            />
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
