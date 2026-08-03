"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Clock,
  Edit,
  MapPin,
  MoreHorizontal,
  Plus,
  Presentation,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { eventsService } from "@/services/api";
import {
  formatEventCitiesDescription,
  getEventCities,
} from "@/lib/event-cities";
import { cn } from "@/lib/utils";
import type { Event } from "@/types";
import { CreateEventDialog } from "@/features/events/create-event-dialog";
import {
  BRAND,
  ELEVATION,
  INK,
  LINE,
  displayClass,
  sectionMotion,
  surface,
} from "@/features/dashboard/dashboard-ui";
import {
  ConfirmDialog,
  ErrorState,
  PageHeader,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function parseEventDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00`);
  }
  return new Date(value);
}

function formatEventDateRange(startDate: string, endDate: string): string {
  const start = parseEventDate(startDate);
  const end = parseEventDate(endDate);
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  if (sameDay) {
    return start.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  const sameMonth =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth();

  if (sameMonth) {
    return `${start.getDate()}–${end.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}`;
  }

  const startLabel = start.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
  const endLabel = end.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

function formatTimeLabel(time: string): string {
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

function EventCard({
  event,
  onEdit,
  onDelete,
}: {
  event: Event;
  onEdit: (event: Event) => void;
  onDelete: (event: Event) => void;
}) {
  const seminarCount = event.seminars?.length ?? 0;
  const venueLabel = event.venue?.trim() ? event.venue : "Venue TBD";

  return (
    <motion.article
      layout
      {...sectionMotion}
      whileHover={{ y: -3 }}
      className={cn(
        surface.opening,
        "group relative flex h-full flex-col gap-5 p-5 transition-shadow hover:shadow-[0_12px_36px_rgba(18,35,63,0.12)]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <Link href={`/events/${event.id}`} className="min-w-0 flex-1 space-y-1">
          <h3
            className={cn(
              displayClass,
              "line-clamp-2 text-xl font-semibold leading-snug transition-colors group-hover:text-brand-700"
            )}
            style={{ color: INK.primary }}
          >
            {event.title}
          </h3>
          <p className="text-sm" style={{ color: INK.secondary }}>
            {event.city}
          </p>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-brand-50 hover:text-brand-900"
              aria-label={`Options for ${event.title}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => onEdit(event)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
              onSelect={() => onDelete(event)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Link
        href={`/events/${event.id}`}
        className="mt-auto block space-y-3 border-t pt-4 text-[15px] leading-snug"
        style={{ borderColor: LINE.subtle, color: INK.secondary }}
      >
        <div className="grid grid-cols-[1.25rem_1fr] items-start gap-x-3">
          <MapPin
            className="mt-0.5 h-5 w-5 shrink-0"
            style={{ color: BRAND[600] }}
          />
          <span className="min-w-0 break-words">{venueLabel}</span>
        </div>
        <div className="grid grid-cols-[1.25rem_1fr] items-start gap-x-3">
          <CalendarDays
            className="mt-0.5 h-5 w-5 shrink-0"
            style={{ color: BRAND[600] }}
          />
          <span>{formatEventDateRange(event.startDate, event.endDate)}</span>
        </div>
        <div className="grid grid-cols-[1.25rem_1fr] items-start gap-x-3">
          <Clock
            className="mt-0.5 h-5 w-5 shrink-0"
            style={{ color: BRAND[600] }}
          />
          <span>
            {formatTimeLabel(event.startTime)} – {formatTimeLabel(event.endTime)}
          </span>
        </div>
        <div className="grid grid-cols-[1.25rem_1fr] items-start gap-x-3">
          <Presentation
            className="mt-0.5 h-5 w-5 shrink-0"
            style={{ color: BRAND[600] }}
          />
          <span>
            {seminarCount} seminar{seminarCount === 1 ? "" : "s"}
          </span>
        </div>
      </Link>
    </motion.article>
  );
}

export function EventsList() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Event | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["events"],
    queryFn: () => eventsService.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => eventsService.delete(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<Event[]>(["events"], (old) =>
        old?.filter((e) => e.id !== id)
      );
      void queryClient.invalidateQueries({ queryKey: ["events"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["registrations"] });
      void queryClient.invalidateQueries({ queryKey: ["partners"] });
      void queryClient.invalidateQueries({ queryKey: ["seminar-rosters"] });
      toast.success("Event deleted");
      setPendingDelete(null);
    },
    onError: () => toast.error("Failed to delete event"),
  });

  const events = useMemo(() => data ?? [], [data]);
  const eventCities = useMemo(() => getEventCities(events), [events]);
  const eventsDescription = useMemo(
    () =>
      eventCities.length > 0
        ? `Plan and manage Career Uttsav events across ${formatEventCitiesDescription(eventCities)}.`
        : "Plan and manage Career Uttsav events across your cities.",
    [eventCities]
  );

  const openCreate = () => {
    setEditingEvent(null);
    setDialogOpen(true);
  };

  const openEdit = (event: Event) => {
    setEditingEvent(event);
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingEvent(null);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Events"
        description={eventsDescription}
        actions={
          <Button
            onClick={openCreate}
            className="h-10 rounded-full px-5 text-white hover:opacity-90"
            style={{ backgroundColor: BRAND[700] }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New event
          </Button>
        }
      />

      {isError && (
        <ErrorState
          title="Couldn’t load events"
          message="Something went wrong while fetching events."
          onRetry={() => void refetch()}
        />
      )}

      {isLoading && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-[24px]" />
          ))}
        </div>
      )}

      {!isLoading && !isError && events.length === 0 && (
        <motion.button
          type="button"
          onClick={openCreate}
          {...sectionMotion}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className={cn(
            surface.mint,
            "flex min-h-[55vh] w-full flex-col items-center justify-center gap-4 border-dashed outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
          )}
        >
          <span
            className="flex h-28 w-28 items-center justify-center rounded-full text-6xl font-light leading-none"
            style={{
              backgroundColor: BRAND[50],
              color: BRAND[700],
              boxShadow: ELEVATION[1],
            }}
          >
            +
          </span>
          <div className="space-y-1 text-center">
            <p
              className={cn(displayClass, "text-xl font-semibold")}
              style={{ color: INK.primary }}
            >
              Create your first event
            </p>
            <p className="text-sm" style={{ color: INK.muted }}>
              Tap + to set up a Career Uttsav fair
            </p>
          </div>
        </motion.button>
      )}

      {!isLoading && !isError && events.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onEdit={openEdit}
              onDelete={setPendingDelete}
            />
          ))}
        </div>
      )}

      <CreateEventDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        event={editingEvent}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete event?"
        description={
          pendingDelete
            ? `“${pendingDelete.title}” will be permanently removed. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete event"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={async () => {
          if (pendingDelete) {
            await deleteMutation.mutateAsync(pendingDelete.id);
          }
        }}
      />
    </div>
  );
}
