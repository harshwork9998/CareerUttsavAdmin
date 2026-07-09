"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Download,
  Eye,
  MoreHorizontal,
  QrCode,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { registrationsService } from "@/services/api";
import { REGISTRATION_STATUSES } from "@/constants";
import { formatDate, formatNumber } from "@/lib/utils";
import type { Registration, RegistrationStatus } from "@/types";
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
  type RowSelectionState,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StudentDrawer } from "./student-drawer";

const PAGE_SIZE = 10;

function hasQrGenerated(registration: Registration) {
  return (
    registration.status === "Confirmed" || registration.status === "Checked In"
  );
}

function exportToCsv(registrations: Registration[], filename: string) {
  const headers = [
    "Registration Number",
    "Name",
    "Email",
    "Phone",
    "College",
    "Course",
    "City",
    "State",
    "Status",
    "Payment Status",
    "Event",
    "Registered At",
  ];

  const rows = registrations.map((r) => [
    r.registrationNumber,
    r.studentName,
    r.email,
    r.phone,
    r.college,
    r.course,
    r.city,
    r.state,
    r.status,
    r.paymentStatus,
    r.eventTitle,
    r.registeredAt,
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

export function RegistrationsList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [selectedRegistration, setSelectedRegistration] =
    useState<Registration | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<"confirm" | "cancel" | null>(
    null
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["registrations"],
    queryFn: () => registrationsService.getAll(),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data: updateData,
    }: {
      id: string;
      data: Partial<Registration>;
    }) => registrationsService.update(id, updateData),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["registrations"] });
    },
  });

  const registrations = data ?? [];

  const eventOptions = useMemo(() => {
    const events = [...new Set(registrations.map((r) => r.eventTitle))];
    return events.map((event) => ({ label: event, value: event }));
  }, [registrations]);

  const cityOptions = useMemo(() => {
    const cities = [...new Set(registrations.map((r) => r.city))].sort();
    return cities.map((city) => ({ label: city, value: city }));
  }, [registrations]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return registrations.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (eventFilter !== "all" && r.eventTitle !== eventFilter) return false;
      if (cityFilter !== "all" && r.city !== cityFilter) return false;
      if (paymentFilter !== "all" && r.paymentStatus !== paymentFilter)
        return false;

      if (!query) return true;

      return (
        r.studentName.toLowerCase().includes(query) ||
        r.email.toLowerCase().includes(query) ||
        r.phone.includes(query) ||
        r.college.toLowerCase().includes(query) ||
        r.registrationNumber.toLowerCase().includes(query) ||
        r.course.toLowerCase().includes(query)
      );
    });
  }, [
    registrations,
    search,
    statusFilter,
    eventFilter,
    cityFilter,
    paymentFilter,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const selectedIds = Object.keys(rowSelection).filter(
    (id) => rowSelection[id]
  );
  const selectedCount = selectedIds.length;

  const handleView = (registration: Registration) => {
    setSelectedRegistration(registration);
    setDrawerOpen(true);
  };

  const handleBulkConfirm = async () => {
    try {
      await Promise.all(
        selectedIds.map((id) =>
          updateMutation.mutateAsync({
            id,
            data: { status: "Confirmed" as RegistrationStatus },
          })
        )
      );
      toast.success(`Confirmed ${selectedIds.length} registration(s)`);
      setRowSelection({});
      setBulkAction(null);
    } catch {
      toast.error("Failed to update registrations");
    }
  };

  const handleBulkCancel = async () => {
    try {
      await Promise.all(
        selectedIds.map((id) =>
          updateMutation.mutateAsync({
            id,
            data: { status: "Cancelled" as RegistrationStatus },
          })
        )
      );
      toast.success(`Cancelled ${selectedIds.length} registration(s)`);
      setRowSelection({});
      setBulkAction(null);
    } catch {
      toast.error("Failed to cancel registrations");
    }
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
    setStatusFilter("all");
    setEventFilter("all");
    setCityFilter("all");
    setPaymentFilter("all");
    setSearch("");
    setPage(1);
  };

  const columns: ColumnDef<Registration, unknown>[] = [
    {
      accessorKey: "studentName",
      header: "Name",
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-foreground">{row.original.studentName}</p>
          <p className="text-xs text-muted-foreground">{row.original.email}</p>
        </div>
      ),
    },
    {
      accessorKey: "college",
      header: "College",
      cell: ({ row }) => (
        <span className="line-clamp-2 max-w-[200px] text-sm">
          {row.original.college}
        </span>
      ),
    },
    {
      accessorKey: "city",
      header: "City",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.city}</span>
      ),
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm">{row.original.phone}</span>
      ),
    },
    {
      accessorKey: "course",
      header: "Course",
      cell: ({ row }) => (
        <span className="line-clamp-1 max-w-[140px] text-sm">
          {row.original.course}
        </span>
      ),
    },
    {
      accessorKey: "registeredAt",
      header: "Registration Date",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm">
          {formatDate(row.original.registeredAt)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusChip status={row.original.status} />,
    },
    {
      id: "qrGenerated",
      header: "QR Generated",
      enableSorting: false,
      cell: ({ row }) => {
        const generated = hasQrGenerated(row.original);
        return (
          <Badge
            variant={generated ? "success" : "muted"}
            className="gap-1 font-normal"
          >
            <QrCode className="h-3 w-3" />
            {generated ? "Yes" : "No"}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleView(row.original)}>
              <Eye className="h-4 w-4" />
              View Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                updateMutation.mutate({
                  id: row.original.id,
                  data: { status: "Confirmed" },
                })
              }
            >
              <CheckCircle2 className="h-4 w-4" />
              Mark Confirmed
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() =>
                updateMutation.mutate({
                  id: row.original.id,
                  data: { status: "Cancelled" },
                })
              }
            >
              <XCircle className="h-4 w-4" />
              Cancel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
        <TableSkeleton rows={8} columns={9} />
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
          <div className="flex flex-wrap items-center gap-2">
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

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search by name, email, college, or registration ID..."
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
            id: "status",
            label: "Status",
            value: statusFilter,
            onChange: (v) => {
              setStatusFilter(v);
              setPage(1);
            },
            options: REGISTRATION_STATUSES.map((s) => ({
              label: s,
              value: s,
            })),
          },
          {
            id: "event",
            label: "Event",
            value: eventFilter,
            onChange: (v) => {
              setEventFilter(v);
              setPage(1);
            },
            options: eventOptions,
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
            id: "payment",
            label: "Payment",
            value: paymentFilter,
            onChange: (v) => {
              setPaymentFilter(v);
              setPage(1);
            },
            options: [
              { label: "Paid", value: "Paid" },
              { label: "Pending", value: "Pending" },
              { label: "Waived", value: "Waived" },
            ],
          },
        ]}
        onClearAll={clearFilters}
      />

      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-primary/5 px-4 py-3">
          <span className="text-sm font-medium">
            {selectedCount} selected
          </span>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setBulkAction("confirm")}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Confirm
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-destructive hover:text-destructive"
            onClick={() => setBulkAction("cancel")}
          >
            <XCircle className="h-3.5 w-3.5" />
            Cancel
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              const selected = registrations.filter((r) =>
                selectedIds.includes(r.id)
              );
              handleExport(selected);
            }}
          >
            <Download className="h-3.5 w-3.5" />
            Export Selected
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRowSelection({})}
          >
            Clear selection
          </Button>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No registrations found"
          description={
            search || statusFilter !== "all" || eventFilter !== "all"
              ? "Try adjusting your search or filters to find registrations."
              : "Student registrations will appear here once events are live."
          }
          action={
            search || statusFilter !== "all"
              ? { label: "Clear filters", onClick: clearFilters }
              : undefined
          }
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={paginated}
            enableSelection
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
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

      <ConfirmDialog
        open={bulkAction === "confirm"}
        onOpenChange={(open) => !open && setBulkAction(null)}
        title="Confirm registrations"
        description={`Mark ${selectedCount} registration(s) as confirmed? QR codes will be generated.`}
        confirmLabel="Confirm All"
        onConfirm={handleBulkConfirm}
        loading={updateMutation.isPending}
      />

      <ConfirmDialog
        open={bulkAction === "cancel"}
        onOpenChange={(open) => !open && setBulkAction(null)}
        title="Cancel registrations"
        description={`Cancel ${selectedCount} registration(s)? This action cannot be easily undone.`}
        confirmLabel="Cancel All"
        variant="destructive"
        onConfirm={handleBulkCancel}
        loading={updateMutation.isPending}
      />
    </div>
  );
}
