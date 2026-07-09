"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";

import { activityLogsService } from "@/services/api";
import { formatDateTime } from "@/lib/utils";
import type { ActivityLog, ActivityResourceType } from "@/types";
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
import { Badge } from "@/components/ui/badge";

const PAGE_SIZE = 10;

const MODULES: ActivityResourceType[] = [
  "event",
  "registration",
  "university",
  "partner",
  "blog",
  "gallery",
  "notification",
  "user",
  "role",
  "settings",
  "report",
  "system",
];

export function ActivityLogsList() {
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["activity-logs"],
    queryFn: () => activityLogsService.getAll(),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase();
    return data.filter((log) => {
      const matchesSearch =
        !q ||
        log.userName.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.details?.toLowerCase().includes(q) ||
        log.ipAddress?.includes(q);
      const matchesModule = moduleFilter === "all" || log.resource === moduleFilter;
      return matchesSearch && matchesModule;
    });
  }, [data, search, moduleFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: ColumnDef<ActivityLog>[] = [
    {
      accessorKey: "userName",
      header: "User",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.userName}</p>
          <p className="text-xs text-muted-foreground">{row.original.userId}</p>
        </div>
      ),
    },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => (
        <div>
          <p className="text-sm">{row.original.action}</p>
          {row.original.details && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              {row.original.details}
            </p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "resource",
      header: "Module",
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.resource}
        </Badge>
      ),
    },
    {
      accessorKey: "timestamp",
      header: "Timestamp",
      cell: ({ row }) => (
        <span className="text-sm whitespace-nowrap">
          {formatDateTime(row.original.timestamp)}
        </span>
      ),
    },
    {
      accessorKey: "ipAddress",
      header: "IP",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.ipAddress ?? "—"}
        </span>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Activity Logs" />
        <TableSkeleton rows={8} columns={5} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Activity Logs" />
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Logs"
        description="Audit trail of admin actions across all modules."
      />

      <SearchBar
        value={search}
        onChange={(v) => { setSearch(v); setPage(1); }}
        placeholder="Search by user, action, or IP..."
      />

      <FiltersBar
        filters={[
          {
            id: "module",
            label: "Module",
            value: moduleFilter,
            onChange: (v) => { setModuleFilter(v); setPage(1); },
            options: MODULES.map((m) => ({ label: m, value: m })),
          },
        ]}
        onClearAll={() => { setModuleFilter("all"); setPage(1); }}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity logs found"
          description="Try adjusting your search or filters."
        />
      ) : (
        <>
          <DataTable columns={columns} data={paginated} />
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
