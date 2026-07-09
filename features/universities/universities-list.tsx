"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  ChevronRight,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";

import { universitiesService } from "@/services/api";
import { UNIVERSITY_STATUSES } from "@/constants";
import { formatDate, formatNumber } from "@/lib/utils";
import type { University } from "@/types";
import {
  EmptyState,
  ErrorState,
  FiltersBar,
  PageHeader,
  Pagination,
  SearchBar,
  StatusChip,
  TableSkeleton,
} from "@/components/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 8;

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function UniversitiesList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["universities"],
    queryFn: () => universitiesService.getAll(),
  });

  const universities = data ?? [];

  const typeOptions = useMemo(() => {
    const types = [...new Set(universities.map((u) => u.type))];
    return types.map((type) => ({ label: type, value: type }));
  }, [universities]);

  const stateOptions = useMemo(() => {
    const states = [...new Set(universities.map((u) => u.state))].sort();
    return states.map((state) => ({ label: state, value: state }));
  }, [universities]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return universities.filter((u) => {
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (typeFilter !== "all" && u.type !== typeFilter) return false;
      if (stateFilter !== "all" && u.state !== stateFilter) return false;

      if (!query) return true;

      return (
        u.name.toLowerCase().includes(query) ||
        (u.shortName?.toLowerCase().includes(query) ?? false) ||
        u.city.toLowerCase().includes(query) ||
        u.contactPerson.toLowerCase().includes(query) ||
        u.contactEmail.toLowerCase().includes(query)
      );
    });
  }, [universities, search, statusFilter, typeFilter, stateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const statusCounts = useMemo(() => {
    return UNIVERSITY_STATUSES.reduce<Record<string, number>>((acc, status) => {
      acc[status] = universities.filter((u) => u.status === status).length;
      return acc;
    }, {});
  }, [universities]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setStateFilter("all");
    setPage(1);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Universities"
          description="Review and manage university partner applications."
        />
        <TableSkeleton rows={8} columns={6} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Universities" />
        <ErrorState
          title="Failed to load universities"
          message="We couldn't fetch university data. Please try again."
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Universities"
        description="Review and manage university partner applications, booth assignments, and approvals."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {UNIVERSITY_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === status ? "all" : status);
              setPage(1);
            }}
            className={`rounded-xl border p-4 text-left transition-all hover:border-primary/30 hover:shadow-card ${
              statusFilter === status ? "border-primary/40 bg-primary/5" : "bg-card"
            }`}
          >
            <p className="text-2xl font-bold text-foreground">
              {formatNumber(statusCounts[status] ?? 0)}
            </p>
            <StatusChip status={status} className="mt-2" />
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search universities, contacts, or cities..."
          containerClassName="max-w-xl"
        />
        <p className="text-sm text-muted-foreground">
          {formatNumber(filtered.length)} universit
          {filtered.length !== 1 ? "ies" : "y"}
        </p>
      </div>

      <FiltersBar
        filters={[
          {
            id: "status",
            label: "Approval Status",
            value: statusFilter,
            onChange: (v) => {
              setStatusFilter(v);
              setPage(1);
            },
            options: UNIVERSITY_STATUSES.map((s) => ({
              label: s,
              value: s,
            })),
          },
          {
            id: "type",
            label: "Type",
            value: typeFilter,
            onChange: (v) => {
              setTypeFilter(v);
              setPage(1);
            },
            options: typeOptions,
          },
          {
            id: "state",
            label: "State",
            value: stateFilter,
            onChange: (v) => {
              setStateFilter(v);
              setPage(1);
            },
            options: stateOptions,
          },
        ]}
        onClearAll={clearFilters}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No universities found"
          description="Try adjusting your search or filters to find university partners."
          action={
            search || statusFilter !== "all"
              ? { label: "Clear filters", onClick: clearFilters }
              : undefined
          }
        />
      ) : (
        <>
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>University</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Booth</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((university) => (
                  <UniversityRow key={university.id} university={university} />
                ))}
              </TableBody>
            </Table>
          </div>

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
    </div>
  );
}

function UniversityRow({ university }: { university: University }) {
  return (
    <TableRow className="group">
      <TableCell>
        <Link
          href={`/universities/${university.id}`}
          className="flex items-center gap-3"
        >
          <Avatar className="h-10 w-10">
            {university.logo && (
              <AvatarImage src={university.logo} alt={university.name} />
            )}
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {getInitials(university.shortName ?? university.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium text-foreground group-hover:text-primary">
              {university.name}
            </p>
            {university.shortName && (
              <p className="text-xs text-muted-foreground">
                {university.shortName}
              </p>
            )}
            <Badge variant="outline" className="mt-1 text-[10px] font-normal">
              {university.type}
            </Badge>
          </div>
        </Link>
      </TableCell>
      <TableCell>
        <StatusChip status={university.status} />
      </TableCell>
      <TableCell>
        {university.stallNumber ? (
          <Badge variant="secondary" className="gap-1 font-mono">
            <Building2 className="h-3 w-3" />
            {university.stallNumber}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">Not assigned</span>
        )}
      </TableCell>
      <TableCell>
        <div className="space-y-1 text-sm">
          <p className="font-medium">{university.contactPerson}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Mail className="h-3 w-3" />
            {university.contactEmail}
          </p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" />
            {university.contactPhone}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-sm">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
          {university.city}, {university.state}
        </div>
      </TableCell>
      <TableCell>
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {formatDate(university.submittedAt)}
        </span>
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link href={`/universities/${university.id}`}>
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">View details</span>
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}
