"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";

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
  DASH_COLORS,
  displayClass,
} from "@/features/dashboard/dashboard-ui";
import {
  ActivityFeed,
  PartnerJourneyFlow,
  TierHierarchy,
} from "@/features/dashboard/visualizations";

const CITY_COLORS: Record<string, string> = {
  Bangalore: DASH_COLORS.primary,
  Mysore: DASH_COLORS.secondary,
  Hubli: DASH_COLORS.accent,
};

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

  const tierData = useMemo(
    () =>
      data.byTier.map((t) => ({
        name: String(t.name),
        value: Number(t.value),
      })),
    [data.byTier]
  );

  const cityData = useMemo(
    () =>
      data.byCity.map((item) => ({
        name: String(item.name),
        value: Number(item.value),
      })),
    [data.byCity]
  );
  const cityTotal = cityData.reduce((s, c) => s + c.value, 0) || 1;

  const filteredDeals = useMemo(
    () => filterDeals(data.deals, filter),
    [data.deals, filter]
  );

  const feedItems = useMemo(
    () =>
      data.recentActivity.slice(0, 4).map((item) => ({
        id: item.id,
        primary: item.title,
        secondary: `${item.tier} · ${normalizeStage(item.stage)}`,
        time: formatDistanceToNowStrict(new Date(item.timestamp), {
          addSuffix: false,
        }),
      })),
    [data.recentActivity]
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
              "text-[22px] font-medium leading-none sm:text-[26px]"
            )}
          >
            University partners
          </h2>
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            {formatNumber(confirmed)} joining · {formatNumber(data.totalPartners)}{" "}
            total
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

      <div>
        <p className="mb-5 text-[11px] text-muted-foreground">
          From first hello to the fair
        </p>
        <PartnerJourneyFlow
          stages={stages}
          onSelect={(name) =>
            openFilter({
              type: "stage",
              value: name as PartnerJourneyStage,
            })
          }
        />
      </div>

      {/* Status as one proportional bar — not three equal cards */}
      <div className="space-y-3">
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-border/40">
          {statusMix.map((item) => {
            const pct = (item.value / statusTotal) * 100;
            if (pct <= 0) return null;
            return (
              <button
                key={item.label}
                type="button"
                title={`${item.label}: ${item.value}`}
                onClick={() => openFilter(item.filter)}
                className="h-full transition-opacity hover:opacity-80"
                style={{
                  width: `${pct}%`,
                  backgroundColor: item.color,
                }}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {statusMix.map((item) => {
            const pct = Math.round((item.value / statusTotal) * 100);
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => openFilter(item.filter)}
                className="flex items-baseline gap-2 text-left transition-opacity hover:opacity-70"
              >
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[12px] text-muted-foreground">
                  {item.label}
                </span>
                <span className="text-[13px] font-semibold tabular-nums">
                  {formatNumber(item.value)}
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {pct}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={cn(
          "grid gap-10 border-t border-border/35 pt-8",
          isAllCities ? "lg:grid-cols-12 lg:gap-12" : ""
        )}
      >
        <div className={isAllCities ? "lg:col-span-7" : ""}>
          <p className="mb-4 text-[11px] text-muted-foreground">
            How they are partnering
          </p>
          <TierHierarchy
            tiers={tierData}
            onSelect={(name) =>
              openFilter({
                type: "tier",
                value: name as SponsorshipTier,
              })
            }
          />
        </div>

        {isAllCities && (
          <div className="lg:col-span-5">
            <p className="mb-4 text-[11px] text-muted-foreground">
              Partners by city
            </p>
            <div className="flex h-[148px] gap-1">
              {cityData.map((city, i) => {
                const share = city.value / cityTotal;
                return (
                  <div
                    key={city.name}
                    className="relative flex flex-col justify-between overflow-hidden p-3.5 transition-opacity duration-150 hover:opacity-90"
                    style={{
                      flexGrow: Math.max(share * 100, 14),
                      backgroundColor:
                        CITY_COLORS[city.name] ?? DASH_COLORS.primary,
                      borderRadius:
                        i === 0
                          ? "10px 3px 3px 10px"
                          : i === cityData.length - 1
                            ? "3px 10px 10px 3px"
                            : "3px",
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
                    <p className="relative text-[11px] font-medium text-white/90">
                      {city.name}
                    </p>
                    <div className="relative">
                      <p
                        className={cn(
                          displayClass,
                          "text-[22px] font-medium tabular-nums text-white"
                        )}
                      >
                        {formatNumber(city.value)}
                      </p>
                      <p className="text-[10px] text-white/65">
                        {Math.round(share * 100)}%
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {feedItems.length > 0 && (
        <div className="border-t border-border/35 pt-6">
          <p className="mb-3 text-[11px] text-muted-foreground">
            Recent partner news
          </p>
          <ActivityFeed items={feedItems} />
        </div>
      )}

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
