"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  MapPin,
  MoreHorizontal,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { PARTNER_LIFECYCLE_STAGES, SPONSORSHIP_TIERS } from "@/constants";
import { partnersService } from "@/services/api";
import { cn } from "@/lib/utils";
import type { Partner, PartnerLifecycleStage } from "@/types";
import {
  BRAND,
  ELEVATION,
  INK,
  LINE,
  displayClass,
  sectionMotion,
  surface,
} from "@/features/dashboard/dashboard-ui";
import { PartnerSummaryDialog } from "@/features/partners/partner-summary-dialog";
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

function stageTone(stage: PartnerLifecycleStage): {
  bg: string;
  color: string;
} {
  switch (stage) {
    case "Confirmed":
      return { bg: "rgba(47,107,79,0.22)", color: "#247A52" };
    case "Not Proceeding":
      return { bg: "rgba(163,59,59,0.22)", color: "#C23D3D" };
    case "Negotiation":
      return { bg: "rgba(176,125,42,0.24)", color: "#C9901F" };
    case "Meeting Scheduled":
      return { bg: "rgba(31,56,100,0.2)", color: "#2A4F8C" };
    case "Contacted":
      return { bg: "rgba(31,56,100,0.18)", color: "#355A99" };
    default:
      return { bg: "rgba(31,56,100,0.16)", color: "#1F3864" };
  }
}

function PartnerCard({
  partner,
  onOpenSummary,
  onDelete,
}: {
  partner: Partner;
  onOpenSummary: (p: Partner) => void;
  onDelete: (p: Partner) => void;
}) {
  const tone = stageTone(partner.stage);

  return (
    <motion.article
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
        "flex cursor-pointer flex-col overflow-hidden p-5 outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand-700/30"
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
        <span
          className="rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide"
          style={{ background: tone.bg, color: tone.color }}
        >
          {partner.stage}
        </span>
      </div>

      <div
        className="mt-4 space-y-2 border-t pt-4 text-xs"
        style={{ borderColor: LINE.subtle, color: INK.secondary }}
      >
        {partner.relationshipOwner?.managerName ? (
          <p className="flex items-center gap-2">
            <UserRound className="h-3.5 w-3.5 shrink-0" />
            {partner.relationshipOwner.organization} ·{" "}
            {partner.relationshipOwner.managerName}
          </p>
        ) : (
          <p className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            Relationship owner pending
          </p>
        )}
        <p className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {partner.eventIds.length} event
          {partner.eventIds.length === 1 ? "" : "s"} linked
        </p>
      </div>

      <Link
        href={`/partners/${partner.id}`}
        onClick={(e) => e.stopPropagation()}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80"
        style={{ color: BRAND[700] }}
      >
        Edit partnership
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </motion.article>
  );
}

export function PartnersList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<Partner | null>(null);
  const [summaryPartner, setSummaryPartner] = useState<Partner | null>(null);
  const [stageFilter, setStageFilter] = useState("all");
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
      if (stageFilter !== "all" && p.stage !== stageFilter) return false;
      if (tierFilter !== "all" && (p.sponsorshipTier ?? "") !== tierFilter) {
        return false;
      }
      if (cityFilter.length > 0 && !cityFilter.includes(p.city)) return false;
      return true;
    });
  }, [partners, stageFilter, tierFilter, cityFilter]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Partners"
        description="Walk each university through the sponsorship partnership — one step at a time."
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
            id: "stage",
            label: "Stage",
            value: stageFilter,
            onChange: setStageFilter,
            options: PARTNER_LIFECYCLE_STAGES.map((s) => ({
              label: s,
              value: s,
            })),
          },
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
          setStageFilter("all");
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
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-[24px]" />
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
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((partner) => (
            <PartnerCard
              key={partner.id}
              partner={partner}
              onOpenSummary={setSummaryPartner}
              onDelete={setPendingDelete}
            />
          ))}
        </div>
      )}

      <PartnerSummaryDialog
        partner={summaryPartner}
        open={Boolean(summaryPartner)}
        onOpenChange={(open) => {
          if (!open) setSummaryPartner(null);
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
