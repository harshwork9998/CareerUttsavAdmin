"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Users } from "lucide-react";
import { toast } from "sonner";

import { eventsService, registrationsService } from "@/services/api";
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
const EVENT_CITIES = ["Bangalore", "Mysore", "Hubli"] as const;

function resolveEventCity(
  registration: Registration,
  eventCityById: Map<string, string>
): string | null {
  const fromEvent = eventCityById.get(registration.eventId);
  if (
    fromEvent &&
    EVENT_CITIES.includes(fromEvent as (typeof EVENT_CITIES)[number])
  ) {
    return fromEvent;
  }
  const title = registration.eventTitle.toLowerCase();
  if (title.includes("bangalore") || title.includes("bengaluru")) {
    return "Bangalore";
  }
  if (title.includes("mysore") || title.includes("mysuru")) return "Mysore";
  if (title.includes("hubli") || title.includes("hubballi")) return "Hubli";
  return null;
}

function exportToCsv(registrations: Registration[], filename: string) {
  const headers = [
    "Student Name",
    "School/College",
    "Class",
    "Stream",
    "Board",
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

export function RegistrationsList() {
  const [search, setSearch] = useState("");
  const [eventCityFilter, setEventCityFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [streamFilter, setStreamFilter] = useState("all");
  const [boardFilter, setBoardFilter] = useState("all");
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

  const eventCityById = useMemo(() => {
    const map = new Map<string, string>();
    for (const event of eventsQuery.data ?? []) {
      map.set(event.id, event.city);
    }
    return map;
  }, [eventsQuery.data]);

  const eventCityOptions = EVENT_CITIES.map((city) => ({
    label: city,
    value: city,
  }));

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
      registrations.map((r) => r.classLabel).filter(Boolean)
    );
    return order
      .filter((value) => present.has(value))
      .map((value) => ({ label: value, value }));
  }, [registrations]);
  const streamOptions = useMemo(
    () => uniqueSorted(registrations.map((r) => r.interestedStream)),
    [registrations]
  );
  const boardOptions = useMemo(
    () => uniqueSorted(registrations.map((r) => r.board)),
    [registrations]
  );
  const cityOptions = useMemo(
    () => uniqueSorted(registrations.map((r) => r.city)),
    [registrations]
  );
  const genderOptions = useMemo(
    () => uniqueSorted(registrations.map((r) => r.gender)),
    [registrations]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return registrations.filter((r) => {
      if (eventCityFilter !== "all") {
        const eventCity = resolveEventCity(r, eventCityById);
        if (eventCity !== eventCityFilter) return false;
      }
      if (classFilter !== "all" && r.classLabel !== classFilter) return false;
      if (streamFilter !== "all" && r.interestedStream !== streamFilter)
        return false;
      if (boardFilter !== "all" && r.board !== boardFilter) return false;
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
        r.city.toLowerCase().includes(query)
      );
    });
  }, [
    registrations,
    search,
    eventCityFilter,
    eventCityById,
    classFilter,
    streamFilter,
    boardFilter,
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
    setEventCityFilter("all");
    setClassFilter("all");
    setStreamFilter("all");
    setBoardFilter("all");
    setCityFilter("all");
    setGenderFilter("all");
    setSearch("");
    setPage(1);
  };

  const hasActiveFilters =
    Boolean(search.trim()) ||
    eventCityFilter !== "all" ||
    classFilter !== "all" ||
    streamFilter !== "all" ||
    boardFilter !== "all" ||
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
        <TableSkeleton rows={8} columns={10} />
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
            value: eventCityFilter,
            onChange: (v) => {
              setEventCityFilter(v);
              setPage(1);
            },
            options: eventCityOptions,
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
