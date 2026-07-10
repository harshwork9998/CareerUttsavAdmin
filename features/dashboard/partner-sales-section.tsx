"use client";

import { useMemo, useState } from "react";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  CITY_GREEN,
  DASH_COLORS,
  EMERALD,
  displayClass,
  surface,
} from "@/features/dashboard/dashboard-ui";
import {
  CitySharePanel,
  PartnerJourneyFlow,
} from "@/features/dashboard/visualizations";

const CITY_COLORS = CITY_GREEN;

const LOGO_WASHES = [
  { bg: "rgba(5, 150, 105, 0.14)", fg: EMERALD[700] },
  { bg: "rgba(16, 185, 129, 0.16)", fg: EMERALD[600] },
  { bg: "rgba(52, 211, 153, 0.22)", fg: EMERALD[800] },
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

export function PartnerSalesSection({
  data,
  isAllCities,
}: {
  data: PartnerSalesAnalytics;
  cityLabel?: string;
  isAllCities?: boolean;
}) {
  const [filter, setFilter] = useState<DrillFilter | null>(null);
  const [selectedTier, setSelectedTier] = useState<SponsorshipTier | null>(
    null
  );
  const open = filter !== null;

  const confirmed = data.confirmed;
  const inDiscussion = data.inDiscussion ?? data.inProcess ?? 0;
  const notProceeding = data.notProceeding ?? data.lost ?? 0;
  const statusTotal = confirmed + inDiscussion + notProceeding || 1;

  const stages = useMemo(
    () =>
      data.byStage.map((stage) => ({
        name: normalizeStage(stage.name),
        count: stage.count,
      })),
    [data.byStage]
  );

  const cityData = useMemo(
    () =>
      data.byCity.map((item) => ({
        name: String(item.name),
        value: Number(item.value),
      })),
    [data.byCity]
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

  const statusMix = [
    {
      label: "Joining us",
      value: confirmed,
      color: DASH_COLORS.secondary,
      filter: {
        type: "status" as const,
        value: "Confirmed" as PartnerSalesStatus,
      },
    },
    {
      label: "In conversation",
      value: inDiscussion,
      color: DASH_COLORS.accent,
      filter: {
        type: "status" as const,
        value: "In Discussion" as PartnerSalesStatus,
      },
    },
    {
      label: "Not continuing",
      value: notProceeding,
      color: DASH_COLORS.danger,
      filter: {
        type: "status" as const,
        value: "Not Proceeding" as PartnerSalesStatus,
      },
    },
  ];

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/40 pb-3">
        <div>
          <h2
            className={cn(
              displayClass,
              "text-[28px] font-bold leading-none text-foreground sm:text-[34px]"
            )}
          >
            University details
          </h2>
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            {isAllCities
              ? "Bangalore · Mysore · Hubli"
              : "Universities connected to Career Utsav"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => openFilter({ type: "all" })}
          className="text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          See all
        </button>
      </div>

      {/* Hero — emerald featured + city greens */}
      <section className={surface.opening}>
        <div className="grid lg:grid-cols-10 lg:items-stretch">
          <div
            className="flex flex-col justify-between gap-8 p-7 text-white sm:p-8 lg:col-span-4 lg:p-9"
            style={{ background: DASH_COLORS.gradient }}
          >
            <div>
              <p className="text-[15px] font-medium tracking-[-0.01em] text-white/75 sm:text-[16px]">
                Confirmed Partners
              </p>
              <p className="mt-2 text-[72px] font-semibold leading-[0.92] tracking-[-0.04em] tabular-nums text-white sm:text-[88px]">
                {formatNumber(confirmed)}
              </p>
              <p className="mt-4 text-[15px] leading-relaxed tracking-[-0.01em] text-white/75">
                <span className="font-semibold tabular-nums text-white">
                  {formatNumber(data.totalPartners)}
                </span>{" "}
                total university partners
              </p>
            </div>

            <dl className="space-y-3.5">
              <button
                type="button"
                onClick={() =>
                  openFilter({ type: "status", value: "In Discussion" })
                }
                className="flex w-full items-baseline justify-between gap-4 border-b border-white/15 pb-3 text-left transition-opacity hover:opacity-80"
              >
                <dt className="shrink-0 text-[14px] tracking-[-0.01em] text-white/70">
                  In Discussion
                </dt>
                <dd className="min-w-0 text-right text-[15px] font-semibold tabular-nums tracking-[-0.02em] text-white sm:text-[16px]">
                  {formatNumber(inDiscussion)}
                </dd>
              </button>
              <button
                type="button"
                onClick={() =>
                  openFilter({ type: "status", value: "Not Proceeding" })
                }
                className="flex w-full items-baseline justify-between gap-4 text-left transition-opacity hover:opacity-80"
              >
                <dt className="shrink-0 text-[14px] tracking-[-0.01em] text-white/70">
                  Not Proceeding
                </dt>
                <dd className="min-w-0 text-right text-[15px] font-semibold tabular-nums tracking-[-0.02em] text-white sm:text-[16px]">
                  {formatNumber(notProceeding)}
                </dd>
              </button>
            </dl>
          </div>

          <div
            className={cn(
              "lg:col-span-6",
              isAllCities
                ? "min-h-[280px] overflow-hidden p-0 lg:min-h-full"
                : "min-h-[280px] bg-emerald-50/60 p-7 sm:p-8 lg:p-9"
            )}
          >
            {isAllCities ? (
              <CitySharePanel
                cities={cityData}
                colors={CITY_COLORS}
                unitLabel="partners"
              />
            ) : (
              <div className="flex h-full min-h-[240px] flex-col justify-center">
                <h3 className="text-[17px] font-bold tracking-[-0.02em] text-foreground">
                  Partner status
                </h3>
                <p className="mt-1.5 text-[14px] tracking-[-0.01em] text-muted-foreground">
                  Where conversations stand
                </p>
                <div className="mt-8 space-y-4">
                  {statusMix.map((item) => {
                    const pct = Math.round((item.value / statusTotal) * 100);
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => openFilter(item.filter)}
                        className="w-full text-left transition-opacity hover:opacity-70"
                      >
                        <div className="mb-1.5 flex items-baseline justify-between gap-3">
                          <span className="text-[13px] text-muted-foreground">
                            {item.label}
                          </span>
                          <span className="text-[15px] font-semibold tabular-nums">
                            {formatNumber(item.value)}
                            <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                              {pct}%
                            </span>
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-border/40">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: item.color,
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <motion.div
        className={cn(surface.mint, "p-6 sm:p-8")}
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
          className={cn(surface.opening, "flex flex-col bg-emerald-50/50 p-3.5 sm:p-4")}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          <h3 className="mb-2.5 text-[16px] font-bold tracking-tight text-foreground">
            Sponsorship tiers
          </h3>

          <div className="overflow-hidden rounded-lg border border-emerald-900/8 bg-white">
            <table className="w-full">
              <thead>
                <tr className="border-b border-emerald-900/8 bg-emerald-50/80">
                  <th className="px-3 py-1.5 text-left text-[12px] font-semibold text-emerald-900/55">
                    Tier
                  </th>
                  <th className="px-3 py-1.5 text-right text-[12px] font-semibold text-emerald-900/55">
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
                        "border-b border-emerald-900/6 last:border-b-0 transition-colors",
                        isActive ? "bg-emerald-50" : "hover:bg-emerald-50/50"
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
                              ? "font-semibold text-emerald-900"
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
                                ? "bg-emerald-600 text-white"
                                : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
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
              <p className="text-[12px] tabular-nums text-emerald-700/70">
                {formatNumber(tierPartners.length)}
              </p>
            )}
          </div>

          {tierPartners.length === 0 ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-emerald-900/15 bg-emerald-50/50 py-6 text-[14px] text-muted-foreground">
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
                  className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-emerald-50"
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

      <Sheet open={open} onOpenChange={(next) => !next && setFilter(null)}>
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
