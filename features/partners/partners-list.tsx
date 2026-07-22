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
import {
  getPartnerDisplayTier,
  partnerMatchesEventFilter,
  partnerMatchesTierFilter,
} from "@/lib/partner-event-config";
import { eventsService, partnersService } from "@/services/api";
import { cn } from "@/lib/utils";
import type { Partner, PartnerLifecycleStage } from "@/types";
import {
  BRAND,
  ELEVATION,
  INK,
  LINE,
  PAPER,
  TEAL,
  displayClass,
  sectionMotion,
  surface,
} from "@/features/dashboard/dashboard-ui";
import { PartnerDocsDialog } from "@/features/partners/partner-docs-dialog";
import { PartnerStageBoard } from "@/features/partners/partner-stage-board";
import { PartnerSummaryDialog } from "@/features/partners/partner-summary-dialog";
import {
  getPartnerPortalUploadProgress,
  getPartnerPortalUploadStatus,
} from "@/lib/partner-portal-docs";
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

const STAGE_ACCENT: Record<PartnerLifecycleStage, string> = {
  New: BRAND[600],
  Contacted: TEAL[700],
  "Meeting Scheduled": "#5C6B8A",
  Negotiation: "#8A6A2F",
  Confirmed: "#2F6B4F",
  "Not Proceeding": "#9A4A4A",
};

const MONOGRAM_WASH = [
  { bg: BRAND[50], fg: BRAND[700] },
  { bg: TEAL[100], fg: TEAL[700] },
  { bg: "#EDE9E0", fg: "#6B5E4A" },
  { bg: "#E8EEF6", fg: BRAND[600] },
] as const;

function partnerInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function PartnerDocUploadBar({
  uploadStatus,
}: {
  uploadStatus: ReturnType<typeof getPartnerPortalUploadStatus>;
}) {
  const { uploaded, total } = getPartnerPortalUploadProgress(uploadStatus);

  return (
    <div className="space-y-2">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground">
        Documents
      </span>
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
            key={item.key}
            title={item.label}
            className={cn(
              "h-1.5 min-w-0 flex-1 rounded-full transition-colors duration-300",
              item.complete ? "bg-[#2F6B4F]" : "bg-[#E8E6E0]"
            )}
          />
        ))}
      </div>
    </div>
  );
}

function PartnerCard({
  partner,
  index,
  onOpenSummary,
  onViewDocs,
  onDelete,
}: {
  partner: Partner;
  index: number;
  onOpenSummary: (p: Partner) => void;
  onViewDocs: (p: Partner) => void;
  onDelete: (p: Partner) => void;
}) {
  const uploadStatus = getPartnerPortalUploadStatus(partner);
  const tierLabel = getPartnerDisplayTier(partner);
  const location = partner.city || "—";
  const wash = MONOGRAM_WASH[index % MONOGRAM_WASH.length];
  const stageAccent =
    STAGE_ACCENT[partner.stage as PartnerLifecycleStage] ?? BRAND[600];

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
        "group flex h-[228px] w-[360px] shrink-0 cursor-pointer flex-col overflow-hidden outline-none transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(18,35,63,0.1)] focus-visible:ring-2 focus-visible:ring-brand-700/30"
      )}
    >
      <div
        className="h-1 shrink-0"
        style={{ backgroundColor: stageAccent }}
        aria-hidden
      />

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3.5">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              displayClass,
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold tracking-tight"
            )}
            style={{ backgroundColor: wash.bg, color: wash.fg }}
            aria-hidden
          >
            {partnerInitials(partner.name)}
          </span>

          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-start gap-1">
              <h2
                className={cn(
                  displayClass,
                  "line-clamp-2 flex-1 text-[17px] font-semibold leading-[1.25] tracking-tight"
                )}
                style={{ color: INK.primary }}
              >
                {partner.name}
              </h2>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  onClick={(e) => e.stopPropagation()}
                >
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
            <p
              className="mt-0.5 truncate text-xs"
              style={{ color: INK.muted }}
            >
              {location}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <span
            className="inline-block max-w-full truncate rounded-md px-2 py-0.5 text-[11px] font-semibold"
            style={
              tierLabel
                ? { background: "rgba(31,56,100,0.1)", color: BRAND[700] }
                : { background: PAPER.muted, color: INK.muted }
            }
          >
            {tierLabel ?? "Tier pending"}
          </span>
        </div>

        <div className="mt-auto pt-4">
          <PartnerDocUploadBar uploadStatus={uploadStatus} />
        </div>

        <div
          className="mt-3 flex items-center justify-between gap-3 border-t pt-3"
          style={{ borderColor: LINE.subtle }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewDocs(partner);
            }}
            className="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:text-brand-800"
            style={{ color: INK.secondary }}
          >
            <FileStack className="h-3.5 w-3.5" />
            View docs
          </button>
          <Link
            href={`/partners/${partner.id}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs font-semibold transition-colors hover:text-brand-800"
            style={{ color: BRAND[700] }}
          >
            Edit partnership
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
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
  const [eventFilter, setEventFilter] = useState<string[]>([]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["partners"],
    queryFn: () => partnersService.getAll(),
  });

  const eventsQuery = useQuery({
    queryKey: ["events"],
    queryFn: () => eventsService.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => partnersService.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["partners"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Partner deleted");
      setPendingDelete(null);
    },
    onError: () => toast.error("Failed to delete partner"),
  });

  const partners = useMemo(() => data ?? [], [data]);

  const cityOptions = useMemo(() => {
    const cities = [...new Set(partners.map((p) => p.city).filter(Boolean))].sort();
    return cities.map((c) => ({ label: c, value: c }));
  }, [partners]);

  const tierOptions = useMemo(() => {
    const tiers = new Set<string>(SPONSORSHIP_TIERS);
    for (const p of partners) {
      const label = getPartnerDisplayTier(p);
      if (label && !label.includes("+")) tiers.add(label);
    }
    return [...tiers].sort().map((tier) => ({ label: tier, value: tier }));
  }, [partners]);

  const eventOptions = useMemo(() => {
    return [...(eventsQuery.data ?? [])]
      .sort(
        (a, b) =>
          a.city.localeCompare(b.city) || a.title.localeCompare(b.title)
      )
      .map((event) => ({
        label: `${event.city} · ${event.title}`,
        value: event.id,
      }));
  }, [eventsQuery.data]);

  const filtered = useMemo(() => {
    return partners.filter((p) => {
      if (tierFilter !== "all" && !partnerMatchesTierFilter(p, tierFilter)) {
        return false;
      }
      if (cityFilter.length > 0 && !cityFilter.includes(p.city)) return false;
      if (!partnerMatchesEventFilter(p, eventFilter)) return false;
      return true;
    });
  }, [partners, tierFilter, cityFilter, eventFilter]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Partners"
        description="Track each partner from first contact through confirmed partnership."
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
            options: tierOptions,
          },
          {
            id: "city",
            label: "Partner city",
            mode: "multi",
            values: cityFilter,
            onChange: setCityFilter,
            options: cityOptions,
            placeholder: "All cities",
          },
          {
            id: "event",
            label: "Sponsored event",
            mode: "multi",
            values: eventFilter,
            onChange: setEventFilter,
            options: eventOptions,
            placeholder: "All events",
          },
        ]}
        onClearAll={() => {
          setTierFilter("all");
          setCityFilter([]);
          setEventFilter([]);
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
                    className="h-[228px] w-[360px] shrink-0 rounded-[24px]"
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
              Start with partner details — the rest unlocks as you go.
            </p>
          </div>
        </motion.button>
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <PartnerStageBoard
          partners={filtered}
          renderCard={(partner, index) => (
            <PartnerCard
              key={partner.id}
              partner={partner}
              index={index}
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
        onViewDocs={(p) => {
          setSummaryPartner(null);
          setDocsPartner(p);
        }}
      />

      <PartnerDocsDialog
        partner={docsPartner}
        open={Boolean(docsPartner)}
        onOpenChange={(open) => {
          if (!open) {
            setDocsPartner(null);
            void queryClient.invalidateQueries({ queryKey: ["partners"] });
            void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          }
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
