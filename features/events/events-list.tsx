"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  Archive,
  CalendarDays,
  Edit,
  MapPin,
  MoreHorizontal,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { eventsService } from "@/services/api";
import { EVENT_STATUSES } from "@/constants";
import { formatNumber } from "@/lib/utils";
import type { Event, EventStatus } from "@/types";
import {
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  FiltersBar,
  PageHeader,
  Pagination,
  SearchBar,
  StatusChip,
  TableSkeleton,
  type ColumnDef,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const PAGE_SIZE = 5;

type DialogAction = "delete" | "archive" | null;

export function EventsList() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [dialogAction, setDialogAction] = useState<DialogAction>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

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
      toast.success("Event deleted successfully");
    },
    onError: () => toast.error("Failed to delete event"),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) =>
      eventsService.update(id, { status: "Archived" as EventStatus }),
    onSuccess: (updated) => {
      queryClient.setQueryData<Event[]>(["events"], (old) =>
        old?.map((e) => (e.id === updated.id ? updated : e))
      );
      toast.success("Event archived successfully");
    },
    onError: () => toast.error("Failed to archive event"),
  });

  const filteredEvents = useMemo(() => {
    if (!data) return [];

    return data.filter((event) => {
      const matchesSearch =
        search.trim() === "" ||
        event.title.toLowerCase().includes(search.toLowerCase()) ||
        event.city.toLowerCase().includes(search.toLowerCase()) ||
        event.venue.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || event.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [data, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));

  const paginatedEvents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredEvents.slice(start, start + PAGE_SIZE);
  }, [filteredEvents, page]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const openDialog = (action: DialogAction, event: Event) => {
    setSelectedEvent(event);
    setDialogAction(action);
  };

  const handleConfirm = async () => {
    if (!selectedEvent || !dialogAction) return;

    setActionLoading(true);
    try {
      if (dialogAction === "delete") {
        await deleteMutation.mutateAsync(selectedEvent.id);
      } else if (dialogAction === "archive") {
        await archiveMutation.mutateAsync(selectedEvent.id);
      }
    } finally {
      setActionLoading(false);
      setDialogAction(null);
      setSelectedEvent(null);
    }
  };

  const columns: ColumnDef<Event>[] = [
    {
      accessorKey: "title",
      header: "Event",
      cell: ({ row }) => {
        const event = row.original;
        return (
          <div className="min-w-[200px] space-y-1">
            <Link
              href={`/events/${event.id}`}
              className="font-medium text-foreground hover:text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {event.title}
            </Link>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {event.city}, {event.state}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "startDate",
      header: "Date",
      cell: ({ row }) => (
        <div className="text-sm">
          <p>{format(new Date(row.original.startDate), "dd MMM yyyy")}</p>
          <p className="text-xs text-muted-foreground">
            to {format(new Date(row.original.endDate), "dd MMM yyyy")}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusChip status={row.original.status} />,
    },
    {
      id: "registrations",
      header: "Registrations",
      cell: ({ row }) => {
        const event = row.original;
        const percent = Math.round(
          (event.registrationCount / event.maxCapacity) * 100
        );
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-sm">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              {formatNumber(event.registrationCount)} /{" "}
              {formatNumber(event.maxCapacity)}
            </div>
            <div className="h-1 w-20 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "isFeatured",
      header: "Featured",
      cell: ({ row }) =>
        row.original.isFeatured ? (
          <Badge variant="success">Featured</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const event = row.original;
        const canArchive = event.status !== "Archived";

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/events/${event.id}`);
                }}
              >
                <CalendarDays className="h-4 w-4" />
                View details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/events/${event.id}/edit`);
                }}
              >
                <Edit className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              {canArchive && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    openDialog("archive", event);
                  }}
                >
                  <Archive className="h-4 w-4" />
                  Archive
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  openDialog("delete", event);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Events" description="Manage career fairs and expos." />
        <TableSkeleton rows={5} columns={5} />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Failed to load events"
        message="We couldn't fetch the events list. Please try again."
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <PageHeader
        title="Events"
        description="Create, manage, and monitor Career Utsav events across India."
        actions={
          <Button asChild>
            <Link href="/events/new">
              <Plus className="h-4 w-4" />
              Create Event
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar
          value={search}
          onChange={handleSearchChange}
          placeholder="Search events by title, city, or venue..."
          containerClassName="max-w-lg"
        />
      </div>

      <FiltersBar
        filters={[
          {
            id: "status",
            label: "Status",
            placeholder: "All statuses",
            value: statusFilter,
            onChange: handleStatusChange,
            options: EVENT_STATUSES.map((status) => ({
              label: status,
              value: status,
            })),
          },
        ]}
        onClearAll={() => {
          setStatusFilter("all");
          setPage(1);
        }}
      />

      {filteredEvents.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={search || statusFilter !== "all" ? "No events found" : "No events yet"}
          description={
            search || statusFilter !== "all"
              ? "Try adjusting your search or filters."
              : "Create your first Career Utsav event to get started."
          }
          action={
            !search && statusFilter === "all"
              ? {
                  label: "Create Event",
                  onClick: () => router.push("/events/new"),
                }
              : undefined
          }
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={paginatedEvents}
            getRowId={(row) => row.id}
            onRowClick={(row) => router.push(`/events/${row.id}`)}
            emptyMessage="No events match your filters."
          />

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            showPageInfo
            totalItems={filteredEvents.length}
            pageSize={PAGE_SIZE}
          />
        </>
      )}

      <ConfirmDialog
        open={dialogAction === "delete"}
        onOpenChange={(open) => !open && setDialogAction(null)}
        title="Delete event"
        description={
          selectedEvent
            ? `Are you sure you want to permanently delete "${selectedEvent.title}"? This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        variant="destructive"
        loading={actionLoading}
        onConfirm={handleConfirm}
      />

      <ConfirmDialog
        open={dialogAction === "archive"}
        onOpenChange={(open) => !open && setDialogAction(null)}
        title="Archive event"
        description={
          selectedEvent
            ? `Archive "${selectedEvent.title}"? Archived events are hidden from public listings but data is preserved.`
            : undefined
        }
        confirmLabel="Archive"
        loading={actionLoading}
        onConfirm={handleConfirm}
      />
    </motion.div>
  );
}
