"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Download, Plus, Users } from "lucide-react";
import { toast } from "sonner";

import { eventsService, registrationsService } from "@/services/api";
import { getPrimarySeminar } from "@/lib/enrich-registration";
import {
  filterRegistrationsByKind,
  isPartnerRegistrationEntry,
  isSchoolRegistration,
  isStudentRegistration,
  REGISTRATION_KIND_LABELS,
  REGISTRATION_KIND_SHORT_LABELS,
  REGISTRATION_KINDS,
} from "@/lib/registration-kinds";
import {
  filterRegistrationsForEventCatalog,
  registrationMatchesEventFilter,
} from "@/lib/registration-event-links";
import {
  registrationMatchesAllSeminars,
  slugifySeminarFilters,
} from "@/lib/registration-seminar-filters";
import { cn, formatNumber } from "@/lib/utils";
import type { Registration, RegistrationKind } from "@/types";
import type { FilterConfig } from "@/components/shared";
import {
  DataTable,
  EmptyState,
  ErrorState,
  FiltersBar,
  PageHeader,
  Pagination,
  SearchBar,
  TableSkeleton,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddStudentDialog } from "./add-student-dialog";
import { AddKindRegistrationDialog } from "./add-kind-registration-dialog";
import { RegistrationDetailDrawer } from "./registration-detail-drawer";
import {
  buildRegistrationColumns,
  exportHeadersForKind,
  exportRowForKind,
  registrationMatchesSearch,
} from "./registration-table-config";

const PAGE_SIZE = 10;

function exportToCsv(
  registrations: Registration[],
  filename: string,
  kind: RegistrationKind,
  eventTitleById: Map<string, string>
) {
  const headers = exportHeadersForKind(kind);
  const rows = registrations.map((registration) =>
    exportRowForKind(registration, eventTitleById)
  );
  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell: string) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
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

function registrationCity(registration: Registration): string | undefined {
  if (isStudentRegistration(registration)) return registration.city;
  if (isSchoolRegistration(registration)) return registration.schoolCity;
  if (isPartnerRegistrationEntry(registration)) return registration.partnerRegCity;
  return undefined;
}

function searchPlaceholderForKind(kind: RegistrationKind): string {
  switch (kind) {
    case "student":
      return "Search by name, school, email, or mobile…";
    case "school":
      return "Search by contact name, school, city, or email…";
    case "partner_registration":
      return "Search by name, institution, city, or email…";
    case "student_ambassador":
      return "Search by name, school/college, class, or email…";
  }
}

export function RegistrationsList() {
  const [activeKind, setActiveKind] = useState<RegistrationKind>("student");
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<string[]>([]);
  const [classFilter, setClassFilter] = useState("all");
  const [streamFilter, setStreamFilter] = useState("all");
  const [boardFilter, setBoardFilter] = useState("all");
  const [seminarFilter, setSeminarFilter] = useState<string[]>([]);
  const [cityFilter, setCityFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedRegistration, setSelectedRegistration] =
    useState<Registration | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addKindDialog, setAddKindDialog] = useState<
    "school" | "partner_registration" | "student_ambassador" | null
  >(null);

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

  const kindCounts = useMemo(() => {
    const counts = Object.fromEntries(
      REGISTRATION_KINDS.map((kind) => [kind, 0])
    ) as Record<RegistrationKind, number>;
    for (const registration of linkedRegistrations) {
      counts[registration.kind] += 1;
    }
    return counts;
  }, [linkedRegistrations]);

  const kindRegistrations = useMemo(
    () => filterRegistrationsByKind(linkedRegistrations, activeKind),
    [linkedRegistrations, activeKind]
  );

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

  const studentRegistrations = useMemo(
    () =>
      activeKind === "student"
        ? kindRegistrations.filter(isStudentRegistration)
        : [],
    [activeKind, kindRegistrations]
  );

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
      studentRegistrations.map((r) => r.classLabel).filter(Boolean)
    );
    return order
      .filter((value) => present.has(value))
      .map((value) => ({ label: value, value }));
  }, [studentRegistrations]);

  const streamOptions = useMemo(
    () =>
      uniqueSorted(studentRegistrations.map((r) => r.interestedStream)),
    [studentRegistrations]
  );
  const boardOptions = useMemo(
    () => uniqueSorted(studentRegistrations.map((r) => r.board)),
    [studentRegistrations]
  );
  const cityOptions = useMemo(
    () => uniqueSorted(kindRegistrations.map((r) => registrationCity(r))),
    [kindRegistrations]
  );
  const genderOptions = useMemo(
    () => uniqueSorted(studentRegistrations.map((r) => r.gender)),
    [studentRegistrations]
  );
  const seminarOptions = useMemo(() => {
    const titles = new Set<string>();
    for (const registration of studentRegistrations) {
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
  }, [studentRegistrations, catalogEvents]);

  useEffect(() => {
    setClassFilter("all");
    setStreamFilter("all");
    setBoardFilter("all");
    setSeminarFilter([]);
    setCityFilter("all");
    setGenderFilter("all");
    setPage(1);
  }, [activeKind]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return kindRegistrations.filter((r) => {
      if (!registrationMatchesEventFilter(r, eventFilter)) return false;

      if (isStudentRegistration(r)) {
        if (classFilter !== "all" && r.classLabel !== classFilter) return false;
        if (streamFilter !== "all" && r.interestedStream !== streamFilter)
          return false;
        if (boardFilter !== "all" && r.board !== boardFilter) return false;
        if (!registrationMatchesAllSeminars(r, seminarFilter)) return false;
        if (cityFilter !== "all" && r.city !== cityFilter) return false;
        if (genderFilter !== "all" && r.gender !== genderFilter) return false;
      } else if (cityFilter !== "all") {
        const city = registrationCity(r);
        if (city !== cityFilter) return false;
      }

      if (!query) return true;
      return registrationMatchesSearch(r, query);
    });
  }, [
    kindRegistrations,
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

  const columns = useMemo(
    () => buildRegistrationColumns(activeKind, eventTitleById),
    [activeKind, eventTitleById]
  );

  const handleView = (registration: Registration) => {
    setSelectedRegistration(registration);
    setDrawerOpen(true);
  };

  const handleExport = (items: Registration[]) => {
    if (items.length === 0) {
      toast.error("No registrations to export");
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    const kindSlug =
      activeKind === "partner_registration" ? "partners" : activeKind;
    const filename =
      activeKind === "student" && seminarFilter.length > 0
        ? `registrations-${slugifySeminarFilters(seminarFilter)}-${date}.csv`
        : `registrations-${kindSlug}-${date}.csv`;
    exportToCsv(items, filename, activeKind, eventTitleById);
    toast.success(`Exported ${items.length} registration(s)`);
  };

  const clearFilters = () => {
    setEventFilter([]);
    setClassFilter("all");
    setStreamFilter("all");
    setBoardFilter("all");
    setSeminarFilter([]);
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
    seminarFilter.length > 0 ||
    cityFilter !== "all" ||
    genderFilter !== "all";

  const filterConfig = useMemo((): FilterConfig[] => {
    const filters: FilterConfig[] = [
      {
        id: "event",
        label: "Event",
        mode: "multi" as const,
        values: eventFilter,
        onChange: (v: string[]) => {
          setEventFilter(v);
          setPage(1);
        },
        options: eventOptions,
        placeholder: "All events",
      },
    ];

    if (activeKind === "student") {
      filters.push(
        {
          id: "class",
          label: "Class",
          value: classFilter,
          onChange: (v: string) => {
            setClassFilter(v);
            setPage(1);
          },
          options: classOptions,
        },
        {
          id: "stream",
          label: "Stream",
          value: streamFilter,
          onChange: (v: string) => {
            setStreamFilter(v);
            setPage(1);
          },
          options: streamOptions,
        },
        {
          id: "board",
          label: "Board",
          value: boardFilter,
          onChange: (v: string) => {
            setBoardFilter(v);
            setPage(1);
          },
          options: boardOptions,
        },
        {
          id: "seminar",
          label: "Seminar",
          mode: "multi" as const,
          values: seminarFilter,
          onChange: (v: string[]) => {
            setSeminarFilter(v);
            setPage(1);
          },
          options: seminarOptions,
          placeholder: "All seminars",
          hint:
            seminarFilter.length > 1
              ? "Showing students registered for ALL selected seminars."
              : "Select multiple seminars to find students common to every choice.",
          className: "min-w-[220px] sm:min-w-[260px]",
        }
      );
    }

    if (activeKind !== "student_ambassador") {
      filters.push({
        id: "city",
        label: "City",
        value: cityFilter,
        onChange: (v: string) => {
          setCityFilter(v);
          setPage(1);
        },
        options: cityOptions,
      });
    }

    if (activeKind === "student") {
      filters.push({
        id: "gender",
        label: "Gender",
        value: genderFilter,
        onChange: (v: string) => {
          setGenderFilter(v);
          setPage(1);
        },
        options: genderOptions,
      });
    }

    return filters;
  }, [
    activeKind,
    eventFilter,
    eventOptions,
    classFilter,
    classOptions,
    streamFilter,
    streamOptions,
    boardFilter,
    boardOptions,
    seminarFilter,
    seminarOptions,
    cityFilter,
    cityOptions,
    genderFilter,
    genderOptions,
  ]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Registrations"
          description="Manage all registration types across Career Uttsav events."
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
        description="Manage student, school, partner, and ambassador registrations across all Career Uttsav events."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="gap-2"
                  disabled={catalogEvents.length === 0}
                >
                  <Plus className="h-4 w-4" />
                  Add registration
                  <ChevronDown className="h-4 w-4 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {REGISTRATION_KINDS.map((kind) => (
                  <DropdownMenuItem
                    key={kind}
                    onClick={() => {
                      if (kind === "student") {
                        setAddDialogOpen(true);
                      } else {
                        setAddKindDialog(kind);
                      }
                    }}
                  >
                    {REGISTRATION_KIND_LABELS[kind]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              onClick={() => handleExport(filtered)}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        }
      />

      <Tabs
        value={activeKind}
        onValueChange={(value) => setActiveKind(value as RegistrationKind)}
      >
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
          {REGISTRATION_KINDS.map((kind) => (
            <TabsTrigger
              key={kind}
              value={kind}
              className={cn(
                "rounded-lg border border-transparent px-3 py-2 data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:shadow-sm"
              )}
            >
              {REGISTRATION_KIND_SHORT_LABELS[kind]}
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                {formatNumber(kindCounts[kind])}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder={searchPlaceholderForKind(activeKind)}
          containerClassName="max-w-xl"
        />
        <p className="text-sm text-muted-foreground">
          {formatNumber(filtered.length)} {REGISTRATION_KIND_SHORT_LABELS[activeKind].toLowerCase()}
          {filtered.length !== 1 ? "" : ""} registration
          {filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      <FiltersBar filters={filterConfig} onClearAll={clearFilters} />

      {activeKind === "student" && seminarFilter.length >= 2 ? (
        <div className="rounded-xl border border-brand-700/15 bg-brand-50/50 px-4 py-3 text-sm text-brand-950">
          <p className="font-medium">
            Common students across {seminarFilter.length} seminars
          </p>
          <p className="mt-1 text-brand-900/75">
            Showing {formatNumber(filtered.length)} student
            {filtered.length === 1 ? "" : "s"} registered for{" "}
            <span className="font-medium">all</span> of:{" "}
            {seminarFilter.join(" · ")}
          </p>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={`No ${REGISTRATION_KIND_SHORT_LABELS[activeKind].toLowerCase()} found`}
          description={
            hasActiveFilters
              ? "Try adjusting your search or filters to find registrations."
              : `${REGISTRATION_KIND_LABELS[activeKind]} entries will appear here once events are live.`
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

      <AddStudentDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        events={catalogEvents}
      />

      {addKindDialog ? (
        <AddKindRegistrationDialog
          kind={addKindDialog}
          open={Boolean(addKindDialog)}
          onOpenChange={(open) => {
            if (!open) setAddKindDialog(null);
          }}
          events={catalogEvents}
        />
      ) : null}

      <RegistrationDetailDrawer
        registration={selectedRegistration}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
