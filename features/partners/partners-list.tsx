"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowRight,
  FileStack,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { SPONSORSHIP_TIERS } from "@/constants";
import { partnersService } from "@/services/api";
import { cn } from "@/lib/utils";
import type { Partner } from "@/types";
import {
  BRAND,
  ELEVATION,
  INK,
  displayClass,
  sectionMotion,
  surface,
} from "@/features/dashboard/dashboard-ui";
import { PartnerDocsDialog } from "@/features/partners/partner-docs-dialog";
import { PartnerStageBoard } from "@/features/partners/partner-stage-board";
import { PartnerSummaryDialog } from "@/features/partners/partner-summary-dialog";
import {
  formatDaysSinceUploadChip,
  getPartnerPortalUploadProgress,
  getPartnerPortalUploadStatus,
} from "@/lib/partner-portal-docs";
import {
  getPartnerDisplayTier,
  partnerMatchesTierFilter,
} from "@/lib/partner-event-config";
import {
  ConfirmDialog,
  ErrorState,
  FiltersBar,
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

function PartnerDocUploadBar({
  uploadStatus,
}: {
  uploadStatus: ReturnType<typeof getPartnerPortalUploadStatus>;
}) {
  const { uploaded, total, ratio } = getPartnerPortalUploadProgress(uploadStatus);
  const labelColor = ratio >= 1 ? "#247A52" : "#64748B";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-medium text-muted-foreground">Documents</span>
        <span className="font-semibold tabular-nums" style={{ color: labelColor }}>
          {uploaded}/{total} uploaded
        </span>
      </div>
      <div
        className="flex gap-1"
        role="progressbar"
        aria-valuenow={uploaded}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${uploaded} of ${total} documents uploaded`}
      >
        {uploadStatus.checklist.map((item) => (
          <div
            key={item.kind}
            title={item.label}
            className="h-2.5 min-w-0 flex-1 rounded-[3px] transition-colors duration-300"
            style={
              item.uploaded
                ? { backgroundColor: "#247A52" }
                : {
                    backgroundColor: "#FFFFFF",
                    border: "1px solid rgba(31, 56, 100, 0.14)",
                  }
            }
          />
        ))}
      </div>
    </div>
  );
}

function PartnerCard({
  partner,
  onOpenSummary,
  onViewDocs,
  onDelete,
}: {
  partner: Partner;
  onOpenSummary: (p: Partner) => void;
  onViewDocs: (p: Partner) => void;
  onDelete: (p: Partner) => void;
}) {
  const uploadStatus = getPartnerPortalUploadStatus(partner);
  const reminderChip = formatDaysSinceUploadChip(uploadStatus);

  return (
    <motion.article
      layout
      layoutId={`partner-${partner.id}`}
      {...sectionMotion}
      role="button"
      tabIndex={0}
      onClick={() => onOpenSummary(partner)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenSummary(partner);
        }
      }}
      className={cn(
        surface.opening,
        "flex w-[min(100%,340px)] shrink-0 cursor-pointer flex-col overflow-hidden p-5 outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand-700/30 sm:w-[360px]"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h2
            className={cn(displayClass, "text-xl font-semibold leading-snug")}
            style={{ color: INK.primary }}
          >
            {partner.name}
          </h2>
          <p className="text-sm" style={{ color: INK.secondary }}>
            {partner.city}
            {partner.state ? ` · ${partner.state}` : ""}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem asChild>
              <Link href={`/partners/${partner.id}`}>
                <ArrowRight className="h-4 w-4" />
                Edit partnership
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewDocs(partner)}>
              <FileStack className="h-4 w-4" />
              View docs
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete(partner)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {getPartnerDisplayTier(partner) ? (
          <span
            className="rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide"
            style={{
              background: "rgba(31,56,100,0.16)",
              color: "#1F3864",
            }}
          >
            {getPartnerDisplayTier(partner)}
          </span>
        ) : null}
        {reminderChip ? (
          <span
            className="rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide"
            style={{
              background: "rgba(176,125,42,0.18)",
              color: "#B07D2A",
            }}
          >
            {reminderChip}
          </span>
        ) : null}
      </div>

      <div className="mt-4">
        <PartnerDocUploadBar uploadStatus={uploadStatus} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onViewDocs(partner);
          }}
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ color: BRAND[700] }}
        >
          <FileStack className="h-3.5 w-3.5" />
          View docs
        </button>
        <Link
          href={`/partners/${partner.id}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ color: BRAND[700] }}
        >
          Edit partnership
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </motion.article>
  );
}

export function PartnersList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<Partner | null>(null);
  const [summaryPartner, setSummaryPartner] = useState<Partner | null>(null);
  const [docsPartner, setDocsPartner] = useState<Partner | null>(null);
  const [tierFilter, setTierFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState<string[]>([]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["partners"],
    queryFn: () => partnersService.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => partnersService.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["partners"] });
      toast.success("Partner deleted");
      setPendingDelete(null);
    },
    onError: () => toast.error("Failed to delete partner"),
  });

  const partners = useMemo(() => data ?? [], [data]);

  const cityOptions = useMemo(() => {
    const cities = [...new Set(partners.map((p) => p.city))].sort();
    return cities.map((c) => ({ label: c, value: c }));
  }, [partners]);

  const filtered = useMemo(() => {
    return partners.filter((p) => {
      if (tierFilter !== "all" && !partnerMatchesTierFilter(p, tierFilter)) {
        return false;
      }
      if (cityFilter.length > 0 && !cityFilter.includes(p.city)) return false;
      return true;
    });
  }, [partners, tierFilter, cityFilter]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Partners"
        description="Universities grouped by partnership stage — cards move when you advance the journey."
        actions={
          <Button
            onClick={() => router.push("/partners/new")}
            className="h-10 rounded-full px-5 text-white hover:opacity-90"
            style={{ backgroundColor: BRAND[700] }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New partner
          </Button>
        }
      />

      <FiltersBar
        filters={[
          {
            id: "tier",
            label: "Sponsorship tier",
            value: tierFilter,
            onChange: setTierFilter,
            options: SPONSORSHIP_TIERS.map((tier) => ({
              label: tier,
              value: tier,
            })),
          },
          {
            id: "city",
            label: "Event city",
            mode: "multi",
            values: cityFilter,
            onChange: setCityFilter,
            options: cityOptions,
            placeholder: "All cities",
          },
        ]}
        onClearAll={() => {
          setTierFilter("all");
          setCityFilter([]);
        }}
      />

      {isError && (
        <ErrorState
          title="Couldn’t load partners"
          message="Something went wrong while fetching partners."
          onRetry={() => void refetch()}
        />
      )}

      {isLoading && (
        <div className="space-y-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2.5">
              <Skeleton className="h-10 w-full rounded-lg" />
              <div className="flex gap-3 overflow-x-auto pb-1">
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton
                    key={j}
                    className="h-56 w-[360px] shrink-0 rounded-[24px]"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <motion.button
          type="button"
          onClick={() => router.push("/partners/new")}
          {...sectionMotion}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className={cn(
            surface.mint,
            "flex min-h-[40vh] w-full flex-col items-center justify-center gap-4 border-dashed outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
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
              Add a partner
            </p>
            <p className="text-sm" style={{ color: INK.muted }}>
              Start with university details — the rest unlocks as you go.
            </p>
          </div>
        </motion.button>
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <PartnerStageBoard
          partners={filtered}
          renderCard={(partner) => (
            <PartnerCard
              key={partner.id}
              partner={partner}
              onOpenSummary={setSummaryPartner}
              onViewDocs={setDocsPartner}
              onDelete={setPendingDelete}
            />
          )}
        />
      )}

      <PartnerSummaryDialog
        partner={summaryPartner}
        open={Boolean(summaryPartner)}
        onOpenChange={(open) => {
          if (!open) setSummaryPartner(null);
        }}
      />

      <PartnerDocsDialog
        partner={docsPartner}
        open={Boolean(docsPartner)}
        onOpenChange={(open) => {
          if (!open) setDocsPartner(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete partner"
        description={`Remove ${pendingDelete?.name ?? "this partner"}?`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
        }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
