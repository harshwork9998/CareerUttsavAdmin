"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

import { cn, formatNumber } from "@/lib/utils";
import type {
  PartnerJourneyStage,
  PartnerSalesAnalytics,
  PartnerSalesDeal,
  PartnerSalesStatus,
  SponsorshipTier,
} from "@/types";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BRAND, surface } from "@/features/dashboard/dashboard-ui";
import { PartnerJourneyFlow } from "@/features/dashboard/visualizations";

const LOGO_WASHES = [
  { bg: "rgba(31, 56, 100, 0.12)", fg: BRAND[700] },
  { bg: "rgba(14, 124, 123, 0.14)", fg: "#0B5F5E" },
  { bg: "rgba(196, 163, 90, 0.18)", fg: "#8A6A2F" },
] as const;

const TIER_ORDER: SponsorshipTier[] = [
  "Presenting Partner",
  "Co-Presenting Partner",
  "University Partner",
  "Knowledge Partner (Gold)",
  "Knowledge Partner (Silver)",
  "Education Partner",
  "Stall Partner",
];

function tierRank(tier: string): number {
  const index = TIER_ORDER.indexOf(tier as SponsorshipTier);
  return index === -1 ? TIER_ORDER.length : index;
}

type DrillFilter =
  | { type: "all" }
  | { type: "status"; value: PartnerSalesStatus }
  | { type: "stage"; value: PartnerJourneyStage }
  | { type: "tier"; value: SponsorshipTier };

function normalizeStatus(status: string): PartnerSalesStatus {
  if (status === "In Process") return "In Discussion";
  if (status === "Lost") return "Not Proceeding";
  if (
    status === "Confirmed" ||
    status === "In Discussion" ||
    status === "Not Proceeding"
  ) {
    return status;
  }
  return "In Discussion";
}

function normalizeStage(stage: string): PartnerJourneyStage {
  if (stage === "Negotiation") return "Discussion";
  if (stage === "Won") return "Confirmed";
  if (stage === "Lost") return "Not Proceeding";
  return stage as PartnerJourneyStage;
}

function filterDeals(
  deals: PartnerSalesDeal[],
  filter: DrillFilter | null
): PartnerSalesDeal[] {
  if (!filter || filter.type === "all") return deals;
  switch (filter.type) {
    case "status":
      return deals.filter((d) => normalizeStatus(d.status) === filter.value);
    case "stage":
      return deals.filter((d) => normalizeStage(d.stage) === filter.value);
    case "tier":
      return deals.filter((d) => d.tier === filter.value);
    default:
      return deals;
  }
}

function filterTitle(filter: DrillFilter | null): string {
  if (!filter || filter.type === "all") return "University partners";
  return String(filter.value);
}

function filterDescription(filter: DrillFilter | null): string {
  if (!filter || filter.type === "all") {
    return "Universities connected to Career Utsav in this view";
  }
  if (filter.type === "stage") {
    return `Universities currently at “${filter.value}”`;
  }
  if (filter.type === "status") {
    if (filter.value === "Confirmed") return "Universities joining the fair";
    if (filter.value === "In Discussion") return "Universities in conversation";
    return "Universities not continuing";
  }
  return `Universities as ${filter.value}`;
}

function statusBadge(
  status: PartnerSalesStatus
): "success" | "warning" | "destructive" | "muted" {
  if (status === "Confirmed") return "success";
  if (status === "In Discussion") return "warning";
  return "destructive";
}

function partnerInitials(name: string): string {
  const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second =
    parts.find((p, i) => i > 0 && !/^(of|and|the|university|college|institute)$/i.test(p))?.[0] ??
    parts[1]?.[0] ??
    "";
  return (first + second).toUpperCase() || "U";
}

function PartnerLogo({ name, index = 0 }: { name: string; index?: number }) {
  const wash = LOGO_WASHES[index % LOGO_WASHES.length];
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tracking-tight"
      style={{ backgroundColor: wash.bg, color: wash.fg }}
      aria-hidden
    >
      {partnerInitials(name)}
    </span>
  );
}

function PartnerList({ deals }: { deals: PartnerSalesDeal[] }) {
  if (deals.length === 0) {
    return (
      <div className="flex h-28 items-center justify-center border border-dashed text-[13px] text-muted-foreground">
        No universities in this view
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted-foreground">
        <span className="text-[14px] font-semibold tabular-nums text-foreground">
          {formatNumber(deals.length)}
        </span>{" "}
        universities
      </p>
      <ScrollArea className="h-[calc(100vh-200px)] pr-3">
        <div className="space-y-2 pb-6">
          {deals.map((deal) => {
            const status = normalizeStatus(deal.status);
            const stage = normalizeStage(deal.stage);
            return (
              <div
                key={deal.id}
                className="border border-border/50 p-3"
              >
                <p className="text-[13px] font-semibold leading-snug">
                  {deal.universityName}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {deal.city}
                  {deal.owner ? ` · ${deal.owner}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px]">
                    {deal.tier}
                  </Badge>
                  <Badge variant="muted" className="text-[10px]">
                    {stage}
                  </Badge>
                  <Badge variant={statusBadge(status)} className="text-[10px]">
                    {status}
                  </Badge>
                </div>
                {deal.notes && (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                    {deal.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function AllUniversitiesDialog({
  open,
  onOpenChange,
  deals,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deals: PartnerSalesDeal[];
}) {
  const rows = useMemo(
    () =>
      [...deals].sort((a, b) => {
        const tierDiff = tierRank(a.tier) - tierRank(b.tier);
        if (tierDiff !== 0) return tierDiff;
        const statusOrder = (s: PartnerSalesStatus) =>
          s === "Confirmed" ? 0 : s === "In Discussion" ? 1 : 2;
        const statusDiff =
          statusOrder(normalizeStatus(a.status)) -
          statusOrder(normalizeStatus(b.status));
        if (statusDiff !== 0) return statusDiff;
        return a.universityName.localeCompare(b.universityName);
      }),
    [deals]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[calc(100%-1.5rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogHeader className="border-b border-[rgba(212,209,200,0.85)] px-5 py-4 pr-12 sm:px-6">
          <DialogTitle className="text-[18px] font-bold tracking-tight text-foreground">
            All universities
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            <span className="font-semibold tabular-nums text-foreground">
              {formatNumber(rows.length)}
            </span>{" "}
            partners in this view · name, city, tier, stage, and status
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4 sm:px-6">
          {rows.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-[rgba(212,209,200,0.85)] text-[13px] text-muted-foreground">
              No universities in this view
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[rgba(212,209,200,0.85)]">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="sticky top-0 z-[1] bg-[#F1F0EC]">
                  <tr className="border-b border-[rgba(212,209,200,0.85)]">
                    <th className="px-3 py-2.5 text-[11px] font-semibold text-brand-900/55">
                      University
                    </th>
                    <th className="px-3 py-2.5 text-[11px] font-semibold text-brand-900/55">
                      City
                    </th>
                    <th className="px-3 py-2.5 text-[11px] font-semibold text-brand-900/55">
                      Tier
                    </th>
                    <th className="px-3 py-2.5 text-[11px] font-semibold text-brand-900/55">
                      Stage
                    </th>
                    <th className="px-3 py-2.5 text-[11px] font-semibold text-brand-900/55">
                      Status
                    </th>
                    <th className="px-3 py-2.5 text-[11px] font-semibold text-brand-900/55">
                      Owner
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((deal) => {
                    const status = normalizeStatus(deal.status);
                    const stage = normalizeStage(deal.stage);
                    return (
                      <tr
                        key={deal.id}
                        className="border-b border-[rgba(212,209,200,0.55)] last:border-b-0 hover:bg-brand-50/50"
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-start gap-2.5">
                            <PartnerLogo name={deal.universityName} />
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold tracking-tight text-foreground">
                                {deal.universityName}
                              </p>
                              {deal.notes ? (
                                <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                                  {deal.notes}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-[13px] text-muted-foreground">
                          {deal.city}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant="outline" className="text-[10px]">
                            {deal.tier}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-muted-foreground">
                          {stage}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge
                            variant={statusBadge(status)}
                            className="text-[10px]"
                          >
                            {status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-muted-foreground">
                          {deal.owner || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PartnerSalesSection({
  data,
  isAllCities,
  seeAllTick = 0,
}: {
  data: PartnerSalesAnalytics;
  cityLabel?: string;
  isAllCities?: boolean;
  /** Increment to open the all-universities popup from the parent. */
  seeAllTick?: number;
}) {
  const [filter, setFilter] = useState<DrillFilter | null>(null);
  const [allOpen, setAllOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SponsorshipTier | null>(
    null
  );
  const sheetOpen = filter !== null && filter.type !== "all";
  const lastSeeAllTick = useRef(seeAllTick);

  useEffect(() => {
    // Only open when the parent explicitly increments the tick —
    // not when this section remounts after a city change.
    if (seeAllTick > lastSeeAllTick.current) {
      setAllOpen(true);
    }
    lastSeeAllTick.current = seeAllTick;
  }, [seeAllTick]);

  const stages = useMemo(
    () =>
      data.byStage.map((stage) => ({
        name: normalizeStage(stage.name),
        count: stage.count,
      })),
    [data.byStage]
  );

  const confirmedPartners = useMemo(
    () =>
      data.deals
        .filter((deal) => normalizeStatus(deal.status) === "Confirmed")
        .sort((a, b) => {
          const tierDiff = tierRank(a.tier) - tierRank(b.tier);
          if (tierDiff !== 0) return tierDiff;
          return a.universityName.localeCompare(b.universityName);
        }),
    [data.deals]
  );

  const confirmedTiers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const deal of confirmedPartners) {
      counts.set(deal.tier, (counts.get(deal.tier) ?? 0) + 1);
    }
    return TIER_ORDER.map((tier) => ({
      tier,
      count: counts.get(tier) ?? 0,
    }));
  }, [confirmedPartners]);

  const activeTier =
    selectedTier ??
    confirmedTiers.find((row) => row.count > 0)?.tier ??
    null;

  const tierPartners = useMemo(
    () =>
      activeTier
        ? confirmedPartners.filter((deal) => deal.tier === activeTier)
        : [],
    [confirmedPartners, activeTier]
  );

  const filteredDeals = useMemo(
    () => filterDeals(data.deals, filter),
    [data.deals, filter]
  );

  const openFilter = (next: DrillFilter) => setFilter(next);

  return (
    <section className="space-y-8">
      <motion.div
        className={cn(surface.mint, "p-4 sm:p-5")}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
      >
        <PartnerJourneyFlow
          stages={stages}
          onSelect={(name) =>
            openFilter({
              type: "stage",
              value: name as PartnerJourneyStage,
            })
          }
        />
      </motion.div>

      <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
        <motion.div
          className={cn(surface.opening, "flex flex-col bg-brand-50/50 p-3.5 sm:p-4")}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          <h3 className="mb-2.5 text-[16px] font-bold tracking-tight text-foreground">
            Sponsorship tiers
          </h3>

          <div className="overflow-hidden rounded-lg border border-brand-900/8 bg-white">
            <table className="w-full">
              <thead>
                <tr className="border-b border-brand-900/8 bg-brand-50/80">
                  <th className="px-3 py-1.5 text-left text-[12px] font-semibold text-brand-900/55">
                    Tier
                  </th>
                  <th className="px-3 py-1.5 text-right text-[12px] font-semibold text-brand-900/55">
                    Partners
                  </th>
                </tr>
              </thead>
              <tbody>
                {confirmedTiers.map((row) => {
                  const isActive = activeTier === row.tier;
                  return (
                    <tr
                      key={row.tier}
                      className={cn(
                        "border-b border-brand-900/6 last:border-b-0 transition-colors",
                        isActive ? "bg-brand-50" : "hover:bg-brand-50/50"
                      )}
                    >
                      <td className="px-3 py-1.5">
                        <button
                          type="button"
                          disabled={row.count === 0}
                          onClick={() => setSelectedTier(row.tier)}
                          className={cn(
                            "text-left text-[15px] tracking-tight disabled:cursor-default",
                            isActive
                              ? "font-semibold text-brand-900"
                              : "font-medium text-foreground/90",
                            row.count === 0 && "text-muted-foreground/60"
                          )}
                        >
                          {row.tier}
                        </button>
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <button
                          type="button"
                          disabled={row.count === 0}
                          onClick={() => setSelectedTier(row.tier)}
                          className={cn(
                            "inline-flex min-w-[1.75rem] items-center justify-center rounded-md px-1.5 py-0.5 text-[15px] font-semibold tabular-nums transition-colors",
                            row.count === 0
                              ? "cursor-default text-muted-foreground/50"
                              : isActive
                                ? "bg-brand-700 text-white"
                                : "bg-brand-100 text-brand-800 hover:bg-brand-100"
                          )}
                          aria-label={`Show ${row.count} ${row.tier} partners`}
                        >
                          {formatNumber(row.count)}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>

        <motion.div
          className={cn(surface.opening, "flex flex-col p-3.5 sm:p-4")}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mb-2.5 flex items-baseline justify-between gap-2">
            <h3 className="text-[16px] font-bold tracking-tight text-foreground">
              {activeTier ?? "Partners"}
            </h3>
            {activeTier && (
              <p className="text-[12px] tabular-nums text-brand-700/70">
                {formatNumber(tierPartners.length)}
              </p>
            )}
          </div>

          {tierPartners.length === 0 ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-brand-900/15 bg-brand-50/50 py-6 text-[14px] text-muted-foreground">
              No confirmed partners in this tier
            </div>
          ) : (
            <ul className="grid content-start gap-1">
              {tierPartners.map((deal, index) => (
                <motion.li
                  key={deal.id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.25,
                    delay: index * 0.03,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-brand-50"
                >
                  <PartnerLogo name={deal.universityName} index={index} />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold tracking-tight text-foreground">
                      {deal.universityName}
                    </p>
                    {isAllCities && (
                      <p className="text-[12px] text-muted-foreground">
                        {deal.city}
                      </p>
                    )}
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </motion.div>
      </div>

      <AllUniversitiesDialog
        open={allOpen}
        onOpenChange={setAllOpen}
        deals={data.deals}
      />

      <Sheet
        open={sheetOpen}
        onOpenChange={(next) => !next && setFilter(null)}
      >
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader className="pr-8">
            <SheetTitle>{filterTitle(filter)}</SheetTitle>
            <SheetDescription>{filterDescription(filter)}</SheetDescription>
          </SheetHeader>
          <div className="mt-5 flex-1 overflow-hidden">
            <PartnerList deals={filteredDeals} />
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
