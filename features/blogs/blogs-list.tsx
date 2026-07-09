"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Edit, Eye, FileText, Plus } from "lucide-react";

import { blogsService } from "@/services/api";
import { formatDate, formatNumber } from "@/lib/utils";
import type { Blog, BlogStatus } from "@/types";
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

const PAGE_SIZE = 8;
const STATUSES: BlogStatus[] = ["Draft", "Published", "Archived"];

export function BlogsList() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["blogs"],
    queryFn: () => blogsService.getAll(),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase();
    return data.filter((blog) => {
      const matchesSearch =
        !q ||
        blog.title.toLowerCase().includes(q) ||
        blog.author.toLowerCase().includes(q) ||
        blog.tags.some((t) => t.toLowerCase().includes(q));
      const matchesStatus = statusFilter === "all" || blog.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [data, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: ColumnDef<Blog>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.title}</p>
          <p className="text-xs text-muted-foreground">by {row.original.author}</p>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusChip status={row.original.status} />,
    },
    {
      accessorKey: "viewCount",
      header: "Views",
      cell: ({ row }) => formatNumber(row.original.viewCount),
    },
    {
      id: "date",
      header: "Updated",
      cell: ({ row }) => formatDate(row.original.updatedAt),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/blogs/${row.original.id}/edit?preview=1`);
            }}
            aria-label="Preview"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/blogs/${row.original.id}/edit`);
            }}
            aria-label="Edit"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Blogs" description="Content management for Career Utsav blog." />
        <TableSkeleton rows={6} columns={5} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Blogs" />
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blogs"
        description="Create, edit, and publish blog posts with SEO optimization."
        actions={
          <Button asChild className="gap-2">
            <Link href="/blogs/new">
              <Plus className="h-4 w-4" />
              New Post
            </Link>
          </Button>
        }
      />

      <SearchBar
        value={search}
        onChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        placeholder="Search posts..."
      />

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
            options: STATUSES.map((s) => ({ label: s, value: s })),
          },
        ]}
        onClearAll={() => {
          setStatusFilter("all");
          setPage(1);
        }}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No blog posts found"
          description="Create your first post or adjust filters."
          action={{ label: "New Post", onClick: () => router.push("/blogs/new") }}
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
