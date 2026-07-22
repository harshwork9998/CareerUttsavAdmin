"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Users } from "lucide-react";
import { toast } from "sonner";

import { eventsService, registrationsService } from "@/services/api";
import { getPrimarySeminar } from "@/lib/enrich-registration";
import {
  filterRegistrationsForEventCatalog,
  registrationMatchesEventFilter,
} from "@/lib/registration-event-links";
import { formatNumber } from "@/lib/utils";
import type { Registration } from "@/types";
import {
  DataTable,
  EmptyState,
  ErrorState,
  FiltersBar,
  PageHeader,
  Pagination,
  SearchBar,
  TableSkeleton,
  type ColumnDef,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { StudentDrawer } from "./student-drawer";

const PAGE_SIZE = 10;

function exportToCsv(registrations: Registration[], filename: string) {
  const headers = [
    "Student Name",
    "School/College",
    "Class",
    "Stream",
    "Board",
    "Seminar",
    "City",
    "Gender",
    "Student Mobile Number",
    "Parent Mobile Number",
    "Email Address",
  ];

  const rows = registrations.map((r) => [
    r.studentName,
    r.college,
    r.classLabel ?? "",
    r.interestedStream ?? "",
    r.board ?? "",
    getPrimarySeminar(r),
    r.city,
    r.gender ?? "",
    r.phone,
    r.parentPhone ?? "",
    r.email,
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function uniqueSorted(
  values: Array<string | undefined>
): Array<{ label: string; value: string }> {
  return [...new Set(values.filter(Boolean) as string[])]
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ label: value, value }));
}

function registrationMatchesSeminar(
  registration: Registration,
  seminar: string
): boolean {
  const interests = registration.seminarInterests?.filter(Boolean) ?? [];
  if (interests.some((entry) => entry === seminar)) return true;
  return interests.length === 0 && getPrimarySeminar(registration) === seminar;
}

export function RegistrationsList() {
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<string[]>([]);
  const [classFilter, setClassFilter] = useState("all");
  const [streamFilter, setStreamFilter] = useState("all");
  const [boardFilter, setBoardFilter] = useState("all");
  const [seminarFilter, setSeminarFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedRegistration, setSelectedRegistration] =
    useState<Registration | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["registrations"],
    queryFn: () => registrationsService.getAll(),
  });

  const eventsQuery = useQuery({
    queryKey: ["events"],
    queryFn: () => eventsService.getAll(),
  });

  const registrations = data ?? [];
  const catalogEvents = eventsQuery.data ?? [];

  const validEventIdsKey = useMemo(
    () => catalogEvents.map((event) => event.id).sort().join(","),
    [catalogEvents]
  );

  useEffect(() => {
    const validIds = new Set(validEventIdsKey.split(",").filter(Boolean));
    if (validIds.size === 0) return;
    setEventFilter((prev) => {
      const next = prev.filter((id) => validIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [validEventIdsKey]);

  const linkedRegistrations = useMemo(() => {
    const validIds = new Set(catalogEvents.map((event) => event.id));
    return filterRegistrationsForEventCatalog(registrations, validIds);
  }, [registrations, catalogEvents]);

  const eventOptions = useMemo(() => {
    return [...catalogEvents]
      .sort(
        (a, b) =>
          a.city.localeCompare(b.city) || a.title.localeCompare(b.title)
      )
      .map((event) => ({
        label: `${event.city} · ${event.title}`,
        value: event.id,
      }));
  }, [catalogEvents]);

  const eventTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const event of catalogEvents) {
      map.set(event.id, event.title);
    }
    return map;
  }, [catalogEvents]);

  const classOptions = useMemo(() => {
    const order = [
      "Class 4",
      "Class 5",
      "Class 6",
      "Class 7",
      "Class 8",
      "Class 9",
      "Class 10",
      "Class 11",
      "Class 12",
    ];
    const present = new Set(
      linkedRegistrations.map((r) => r.classLabel).filter(Boolean)
    );
    return order
      .filter((value) => present.has(value))
      .map((value) => ({ label: value, value }));
  }, [linkedRegistrations]);
  const streamOptions = useMemo(
    () => uniqueSorted(linkedRegistrations.map((r) => r.interestedStream)),
    [linkedRegistrations]
  );
  const boardOptions = useMemo(
    () => uniqueSorted(linkedRegistrations.map((r) => r.board)),
    [linkedRegistrations]
  );
  const cityOptions = useMemo(
    () => uniqueSorted(linkedRegistrations.map((r) => r.city)),
    [linkedRegistrations]
  );
  const genderOptions = useMemo(
    () => uniqueSorted(linkedRegistrations.map((r) => r.gender)),
    [linkedRegistrations]
  );
  const seminarOptions = useMemo(() => {
    const titles = new Set<string>();
    for (const registration of linkedRegistrations) {
      for (const seminar of registration.seminarInterests ?? []) {
        const trimmed = seminar.trim();
        if (trimmed) titles.add(trimmed);
      }
      const primary = getPrimarySeminar(registration);
      if (primary !== "—") titles.add(primary);
    }
    for (const event of catalogEvents) {
      for (const seminar of event.seminars ?? []) {
        const trimmed = seminar.title?.trim();
        if (trimmed) titles.add(trimmed);
      }
    }
    return [...titles]
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ label: value, value }));
  }, [linkedRegistrations, catalogEvents]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return linkedRegistrations.filter((r) => {
      if (!registrationMatchesEventFilter(r, eventFilter)) return false;
      if (classFilter !== "all" && r.classLabel !== classFilter) return false;
      if (streamFilter !== "all" && r.interestedStream !== streamFilter)
        return false;
      if (boardFilter !== "all" && r.board !== boardFilter) return false;
      if (
        seminarFilter !== "all" &&
        !registrationMatchesSeminar(r, seminarFilter)
      ) {
        return false;
      }
      if (cityFilter !== "all" && r.city !== cityFilter) return false;
      if (genderFilter !== "all" && r.gender !== genderFilter) return false;

      if (!query) return true;

      return (
        r.studentName.toLowerCase().includes(query) ||
        r.email.toLowerCase().includes(query) ||
        r.phone.includes(query) ||
        (r.parentPhone ?? "").includes(query) ||
        r.college.toLowerCase().includes(query) ||
        (r.classLabel ?? "").toLowerCase().includes(query) ||
        (r.interestedStream ?? "").toLowerCase().includes(query) ||
        (r.board ?? "").toLowerCase().includes(query) ||
        getPrimarySeminar(r).toLowerCase().includes(query) ||
        r.city.toLowerCase().includes(query)
      );
    });
  }, [
    linkedRegistrations,
    search,
    eventFilter,
    classFilter,
    streamFilter,
    boardFilter,
    seminarFilter,
    cityFilter,
    genderFilter,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const handleView = (registration: Registration) => {
    setSelectedRegistration(registration);
    setDrawerOpen(true);
  };

  const handleExport = (items: Registration[]) => {
    if (items.length === 0) {
      toast.error("No registrations to export");
      return;
    }
    exportToCsv(
      items,
      `registrations-${new Date().toISOString().slice(0, 10)}.csv`
    );
    toast.success(`Exported ${items.length} registration(s)`);
  };

  const clearFilters = () => {
    setEventFilter([]);
    setClassFilter("all");
    setStreamFilter("all");
    setBoardFilter("all");
    setSeminarFilter("all");
    setCityFilter("all");
    setGenderFilter("all");
    setSearch("");
    setPage(1);
  };

  const hasActiveFilters =
    Boolean(search.trim()) ||
    eventFilter.length > 0 ||
    classFilter !== "all" ||
    streamFilter !== "all" ||
    boardFilter !== "all" ||
    seminarFilter !== "all" ||
    cityFilter !== "all" ||
    genderFilter !== "all";

  const columns: ColumnDef<Registration, unknown>[] = [
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
        <span className="line-clamp-2 max-w-[200px] text-sm">
          {row.original.college}
        </span>
      ),
    },
    {
      id: "eventTitle",
      header: "Event",
      cell: ({ row }) => (
        <span className="line-clamp-2 max-w-[220px] text-sm">
          {eventTitleById.get(row.original.eventId) ?? row.original.eventTitle}
        </span>
      ),
    },
    {
      accessorKey: "classLabel",
      header: "Class",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm">
          {row.original.classLabel ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "interestedStream",
      header: "Stream",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm">
          {row.original.interestedStream ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "board",
      header: "Board",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm">
          {row.original.board ?? "—"}
        </span>
      ),
    },
    {
      id: "seminarInterests",
      header: "Seminar",
      cell: ({ row }) => (
        <span className="line-clamp-2 max-w-[220px] text-sm">
          {getPrimarySeminar(row.original)}
        </span>
      ),
    },
    {
      accessorKey: "city",
      header: "City",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm">{row.original.city}</span>
      ),
    },
    {
      accessorKey: "gender",
      header: "Gender",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm">
          {row.original.gender ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "phone",
      header: "Student Mobile Number",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm">{row.original.phone}</span>
      ),
    },
    {
      accessorKey: "parentPhone",
      header: "Parent Mobile Number",
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
        <span className="max-w-[200px] truncate text-sm">
          {row.original.email}
        </span>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Registrations"
          description="Manage student registrations across all Career Utsav events."
        />
        <TableSkeleton rows={8} columns={12} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Registrations" />
        <ErrorState
          title="Failed to load registrations"
          message="We couldn't fetch registration data. Please try again."
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registrations"
        description="Manage student registrations across all Career Utsav events."
        actions={
          <Button
            variant="outline"
            onClick={() => handleExport(filtered)}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search by name, school, email, or mobile…"
          containerClassName="max-w-xl"
        />
        <p className="text-sm text-muted-foreground">
          {formatNumber(filtered.length)} registration
          {filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      <FiltersBar
        filters={[
          {
            id: "event",
            label: "Event",
            mode: "multi",
            values: eventFilter,
            onChange: (v) => {
              setEventFilter(v);
              setPage(1);
            },
            options: eventOptions,
            placeholder: "All events",
          },
          {
            id: "class",
            label: "Class",
            value: classFilter,
            onChange: (v) => {
              setClassFilter(v);
              setPage(1);
            },
            options: classOptions,
          },
          {
            id: "stream",
            label: "Stream",
            value: streamFilter,
            onChange: (v) => {
              setStreamFilter(v);
              setPage(1);
            },
            options: streamOptions,
          },
          {
            id: "board",
            label: "Board",
            value: boardFilter,
            onChange: (v) => {
              setBoardFilter(v);
              setPage(1);
            },
            options: boardOptions,
          },
          {
            id: "seminar",
            label: "Seminar",
            value: seminarFilter,
            onChange: (v) => {
              setSeminarFilter(v);
              setPage(1);
            },
            options: seminarOptions,
            placeholder: "All seminars",
          },
          {
            id: "city",
            label: "City",
            value: cityFilter,
            onChange: (v) => {
              setCityFilter(v);
              setPage(1);
            },
            options: cityOptions,
          },
          {
            id: "gender",
            label: "Gender",
            value: genderFilter,
            onChange: (v) => {
              setGenderFilter(v);
              setPage(1);
            },
            options: genderOptions,
          },
        ]}
        onClearAll={clearFilters}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No registrations found"
          description={
            hasActiveFilters
              ? "Try adjusting your search or filters to find registrations."
              : "Student registrations will appear here once events are live."
          }
          action={
            hasActiveFilters
              ? { label: "Clear filters", onClick: clearFilters }
              : undefined
          }
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={paginated}
            getRowId={(row) => row.id}
            onRowClick={handleView}
            emptyMessage="No registrations on this page."
          />

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            showPageInfo
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
          />
        </>
      )}

      <StudentDrawer
        registration={selectedRegistration}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
