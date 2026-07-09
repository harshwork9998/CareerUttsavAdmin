"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Handshake, Plus } from "lucide-react";

import { partnersService } from "@/services/api";
import { PARTNER_CATEGORIES } from "@/constants";
import { formatCurrency } from "@/lib/utils";
import type { Partner } from "@/types";
import {
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const PAGE_SIZE = 8;

export function PartnersList() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["partners"],
    queryFn: () => partnersService.getAll(),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter((partner) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        partner.name.toLowerCase().includes(q) ||
        partner.contactPerson.toLowerCase().includes(q) ||
        partner.contactEmail.toLowerCase().includes(q);
      const matchesCategory =
        categoryFilter === "all" || partner.category === categoryFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && partner.isActive) ||
        (statusFilter === "inactive" && !partner.isActive);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [data, search, categoryFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: ColumnDef<Partner>[] = [
    {
      accessorKey: "name",
      header: "Company",
      cell: ({ row }) => {
        const partner = row.original;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={partner.logo} alt={partner.name} />
              <AvatarFallback>{partner.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{partner.name}</p>
              <p className="text-xs text-muted-foreground">{partner.city}</p>
            </div>
          </div>
        );
      },
    },
    {
      id: "contact",
      header: "Contact",
      cell: ({ row }) => (
        <div>
          <p className="text-sm">{row.original.contactPerson}</p>
          <p className="text-xs text-muted-foreground">{row.original.contactEmail}</p>
        </div>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.category}</span>
      ),
    },
    {
      id: "sponsorship",
      header: "Sponsorship",
      cell: ({ row }) =>
        row.original.sponsorshipAmount ? (
          <span className="font-medium">{formatCurrency(row.original.sponsorshipAmount)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusChip status={row.original.isActive ? "Active" : "Inactive"} />
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Partners" description="Manage sponsors and partner organizations." />
        <TableSkeleton rows={6} columns={5} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Partners" />
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Partners"
        description="Manage sponsors, media partners, and technology collaborators."
        actions={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Partner
          </Button>
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search partners..."
        />
      </div>

      <FiltersBar
        filters={[
          {
            id: "category",
            label: "Category",
            value: categoryFilter,
            onChange: (v) => {
              setCategoryFilter(v);
              setPage(1);
            },
            options: PARTNER_CATEGORIES.map((c) => ({ label: c, value: c })),
          },
          {
            id: "status",
            label: "Status",
            value: statusFilter,
            onChange: (v) => {
              setStatusFilter(v);
              setPage(1);
            },
            options: [
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
            ],
          },
        ]}
        onClearAll={() => {
          setCategoryFilter("all");
          setStatusFilter("all");
          setPage(1);
        }}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="No partners found"
          description="Try adjusting your search or filters."
          action={{ label: "Clear filters", onClick: () => {
            setSearch("");
            setCategoryFilter("all");
            setStatusFilter("all");
          }}}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={paginated}
            onRowClick={(row) => router.push(`/partners/${row.id}`)}
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
    </div>
  );
}
