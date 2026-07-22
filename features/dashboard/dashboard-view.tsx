"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";

import { dashboardService } from "@/services/api";
import { cn, formatNumber } from "@/lib/utils";
import type {
  DashboardCityFilter,
  PartnerSalesAnalytics,
  StudentRegistrationAnalytics,
} from "@/types";
import { ErrorState, PageHeader } from "@/components/shared";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentRegistrationSection } from "@/features/dashboard/student-registration-section";
import { PartnerSalesSection } from "@/features/dashboard/partner-sales-section";
import { resolveDashboardView } from "@/features/dashboard/resolve-dashboard-view";
import {
  displayClass,
  sectionMotion,
  surface,
  DASH_COLORS,
} from "@/features/dashboard/dashboard-ui";

const HERO_TABS: Array<{
  value: DashboardCityFilter;
  label: string;
}> = [
  { value: "all", label: "Consolidated" },
  { value: "Bangalore", label: "Bangalore" },
  { value: "Mysore", label: "Mysore" },
  { value: "Hubli", label: "Hubli" },
];

function buildSupportFacts(
  students: StudentRegistrationAnalytics
): Array<{ label: string; value: string }> {
  const facts: Array<{ label: string; value: string }> = [];
  const topSeminar = students.bySeminar[0];
  const topStream = students.byStream[0];
  const topBoard = students.byBoard[0];
  const topClass = [...students.byClass].sort(
    (a, b) => Number(b.value) - Number(a.value)
  )[0];

  if (topSeminar) {
    facts.push({
      label: "Most chosen seminar",
      value: String(topSeminar.name),
    });
  }
  if (topStream) {
    facts.push({
      label: "Popular stream",
      value: String(topStream.name),
    });
  }
  if (topClass) {
    facts.push({
      label: "Top class",
      value: String(topClass.name),
    });
  }
  if (topBoard) {
    facts.push({
      label: "Top board",
      value: String(topBoard.name),
    });
  }
  return facts;
}

function buildPartnerSupportFacts(
  partners: PartnerSalesAnalytics
): Array<{ label: string; value: string }> {
  const inDiscussion = partners.inDiscussion ?? partners.inProcess ?? 0;
  const notProceeding = partners.notProceeding ?? partners.lost ?? 0;
  const topTier = [...(partners.byTier ?? [])].sort(
    (a, b) => Number(b.value) - Number(a.value)
  )[0];
  const topStage = [...(partners.byStage ?? [])]
    .filter((s) => !["Confirmed", "Not Proceeding", "Lost", "Won"].includes(s.name))
    .sort((a, b) => b.count - a.count)[0];

  const facts: Array<{ label: string; value: string }> = [
    {
      label: "In discussion",
      value: formatNumber(inDiscussion),
    },
    {
      label: "Not proceeding",
      value: formatNumber(notProceeding),
    },
  ];

  if (topTier) {
    facts.push({
      label: "Top sponsorship tier",
      value: String(topTier.name),
    });
  } else if (topStage) {
    facts.push({
      label: "Busiest stage",
      value: String(topStage.name),
    });
  }

  facts.push({
    label: "Total partners",
    value: formatNumber(partners.totalPartners),
  });

  return facts.slice(0, 4);
}

function CityHeroCards({
  cards,
  activeValue,
  onSelect,
}: {
  cards: Array<{
    value: DashboardCityFilter;
    label: string;
    metricLabel: string;
    total: number;
    facts: Array<{ label: string; value: string }>;
  }>;
  activeValue: DashboardCityFilter;
  onSelect: (value: DashboardCityFilter) => void;
}) {
  return (
    <div className="mb-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card, index) => {
        const active = activeValue === card.value;
        return (
          <motion.button
            key={card.value}
            type="button"
            onClick={() => onSelect(card.value)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.35,
              delay: index * 0.05,
              ease: [0.22, 1, 0.36, 1],
            }}
            whileHover={{
              y: -6,
              scale: 1.02,
              transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
            }}
            whileTap={{ scale: 0.985, y: -2 }}
            className={cn(
              surface.opening,
              "flex flex-col justify-between gap-6 p-5 text-left will-change-transform sm:p-6",
              active
                ? "border-brand-700/30 text-white shadow-[0_12px_36px_rgba(18,35,63,0.28)] ring-2 ring-brand-700/40"
                : "bg-white hover:border-brand-700/25 hover:shadow-[0_16px_40px_rgba(18,35,63,0.14)]"
            )}
            style={active ? { background: DASH_COLORS.gradient } : undefined}
            aria-pressed={active}
          >
            <div>
              <p
                className={cn(
                  "text-[13px] font-semibold tracking-tight sm:text-[14px]",
                  active ? "text-white/80" : "text-brand-800/70"
                )}
              >
                {card.label}
              </p>
              <p
                className={cn(
                  "mt-3 text-[12px] font-medium",
                  active ? "text-white/70" : "text-muted-foreground"
                )}
              >
                {card.metricLabel}
              </p>
              <p
                className={cn(
                  "mt-1 text-[44px] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[52px]",
                  active ? "text-white" : "text-brand-950"
                )}
              >
                {formatNumber(card.total)}
              </p>
            </div>

            <dl className="space-y-2.5">
              {card.facts.map((fact) => (
                <div
                  key={fact.label}
                  className={cn(
                    "flex items-baseline justify-between gap-3 border-b pb-2 last:border-b-0 last:pb-0",
                    active ? "border-white/15" : "border-brand-900/10"
                  )}
                >
                  <dt
                    className={cn(
                      "shrink-0 text-[12px]",
                      active ? "text-white/65" : "text-muted-foreground"
                    )}
                  >
                    {fact.label}
                  </dt>
                  <dd
                    className={cn(
                      "min-w-0 truncate text-right text-[13px] font-semibold tracking-tight",
                      active ? "text-white" : "text-foreground"
                    )}
                  >
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          </motion.button>
        );
      })}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Track student registrations and university partners across Career Utsav cities."
      />
      <Skeleton className="h-72 rounded-2xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

export function DashboardView() {
  const [studentCityFilter, setStudentCityFilter] =
    useState<DashboardCityFilter>("all");
  const [partnerCityFilter, setPartnerCityFilter] =
    useState<DashboardCityFilter>("all");
  const [partnerSeeAllTick, setPartnerSeeAllTick] = useState(0);

  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dashboardService.getData(),
  });

  const dashboard = dashboardQuery.data;
  const studentView = useMemo(
    () =>
      dashboard ? resolveDashboardView(dashboard, studentCityFilter) : null,
    [dashboard, studentCityFilter]
  );
  const partnerView = useMemo(
    () =>
      dashboard ? resolveDashboardView(dashboard, partnerCityFilter) : null,
    [dashboard, partnerCityFilter]
  );

  const studentHeroCards = useMemo(() => {
    if (!dashboard) return [];
    return HERO_TABS.map((tab) => {
      const slice = resolveDashboardView(dashboard, tab.value);
      return {
        ...tab,
        metricLabel:
          tab.value === "all" ? "Students registered" : "Students joining",
        total: slice.studentRegistration.total,
        facts: buildSupportFacts(slice.studentRegistration),
      };
    });
  }, [dashboard]);

  const partnerHeroCards = useMemo(() => {
    if (!dashboard) return [];
    return HERO_TABS.map((tab) => {
      const slice = resolveDashboardView(dashboard, tab.value);
      return {
        ...tab,
        metricLabel:
          tab.value === "all" ? "Confirmed partners" : "Partners confirmed",
        total: slice.partnerSales.confirmed,
        facts: buildPartnerSupportFacts(slice.partnerSales),
      };
    });
  }, [dashboard]);

  if (dashboardQuery.isLoading) return <DashboardSkeleton />;

  if (dashboardQuery.isError || !dashboard || !studentView || !partnerView) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" />
        <ErrorState
          title="Couldn't load Career Utsav"
          message="Please check your connection and try again."
          onRetry={() => void dashboardQuery.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="pb-10">
      <PageHeader
        className="mb-8 sm:mb-10"
        title="Dashboard"
        description="Track student registrations and university partner performance across Career Utsav cities."
      />

      <header className="mb-6 sm:mb-7">
        <h2
          className={cn(
            displayClass,
            "text-[28px] font-bold leading-none text-foreground sm:text-[34px]"
          )}
        >
          Student details
        </h2>
        <p className="mt-2 text-[13px] text-muted-foreground">
          {studentView.isAllCities
            ? "Bangalore · Mysore · Hubli"
            : studentView.cityLabel}
        </p>
      </header>

      <CityHeroCards
        cards={studentHeroCards}
        activeValue={studentCityFilter}
        onSelect={setStudentCityFilter}
      />

      <AnimatePresence mode="wait">
        <motion.div key={`students-${studentCityFilter}`} {...sectionMotion}>
          <StudentRegistrationSection
            data={studentView.studentRegistration}
            cityLabel={studentView.cityLabel}
            isAllCities={studentView.isAllCities}
          />
        </motion.div>
      </AnimatePresence>

      <header className="mb-4 mt-14 flex flex-wrap items-end justify-between gap-3 sm:mb-5 sm:mt-16">
        <div>
          <h2
            className={cn(
              displayClass,
              "text-[28px] font-bold leading-none text-foreground sm:text-[34px]"
            )}
          >
            Partner details
          </h2>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {partnerView.isAllCities
              ? "Bangalore · Mysore · Hubli"
              : partnerView.cityLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPartnerSeeAllTick((t) => t + 1)}
          className="inline-flex h-9 items-center rounded-lg border border-[rgba(212,209,200,0.85)] bg-white px-3.5 text-[13px] font-semibold text-brand-800 shadow-card transition-colors hover:border-brand-700/25 hover:bg-brand-50"
        >
          See all universities
        </button>
      </header>

      <CityHeroCards
        cards={partnerHeroCards}
        activeValue={partnerCityFilter}
        onSelect={setPartnerCityFilter}
      />

      <AnimatePresence mode="wait">
        <motion.div key={`partners-${partnerCityFilter}`} {...sectionMotion}>
          <PartnerSalesSection
            data={partnerView.partnerSales}
            cityLabel={partnerView.cityLabel}
            isAllCities={partnerView.isAllCities}
            seeAllTick={partnerSeeAllTick}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
