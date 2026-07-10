"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";

import { dashboardService } from "@/services/api";
import { cn, formatNumber } from "@/lib/utils";
import type { DashboardCityFilter } from "@/types";
import { ErrorState } from "@/components/shared";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentRegistrationSection } from "@/features/dashboard/student-registration-section";
import { PartnerSalesSection } from "@/features/dashboard/partner-sales-section";
import { DashboardCitySelector } from "@/features/dashboard/dashboard-city-selector";
import { CityComparisonInline } from "@/features/dashboard/city-comparison-strip";
import { resolveDashboardView } from "@/features/dashboard/resolve-dashboard-view";
import {
  displayClass,
  sectionMotion,
  surface,
} from "@/features/dashboard/dashboard-ui";
import {
  CitySharePanel,
  ClassRidge,
} from "@/features/dashboard/visualizations";

const CITY_COLORS: Record<string, string> = {
  Bangalore: "#1F3864",
  Mysore: "#3D5478",
  Hubli: "#6B7C93",
};

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-72 rounded-2xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

export function DashboardView() {
  const [cityFilter, setCityFilter] = useState<DashboardCityFilter>("all");

  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dashboardService.getData(),
  });

  const dashboard = dashboardQuery.data;
  const view = useMemo(
    () => (dashboard ? resolveDashboardView(dashboard, cityFilter) : null),
    [dashboard, cityFilter]
  );

  if (dashboardQuery.isLoading) return <DashboardSkeleton />;

  if (dashboardQuery.isError || !dashboard || !view) {
    return (
      <ErrorState
        title="Couldn't load Career Utsav"
        message="Please check your connection and try again."
        onRetry={() => void dashboardQuery.refetch()}
      />
    );
  }

  const students = view.studentRegistration.total;
  const today = view.studentRegistration.todayCount;

  const coreClasses = view.studentRegistration.byClass
    .filter((c) => c.segment === "core")
    .reduce((sum, c) => sum + Number(c.value), 0);
  const coreShare =
    students > 0 ? Math.round((coreClasses / students) * 100) : 0;

  const cityData = view.studentRegistration.byCity.map((c) => ({
    name: String(c.name),
    value: Number(c.value),
  }));

  const classInOrder = view.studentRegistration.byClass.map((c) => ({
    name: String(c.name),
    value: Number(c.value),
    segment: c.segment,
  }));

  const topStream = view.studentRegistration.byStream[0];
  const topSeminar = view.studentRegistration.bySeminar[0];
  const topSchool = view.studentRegistration.topSchools[0];
  const topCity = [...cityData].sort((a, b) => b.value - a.value)[0];

  const supportFacts: Array<{ label: string; value: string }> = [];
  if (view.isAllCities && topCity) {
    supportFacts.push({
      label: "Most active city",
      value: `${topCity.name} · ${formatNumber(topCity.value)}`,
    });
  }
  if (topSeminar) {
    supportFacts.push({
      label: "Most chosen seminar",
      value: String(topSeminar.name),
    });
  }
  if (topStream) {
    supportFacts.push({
      label: "Popular stream",
      value: String(topStream.name),
    });
  }
  if (topSchool) {
    supportFacts.push({
      label: "Top school",
      value: topSchool.city
        ? `${topSchool.name} · ${topSchool.city}`
        : topSchool.name,
    });
  }

  return (
    <div className="pb-10">
      {/* Masthead — brand first, not a page title stack */}
      <header className="mb-7 flex flex-col gap-4 sm:mb-9 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1
            className={cn(
              displayClass,
              "text-[28px] font-medium leading-none text-foreground sm:text-[34px]"
            )}
          >
            Career Utsav
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {view.isAllCities ? (
              <>
                Bangalore · Mysore · Hubli
                <span className="mx-2 text-border">·</span>
                Event overview
              </>
            ) : (
              <>
                {view.cityLabel}
                <span className="mx-2 text-border">·</span>
                How this city is shaping up
              </>
            )}
          </p>
        </div>
        <DashboardCitySelector value={cityFilter} onChange={setCityFilter} />
      </header>

      <AnimatePresence mode="wait">
        <motion.div key={cityFilter} {...sectionMotion} className="space-y-12">
          {/* Hero — one soft premium composition */}
          <section className={cn(surface.opening, "hero-type")}>
            <div className="grid lg:grid-cols-10 lg:items-stretch">
              {/* LEFT ~40% — headline */}
              <div className="flex flex-col justify-between gap-8 p-7 sm:p-8 lg:col-span-4 lg:border-r lg:border-border/40 lg:p-9">
                <div>
                  <p className="text-[15px] font-medium tracking-[-0.01em] text-muted-foreground sm:text-[16px]">
                    {view.isAllCities
                      ? "Students registered"
                      : "Students joining"}
                  </p>
                  <p className="mt-2 text-[72px] font-semibold leading-[0.92] tracking-[-0.04em] tabular-nums text-foreground sm:text-[88px]">
                    {formatNumber(students)}
                  </p>
                  {!view.isAllCities && (
                    <p className="mt-4 text-[15px] leading-relaxed tracking-[-0.01em] text-muted-foreground">
                      <span className="font-semibold tabular-nums text-foreground">
                        {formatNumber(today)}
                      </span>{" "}
                      joined today
                      <span className="mx-1.5 text-border">·</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {coreShare}%
                      </span>{" "}
                      from classes 9–12
                    </p>
                  )}
                </div>

                <dl className="space-y-3.5">
                  {supportFacts.map((fact) => (
                    <div
                      key={fact.label}
                      className="flex items-baseline justify-between gap-4 border-b border-border/30 pb-3 last:border-b-0 last:pb-0"
                    >
                      <dt className="shrink-0 text-[14px] tracking-[-0.01em] text-muted-foreground">
                        {fact.label}
                      </dt>
                      <dd className="min-w-0 truncate text-right text-[15px] font-semibold tracking-[-0.02em] text-foreground sm:text-[16px]">
                        {fact.value}
                      </dd>
                    </div>
                  ))}
                </dl>

                {!view.isAllCities && view.vsAverage.length > 0 && (
                  <CityComparisonInline
                    cityLabel={view.cityLabel}
                    metrics={view.vsAverage}
                  />
                )}
              </div>

              {/* RIGHT ~60% — full-bleed city columns (all cities) */}
              <div
                className={cn(
                  "lg:col-span-6",
                  view.isAllCities
                    ? "min-h-[280px] overflow-hidden p-0 lg:min-h-full"
                    : "min-h-[300px] p-7 sm:p-8 lg:p-9"
                )}
              >
                {view.isAllCities ? (
                  <CitySharePanel cities={cityData} colors={CITY_COLORS} />
                ) : (
                  <div className="flex h-full min-h-[240px] flex-col">
                    <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">
                      Students by class
                    </h3>
                    <p className="mt-1.5 text-[14px] tracking-[-0.01em] text-muted-foreground">
                      Class profile in {view.cityLabel}
                    </p>
                    <div className="mt-8 flex flex-1 flex-col justify-center">
                      <ClassRidge classes={classInOrder} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <StudentRegistrationSection
            data={view.studentRegistration}
            cityLabel={view.cityLabel}
            isAllCities={view.isAllCities}
          />

          <PartnerSalesSection
            data={view.partnerSales}
            cityLabel={view.cityLabel}
            isAllCities={view.isAllCities}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
