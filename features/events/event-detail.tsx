"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Clock,
  Edit,
  FileText,
  GraduationCap,
  MapPin,
  Presentation,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import {
  eventsService,
  registrationsService,
  universitiesService,
} from "@/services/api";
import { cn, formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { CreateEventDialog } from "@/features/events/create-event-dialog";
import {
  BRAND,
  INK,
  LINE,
  PAPER,
  displayClass,
  labelClass,
  sectionMotion,
  surface,
} from "@/features/dashboard/dashboard-ui";
import {
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  TableSkeleton,
  type ColumnDef,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { Event, EventSeminar, Registration } from "@/types";

function formatSeminarTime(time: string): string {
  if (!time) return "—";
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h)) return time;
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function toDateOnly(value: string): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return value.slice(0, 10);
}

function eachDayInclusive(start: string, end: string): string[] {
  const s = toDateOnly(start);
  const e = toDateOnly(end) || s;
  if (!s) return [];
  const days: string[] = [];
  const cur = new Date(`${s}T12:00:00`);
  const last = new Date(`${e}T12:00:00`);
  while (cur <= last) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    days.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export interface EventDetailProps {
  eventId: string;
}

export function EventDetail({ eventId }: EventDetailProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const eventQuery = useQuery({
    queryKey: ["events", eventId],
    queryFn: () => eventsService.getById(eventId),
  });

  const deleteMutation = useMutation({
    mutationFn: () => eventsService.delete(eventId),
    onSuccess: () => {
      queryClient.setQueryData<Event[]>(["events"], (old) =>
        old?.filter((e) => e.id !== eventId)
      );
      void queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Event deleted");
      router.push("/events");
    },
    onError: () => toast.error("Failed to delete event"),
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

  const event = eventQuery.data;
  const registrations = registrationsQuery.data ?? [];
  const universities = universitiesQuery.data ?? [];

  const seminarDays = useMemo(() => {
    if (!event) return [];
    const days = eachDayInclusive(event.startDate, event.endDate);
    const byDate = new Map<string, EventSeminar[]>();
    for (const day of days) byDate.set(day, []);
    for (const seminar of event.seminars ?? []) {
      const key = toDateOnly(seminar.date);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(seminar);
    }
    return Array.from(byDate.entries()).map(([date, seminars], index) => ({
      date,
      dayLabel: `Day ${index + 1}`,
      seminars: [...seminars].sort((a, b) =>
        a.startTime.localeCompare(b.startTime)
      ),
    }));
  }, [event]);

  const registrationColumns: ColumnDef<Registration>[] = [
    {
      accessorKey: "studentName",
      header: "Student Name",
      cell: ({ row }) => (
        <span className="font-medium whitespace-nowrap">
          {row.original.studentName}
        </span>
      ),
    },
    {
      accessorKey: "college",
      header: "School/College",
      cell: ({ row }) => (
        <span className="line-clamp-2 max-w-[180px] text-sm">
          {row.original.college}
        </span>
      ),
    },
    {
      accessorKey: "classLabel",
      header: "Class",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.classLabel ?? "—"}</span>
      ),
    },
    {
      accessorKey: "interestedStream",
      header: "Stream",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.interestedStream ?? "—"}</span>
      ),
    },
    {
      accessorKey: "board",
      header: "Board",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.board ?? "—"}</span>
      ),
    },
    {
      accessorKey: "city",
      header: "City",
    },
    {
      accessorKey: "gender",
      header: "Gender",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.gender ?? "—"}</span>
      ),
    },
    {
      accessorKey: "phone",
      header: "Student Mobile",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm">{row.original.phone}</span>
      ),
    },
    {
      accessorKey: "parentPhone",
      header: "Parent Mobile",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm">
          {row.original.parentPhone ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "email",
      header: "Email Address",
      cell: ({ row }) => (
        <span className="max-w-[160px] truncate text-sm">
          {row.original.email}
        </span>
      ),
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

  return (
    <motion.div {...sectionMotion} className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className={labelClass}>Event</p>
          <h1
            className={cn(
              displayClass,
              "text-3xl font-semibold tracking-tight sm:text-4xl"
            )}
            style={{ color: INK.primary }}
          >
            {event.title}
          </h1>
          {event.shortDescription ? (
            <p className="max-w-2xl text-sm" style={{ color: INK.muted }}>
              {event.shortDescription}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="outline"
            className="rounded-full border-[rgba(212,209,200,0.85)] bg-white"
            onClick={() => setEditOpen(true)}
          >
            <Edit className="h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete event?"
        description={`“${event.title}” will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete event"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={async () => {
          await deleteMutation.mutateAsync();
        }}
      />

      <CreateEventDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        event={event}
      />

      <div className={cn(surface.opening, "p-6 sm:p-7")}>
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-0 flex-1 space-y-3.5 text-base leading-snug sm:text-lg">
            <div
              className="grid grid-cols-[1.5rem_1fr] items-start gap-x-3"
              style={{ color: INK.primary }}
            >
              <CalendarDays
                className="mt-0.5 h-5 w-5 shrink-0"
                style={{ color: BRAND[600] }}
              />
              <span>
                {formatDate(event.startDate)}
                {toDateOnly(event.startDate) !== toDateOnly(event.endDate)
                  ? ` – ${formatDate(event.endDate)}`
                  : ""}
              </span>
            </div>
            <div
              className="grid grid-cols-[1.5rem_1fr] items-start gap-x-3"
              style={{ color: INK.primary }}
            >
              <Clock
                className="mt-0.5 h-5 w-5 shrink-0"
                style={{ color: BRAND[600] }}
              />
              <span>
                {formatSeminarTime(event.startTime)} –{" "}
                {formatSeminarTime(event.endTime)}
              </span>
            </div>
            <div
              className="grid grid-cols-[1.5rem_1fr] items-start gap-x-3"
              style={{ color: INK.primary }}
            >
              <MapPin
                className="mt-0.5 h-5 w-5 shrink-0"
                style={{ color: BRAND[600] }}
              />
              <span className="min-w-0 break-words">
                {event.venue?.trim() ? event.venue : "Venue TBD"}
                {event.city ? `, ${event.city}` : ""}
              </span>
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-3">
            <div
              className="flex min-w-[8.5rem] flex-col items-center justify-center rounded-2xl px-6 py-5 text-center sm:min-w-[10rem]"
              style={{
                background: PAPER.muted,
                border: `1px solid ${LINE.subtle}`,
              }}
            >
              <p
                className={cn(
                  displayClass,
                  "text-3xl font-semibold leading-none tabular-nums sm:text-4xl"
                )}
                style={{ color: INK.primary }}
              >
                {formatNumber(event.registrationCount)}
              </p>
              <p className="mt-2 text-sm leading-none" style={{ color: INK.muted }}>
                Registrations
              </p>
            </div>
            <div
              className="flex min-w-[8.5rem] flex-col items-center justify-center rounded-2xl px-6 py-5 text-center sm:min-w-[10rem]"
              style={{
                background: PAPER.muted,
                border: `1px solid ${LINE.subtle}`,
              }}
            >
              <p
                className={cn(
                  displayClass,
                  "text-3xl font-semibold leading-none tabular-nums sm:text-4xl"
                )}
                style={{ color: INK.primary }}
              >
                {formatNumber(event.checkInCount)}
              </p>
              <p className="mt-2 text-sm leading-none" style={{ color: INK.muted }}>
                Check-ins
              </p>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList
          className="h-auto w-full justify-start gap-1 rounded-2xl border p-1.5"
          style={{
            background: PAPER.muted,
            borderColor: LINE.subtle,
          }}
        >
          <TabsTrigger
            value="overview"
            className="gap-1.5 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <FileText className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="registrations"
            className="gap-1.5 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Users className="h-4 w-4" />
            Registrations
          </TabsTrigger>
          <TabsTrigger
            value="universities"
            className="gap-1.5 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <GraduationCap className="h-4 w-4" />
            Universities
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className={cn(surface.opening, "p-6")}>
              <p className={labelClass}>Details</p>
              <h3
                className={cn(displayClass, "mt-1 text-xl font-semibold")}
                style={{ color: INK.primary }}
              >
                Event details
              </h3>
              <div className="mt-5 space-y-4">
                <div>
                  <p className={labelClass}>Description</p>
                  <div
                    className="prose prose-sm mt-2 max-w-none"
                    style={{ color: INK.secondary }}
                    dangerouslySetInnerHTML={{ __html: event.description }}
                  />
                </div>
                <div
                  className="grid gap-4 border-t pt-4 sm:grid-cols-2"
                  style={{ borderColor: LINE.subtle }}
                >
                  <div>
                    <p className={labelClass}>Venue</p>
                    <p className="mt-1 text-sm font-medium" style={{ color: INK.primary }}>
                      {event.venue?.trim() ? event.venue : "Venue TBD"}
                    </p>
                  </div>
                  <div>
                    <p className={labelClass}>Address</p>
                    <p className="mt-1 text-sm font-medium" style={{ color: INK.primary }}>
                      {[event.address, event.city, event.pincode]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </p>
                  </div>
                  <div>
                    <p className={labelClass}>Registration deadline</p>
                    <p className="mt-1 text-sm font-medium" style={{ color: INK.primary }}>
                      {formatDateTime(event.registrationDeadline)}
                    </p>
                  </div>
                  <div>
                    <p className={labelClass}>Audis</p>
                    <p className="mt-1 text-sm font-medium" style={{ color: INK.primary }}>
                      {event.hallCount}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className={cn(surface.opening, "p-6")}>
              <p className={labelClass}>Schedule</p>
              <h3
                className={cn(displayClass, "mt-1 text-xl font-semibold")}
                style={{ color: INK.primary }}
              >
                Seminar flow
              </h3>
              <div className="mt-5 space-y-5">
                {(event.seminars?.length ?? 0) === 0 ? (
                  <EmptyState
                    icon={Presentation}
                    title="No seminars scheduled"
                    description="Add seminars when you edit this event."
                    className="py-8"
                  />
                ) : (
                  seminarDays.map((day) => (
                    <div key={day.date} className="space-y-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <h4
                          className="text-sm font-semibold"
                          style={{ color: BRAND[700] }}
                        >
                          {day.dayLabel}
                        </h4>
                        <span className="text-xs" style={{ color: INK.muted }}>
                          {formatDate(day.date)}
                        </span>
                      </div>
                      {day.seminars.length === 0 ? (
                        <p
                          className="rounded-xl border border-dashed px-3 py-4 text-sm"
                          style={{
                            borderColor: LINE.strong,
                            color: INK.muted,
                            background: PAPER.muted,
                          }}
                        >
                          No seminars on this day
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {day.seminars.map((seminar) => (
                            <div
                              key={seminar.id}
                              className="rounded-xl border px-4 py-3"
                              style={{
                                borderColor: LINE.subtle,
                                background: PAPER.muted,
                              }}
                            >
                              <div className="flex flex-wrap items-start gap-3">
                                <div className="min-w-[7.5rem] shrink-0">
                                  <p
                                    className="text-sm font-semibold tabular-nums"
                                    style={{ color: INK.primary }}
                                  >
                                    {formatSeminarTime(seminar.startTime)}
                                  </p>
                                  <p
                                    className="text-xs tabular-nums"
                                    style={{ color: INK.muted }}
                                  >
                                    to {formatSeminarTime(seminar.endTime)}
                                  </p>
                                </div>
                                <div className="min-w-0 flex-1 space-y-1.5">
                                  <p
                                    className="text-sm font-medium leading-snug"
                                    style={{ color: INK.primary }}
                                  >
                                    {seminar.title}
                                  </p>
                                  <div className="flex flex-wrap gap-2 text-xs">
                                    <span
                                      className="inline-flex items-center rounded-md border bg-white px-2 py-0.5"
                                      style={{
                                        borderColor: LINE.subtle,
                                        color: INK.secondary,
                                      }}
                                    >
                                      Audi {seminar.hall}
                                    </span>
                                    <span
                                      className="inline-flex items-center rounded-md border bg-white px-2 py-0.5"
                                      style={{
                                        borderColor: LINE.subtle,
                                        color: INK.secondary,
                                      }}
                                    >
                                      {seminar.panelistSlots} panelist
                                      {seminar.panelistSlots === 1 ? "" : "s"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="registrations" className="mt-6">
          <div className={cn(surface.opening, "overflow-hidden p-4 sm:p-5")}>
            <div className="mb-4 flex items-baseline gap-2 px-1">
              <h3
                className={cn(displayClass, "text-xl font-semibold")}
                style={{ color: INK.primary }}
              >
                Registrations
              </h3>
              <span className="text-xl font-semibold" style={{ color: INK.muted }}>
                –
              </span>
              <span
                className="text-xl font-semibold tabular-nums"
                style={{ color: INK.muted }}
              >
                {formatNumber(registrations.length || event.registrationCount)}
              </span>
            </div>
            {registrationsQuery.isLoading ? (
              <TableSkeleton rows={5} columns={10} />
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
          </div>
        </TabsContent>

        <TabsContent value="universities" className="mt-6">
          <div className={cn(surface.opening, "overflow-hidden p-4 sm:p-5")}>
            <div className="mb-4 flex items-baseline gap-2 px-1">
              <h3
                className={cn(displayClass, "text-xl font-semibold")}
                style={{ color: INK.primary }}
              >
                Universities
              </h3>
              <span className="text-xl font-semibold" style={{ color: INK.muted }}>
                –
              </span>
              <span
                className="text-xl font-semibold tabular-nums"
                style={{ color: INK.muted }}
              >
                {formatNumber(universities.length)}
              </span>
            </div>
            {universitiesQuery.isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
            ) : universities.length === 0 ? (
              <EmptyState
                icon={GraduationCap}
                title="No universities yet"
                description="Universities that take a sponsorship package for this event will appear here."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {universities.map((uni) => (
                  <div
                    key={uni.id}
                    className="rounded-xl border px-4 py-3.5"
                    style={{
                      borderColor: LINE.subtle,
                      background: PAPER.muted,
                    }}
                  >
                    <p
                      className="text-sm font-semibold leading-snug"
                      style={{ color: INK.primary }}
                    >
                      {uni.name}
                    </p>
                    <div
                      className="mt-3 space-y-1 text-xs"
                      style={{ color: INK.secondary }}
                    >
                      <p>
                        {[uni.city, uni.state].filter(Boolean).join(", ") || "—"}
                      </p>
                      <p>{uni.contactPerson}</p>
                      <p className="truncate">
                        {[uni.contactPhone, uni.contactEmail]
                          .filter(Boolean)
                          .join(" | ") || "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
