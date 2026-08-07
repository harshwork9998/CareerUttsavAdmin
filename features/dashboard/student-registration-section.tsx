"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  buildStudentRegistrationAnalytics,
  getScopedStudentRegistrationDates,
} from "@/lib/build-dashboard-student-analytics";
import {
  groupingLabel,
  parseInputDate,
  toInputDate,
  type RegistrationTrendGrouping,
} from "@/lib/registration-time-series";
import { cn, formatNumber } from "@/lib/utils";
import type {
  Event,
  LiveRegistrationItem,
  Registration,
  StudentRegistrationAnalytics,
} from "@/types";
import { BRAND, INK, LINE, PAPER, surface } from "@/features/dashboard/dashboard-ui";
import { SeminarProgram } from "@/features/dashboard/seminar-program";
import { ShareDonutCard } from "@/features/dashboard/share-donut-card";
import {
  aggregateByCareerInterest,
  type CareerInterestRow,
} from "@/features/dashboard/seminars";
import { DateField } from "@/features/events/event-datetime-fields";
import { dashboardService } from "@/services/api";

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function parseRegistrationDates(timestamps: string[]): Date[] {
  return timestamps
    .map((raw) => new Date(raw))
    .filter((date) => !Number.isNaN(date.getTime()));
}

function TrendTooltip({
  active,
  payload,
  label,
  grouping,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  grouping: RegistrationTrendGrouping;
}) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="rounded-xl border border-brand-900/12 bg-white px-3 py-2 shadow-[0_8px_24px_rgba(18,35,63,0.12)]">
      <p className="text-[12px] font-medium text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-[11px] text-brand-900/45">
        {groupingLabel(grouping)}
      </p>
      <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-brand-950">
        {formatNumber(Number(payload[0].value))}{" "}
        <span className="text-[12px] font-medium text-muted-foreground">
          registrations
        </span>
      </p>
    </div>
  );
}

function TimelineRangeControls({
  customFrom,
  customTo,
  onRangeChange,
}: {
  customFrom: string;
  customTo: string;
  onRangeChange: (from: string, to: string) => void;
}) {
  return (
    <div
      className="inline-flex h-9 max-w-full items-stretch overflow-hidden rounded-lg border bg-white"
      style={{ borderColor: LINE.subtle }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 px-2 sm:px-2.5">
        <span
          className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: INK.muted }}
        >
          From
        </span>
        <DateField
          id="registration-trend-from"
          value={customFrom}
          max={customTo || undefined}
          onChange={(next) => {
            const value = next || customFrom;
            onRangeChange(
              value,
              customTo && customTo < value ? value : customTo || value
            );
          }}
          className="h-7 min-w-0 flex-1 border-0 bg-transparent px-1.5 text-[12px] font-medium shadow-none hover:bg-brand-50/60 focus-visible:ring-0"
        />
      </div>
      <div
        className="flex w-9 shrink-0 items-center justify-center border-x text-[11px] font-medium leading-none"
        style={{
          borderColor: LINE.subtle,
          color: INK.muted,
          background: PAPER.muted,
        }}
        aria-hidden
      >
        to
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 px-2 sm:px-2.5">
        <span
          className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: INK.muted }}
        >
          To
        </span>
        <DateField
          id="registration-trend-to"
          value={customTo}
          min={customFrom || undefined}
          onChange={(next) => {
            const value = next || customTo;
            onRangeChange(
              customFrom && customFrom > value ? value : customFrom || value,
              value
            );
          }}
          className="h-7 min-w-0 flex-1 border-0 bg-transparent px-1.5 text-[12px] font-medium shadow-none hover:bg-brand-50/60 focus-visible:ring-0"
        />
      </div>
    </div>
  );
}

function formatRelativeTime(timestamp: string): string {
  const then = new Date(timestamp).getTime();
  if (!Number.isFinite(then)) return "";
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return "Just now";
  const mins = Math.round(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function LiveRegistrationFeed({ items }: { items: LiveRegistrationItem[] }) {
  const feed = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    [items]
  );

  return (
    <div className="flex flex-col border-t border-brand-900/10 p-5 sm:p-6 lg:border-l lg:border-t-0">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-bold tracking-tight text-foreground">
            Live registrations
          </h3>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Newest students joining
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(47,107,79,0.12)] px-2 py-1 text-[11px] font-semibold text-[#2F6B4F]">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#2F6B4F] opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-[#2F6B4F]" />
          </span>
          Live
        </span>
      </div>

      <div className="max-h-[340px] flex-1 space-y-0 overflow-auto rounded-xl border border-brand-900/12">
        {feed.length === 0 ? (
          <div className="flex h-40 items-center justify-center px-4 text-center text-[13px] text-muted-foreground">
            No new registrations yet
          </div>
        ) : (
          feed.map((item) => {
            const detail = [item.classLabel, item.stream, item.board]
              .filter(Boolean)
              .join(" · ");
            return (
              <div
                key={item.id}
                className="border-b border-brand-900/8 px-3 py-2.5 last:border-b-0 hover:bg-brand-50/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-[13px] font-semibold tracking-tight text-foreground">
                    {item.studentName}
                  </p>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {formatRelativeTime(item.timestamp)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                  {detail || item.school}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-brand-900/55">
                  {item.school}
                  {item.city ? ` · ${item.city}` : ""}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function CareerInterestPanel({ rows }: { rows: CareerInterestRow[] }) {
  const [expandedId, setExpandedId] = useState<CareerInterestRow["id"] | null>(
    null
  );

  return (
    <div className="flex flex-col border-b border-brand-900/10 p-5 sm:p-6 lg:border-b-0 lg:border-r">
      <div className="mb-4">
        <h3 className="text-[15px] font-bold tracking-tight text-foreground">
          Career interests
        </h3>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Which careers registrants want to pursue
        </p>
      </div>

      <div className="max-h-[340px] flex-1 overflow-auto rounded-xl border border-brand-900/12">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-[1]">
            <tr className="border-b border-brand-900/10 bg-brand-50/95">
              <th className="px-3 py-2 text-left text-[11px] font-semibold text-brand-900/55">
                Track
              </th>
              <th className="px-3 py-2 text-right text-[11px] font-semibold text-brand-900/55">
                Registrations
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const expanded = expandedId === row.id;
              return (
                <Fragment key={row.id}>
                  <tr
                    className="cursor-pointer border-b border-brand-900/8 hover:bg-brand-50/40"
                    onClick={() =>
                      setExpandedId(expanded ? null : row.id)
                    }
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 text-base leading-none">
                          {row.emoji}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold tracking-tight text-foreground">
                            {row.label}
                          </p>
                          <p className="mt-0.5 text-[11px] text-brand-900/45">
                            {row.seminars.length} sessions · tap to view
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px] font-semibold tabular-nums text-brand-950">
                      {formatNumber(row.value)}
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="border-b border-brand-900/8 bg-brand-50/30">
                      <td colSpan={2} className="px-3 py-2">
                        <ul className="space-y-1.5 pl-1">
                          {row.seminars.map((seminar) => (
                            <li
                              key={seminar.name}
                              className="flex items-start justify-between gap-3 text-[12px]"
                            >
                              <span className="min-w-0 text-brand-900/75">
                                {seminar.name}
                              </span>
                              <span className="shrink-0 font-semibold tabular-nums text-brand-950">
                                {formatNumber(seminar.value)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CareerInterestAndTrend({
  careerInterests,
  registrationDates,
  liveFeed,
  city,
}: {
  careerInterests: CareerInterestRow[];
  /** ISO timestamps used only to seed the default date range */
  registrationDates: string[];
  liveFeed: LiveRegistrationItem[];
  city: string | "all";
}) {
  const dates = useMemo(
    () => parseRegistrationDates(registrationDates),
    [registrationDates]
  );

  const dataRange = useMemo(() => {
    if (dates.length === 0) {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return { from: toInputDate(from), to: toInputDate(now) };
    }
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    return {
      from: toInputDate(startOfDay(min)),
      to: toInputDate(startOfDay(max)),
    };
  }, [dates]);

  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const customTouchedRef = useRef(false);

  useEffect(() => {
    // Keep default range aligned with data until the user picks dates.
    if (customTouchedRef.current) return;
    setCustomFrom(dataRange.from);
    setCustomTo(dataRange.to);
  }, [dataRange.from, dataRange.to]);

  const resolvedFrom = customFrom || dataRange.from;
  const resolvedTo = customTo || dataRange.to;
  const rangeValid = Boolean(
    parseInputDate(resolvedFrom) && parseInputDate(resolvedTo)
  );

  const trendQuery = useQuery({
    queryKey: [
      "dashboard-registration-trend",
      resolvedFrom,
      resolvedTo,
      city,
      registrationDates.length,
    ],
    queryFn: () =>
      dashboardService.getRegistrationTrend({
        from: resolvedFrom,
        to: resolvedTo,
        city,
      }),
    enabled: rangeValid,
    placeholderData: (previous) => previous,
  });

  const chartData = trendQuery.data?.points ?? [];
  const grouping = trendQuery.data?.grouping ?? "day";
  const chartTotal = trendQuery.data?.total ?? 0;
  const showDots = chartData.length <= 16;

  const subtitle = `${formatShortDate(parseInputDate(resolvedFrom) ?? new Date())} – ${formatShortDate(parseInputDate(resolvedTo) ?? new Date())} · ${groupingLabel(grouping)}`;

  return (
    <motion.div
      className={cn(surface.opening, "overflow-hidden")}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="grid lg:grid-cols-3 lg:items-stretch">
        <CareerInterestPanel rows={careerInterests} />

        {/* Registration trend — 1/3 */}
        <div className="flex flex-col border-b border-brand-900/10 p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="mb-3 space-y-2.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-[15px] font-bold tracking-tight text-foreground">
                  Registrations over time
                </h3>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {subtitle}
                </p>
              </div>
              <p className="text-[12px] tabular-nums text-muted-foreground">
                <span className="font-semibold text-brand-900">
                  {formatNumber(chartTotal)}
                </span>{" "}
                in view
              </p>
            </div>
            <TimelineRangeControls
              customFrom={resolvedFrom}
              customTo={resolvedTo}
              onRangeChange={(from, to) => {
                customTouchedRef.current = true;
                setCustomFrom(from);
                setCustomTo(to);
              }}
            />
          </div>

          <div className="min-h-[280px] flex-1 sm:min-h-[320px]">
            {trendQuery.isError ? (
              <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-brand-900/15 bg-brand-50/30 text-[13px] text-muted-foreground">
                Could not load registrations for this range
              </div>
            ) : chartData.length === 0 && trendQuery.isLoading ? (
              <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-brand-900/15 bg-brand-50/30 text-[13px] text-muted-foreground">
                Loading trend…
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-brand-900/15 bg-brand-50/30 text-[13px] text-muted-foreground">
                Select a valid date range
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: -8, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(18, 35, 63, 0.08)"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "#64748B" }}
                    tickLine={false}
                    axisLine={{ stroke: "rgba(18, 35, 63, 0.12)" }}
                    interval="preserveStartEnd"
                    minTickGap={grouping === "day" ? 28 : 36}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#64748B" }}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                    allowDecimals={false}
                    tickFormatter={(v) => formatNumber(Number(v))}
                  />
                  <Tooltip content={<TrendTooltip grouping={grouping} />} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name="Registrations"
                    stroke={BRAND[700]}
                    strokeWidth={2.5}
                    connectNulls
                    dot={
                      showDots
                        ? {
                            r: 3.5,
                            fill: BRAND[700],
                            stroke: "#fff",
                            strokeWidth: 2,
                          }
                        : false
                    }
                    activeDot={{
                      r: 5,
                      fill: BRAND[700],
                      stroke: "#fff",
                      strokeWidth: 2,
                    }}
                    isAnimationActive
                    animationDuration={700}
                    animationEasing="ease-out"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Live updates — 1/3 */}
        <LiveRegistrationFeed items={liveFeed} />
      </div>
    </motion.div>
  );
}

export function StudentRegistrationSection({
  data,
  cityLabel,
  isAllCities,
  eventCities = [],
  registrations = [],
  events = [],
}: {
  data: StudentRegistrationAnalytics;
  cityLabel?: string;
  isAllCities?: boolean;
  eventCities?: string[];
  registrations?: Registration[];
  events?: Event[];
}) {
  const streamData = useMemo(
    () =>
      data.byStream.map((item) => ({
        name: String(item.name),
        value: Number(item.value),
      })),
    [data.byStream]
  );

  const boardData = useMemo(
    () =>
      data.byBoard.map((item) => ({
        name: String(item.name),
        value: Number(item.value),
      })),
    [data.byBoard]
  );

  const classData = useMemo(
    () =>
      data.byClass.map((item) => ({
        name: String(item.name),
        value: Number(item.value),
      })),
    [data.byClass]
  );

  const genderData = useMemo(
    () =>
      (data.byGender ?? [])
        .filter((item) => String(item.name) !== "Prefer not to say")
        .map((item) => ({
          name: String(item.name),
          value: Number(item.value),
        })),
    [data.byGender]
  );

  const careerInterests = useMemo(
    () =>
      aggregateByCareerInterest(
        data.bySeminar.map((item) => ({
          name: String(item.name),
          value: Number(item.value),
        }))
      ),
    [data.bySeminar]
  );

  // Build trend/feed from live registrations so new entries show immediately
  // (dashboard analytics alone can lag or fall back to mock series).
  const liveStudentAnalytics = useMemo(
    () =>
      buildStudentRegistrationAnalytics(
        registrations,
        events,
        isAllCities ? "all" : (cityLabel ?? "all")
      ),
    [registrations, events, isAllCities, cityLabel]
  );

  const registrationDates = useMemo(
    () =>
      getScopedStudentRegistrationDates(
        registrations,
        events,
        isAllCities ? "all" : (cityLabel ?? "all")
      ),
    [registrations, events, isAllCities, cityLabel]
  );

  const liveFeed = useMemo(
    () => liveStudentAnalytics.liveFeed ?? data.liveFeed ?? [],
    [liveStudentAnalytics.liveFeed, data.liveFeed]
  );

  const seminarData = useMemo(
    () =>
      data.bySeminar
        .map((item) => ({
          name: String(item.name),
          value: Number(item.value),
        }))
        .sort((a, b) => b.value - a.value),
    [data.bySeminar]
  );

  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ShareDonutCard
          title="Streams they chose"
          items={streamData}
          delay={0}
        />
        <ShareDonutCard
          title="Boards they study under"
          items={boardData}
          delay={0.06}
        />
        <ShareDonutCard
          title="Students by class"
          items={classData}
          delay={0.12}
        />
        <ShareDonutCard title="Gender" items={genderData} delay={0.18} />
      </div>

      <CareerInterestAndTrend
        careerInterests={careerInterests}
        registrationDates={registrationDates}
        liveFeed={liveFeed}
        city={isAllCities ? "all" : (cityLabel ?? "all")}
      />

      <SeminarProgram
        items={seminarData}
        isAllCities={isAllCities ?? true}
        cityLabel={cityLabel}
        eventCities={eventCities}
        registrations={registrations}
        events={events}
      />
    </section>
  );
}
