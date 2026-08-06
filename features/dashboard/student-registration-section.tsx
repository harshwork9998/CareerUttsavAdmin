"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import {
  buildStudentRegistrationAnalytics,
  formatWeekLabel,
  getScopedStudentRegistrationDates,
  weekStartMonday,
} from "@/lib/build-dashboard-student-analytics";
import { cn, formatNumber } from "@/lib/utils";
import type {
  Event,
  LiveRegistrationItem,
  Registration,
  StudentRegistrationAnalytics,
} from "@/types";
import { BRAND, surface } from "@/features/dashboard/dashboard-ui";
import { SeminarProgram } from "@/features/dashboard/seminar-program";
import { ShareDonutCard } from "@/features/dashboard/share-donut-card";
import {
  aggregateByCareerInterest,
  type CareerInterestRow,
} from "@/features/dashboard/seminars";

type TimelineMode = "weekly" | "monthly" | "custom";

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MONTH_FULL: Record<(typeof MONTH_ABBR)[number], string> = {
  Jan: "January",
  Feb: "February",
  Mar: "March",
  Apr: "April",
  May: "May",
  Jun: "June",
  Jul: "July",
  Aug: "August",
  Sep: "September",
  Oct: "October",
  Nov: "November",
  Dec: "December",
};

function parseDateInput(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function toInputDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

/** Count registrations per week (week starts Monday). */
function buildWeeklySeries(dates: Date[]): Array<{ name: string; value: number }> {
  const map = new Map<string, { value: number; sortKey: number }>();
  for (const date of dates) {
    const weekStart = weekStartMonday(date);
    const label = formatWeekLabel(weekStart);
    const prev = map.get(label);
    map.set(label, {
      value: (prev?.value ?? 0) + 1,
      sortKey: weekStart.getTime(),
    });
  }
  return Array.from(map.entries())
    .sort((a, b) => a[1].sortKey - b[1].sortKey)
    .map(([name, row]) => ({ name, value: row.value }));
}

/** Count registrations per calendar month. */
function buildMonthlySeries(dates: Date[]): Array<{ name: string; value: number }> {
  const map = new Map<string, { label: string; value: number; order: number }>();
  for (const date of dates) {
    const abbr = MONTH_ABBR[date.getMonth()];
    const year = date.getFullYear();
    const key = `${year}-${abbr}`;
    const prev = map.get(key);
    map.set(key, {
      label: `${MONTH_FULL[abbr]} ${year}`,
      value: (prev?.value ?? 0) + 1,
      order: year * 12 + date.getMonth(),
    });
  }
  return Array.from(map.values())
    .sort((a, b) => a.order - b.order)
    .map((row) => ({ name: row.label, value: row.value }));
}

function TrendTooltip({
  active,
  payload,
  label,
  mode,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  mode: TimelineMode;
}) {
  if (!active || !payload?.[0]) return null;
  const periodLabel = mode === "monthly" ? label : `Week of ${label}`;
  return (
    <div className="rounded-xl border border-brand-900/12 bg-white px-3 py-2 shadow-[0_8px_24px_rgba(18,35,63,0.12)]">
      <p className="text-[12px] font-medium text-muted-foreground">
        {periodLabel}
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

function TimelineControls({
  mode,
  onModeChange,
  customFrom,
  customTo,
  onRangeChange,
}: {
  mode: TimelineMode;
  onModeChange: (mode: TimelineMode) => void;
  customFrom: string;
  customTo: string;
  onRangeChange: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rangeLabel = `${formatShortDate(parseDateInput(customFrom) ?? new Date())} – ${formatShortDate(parseDateInput(customTo) ?? new Date())}`;

  const modes: Array<{ id: TimelineMode; label: string }> = [
    { id: "weekly", label: "Weekly" },
    { id: "monthly", label: "Monthly" },
    { id: "custom", label: "Custom" },
  ];

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <div
        role="tablist"
        aria-label="Registration timeline"
        className="inline-flex rounded-lg border border-brand-900/12 bg-brand-50/70 p-0.5"
      >
        {modes.map((opt) => {
          const active = mode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                onModeChange(opt.id);
                if (opt.id === "custom") setOpen(true);
                else setOpen(false);
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors",
                active
                  ? "bg-white text-brand-950 shadow-sm"
                  : "text-brand-900/55 hover:text-brand-900"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {mode === "custom" ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-900/12 bg-white px-2.5 text-[12px] font-semibold text-brand-950 shadow-sm transition-colors hover:border-brand-700/30 hover:bg-brand-50/60"
            >
              <span className="tabular-nums">{rangeLabel}</span>
              <ChevronDown className="size-3.5 text-brand-900/45" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-[280px] border-brand-900/10 p-3 shadow-[0_12px_40px_rgba(18,35,63,0.14)]"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-900/45">
              Your dates
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                aria-label="From date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => {
                  const next = e.target.value || customFrom;
                  onRangeChange(
                    next,
                    customTo && customTo < next ? next : customTo || next
                  );
                }}
                className="h-8 flex-1 border-brand-900/12 bg-white px-2 text-[12px] shadow-none"
              />
              <span className="shrink-0 text-[11px] text-muted-foreground">
                to
              </span>
              <Input
                type="date"
                aria-label="To date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => {
                  const next = e.target.value || customTo;
                  onRangeChange(
                    customFrom && customFrom > next ? next : customFrom || next,
                    next
                  );
                }}
                className="h-8 flex-1 border-brand-900/12 bg-white px-2 text-[12px] shadow-none"
              />
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
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
}: {
  careerInterests: CareerInterestRow[];
  /** ISO timestamps of scoped student registrations */
  registrationDates: string[];
  liveFeed: LiveRegistrationItem[];
}) {
  const [mode, setMode] = useState<TimelineMode>("weekly");
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
    return { from: toInputDate(startOfDay(min)), to: toInputDate(startOfDay(max)) };
  }, [dates]);

  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const customTouchedRef = useRef(false);

  useEffect(() => {
    // Keep default range aligned with data until the user picks custom dates.
    if (customTouchedRef.current) return;
    setCustomFrom(dataRange.from);
    setCustomTo(dataRange.to);
  }, [dataRange.from, dataRange.to]);

  const resolvedFrom = customFrom || dataRange.from;
  const resolvedTo = customTo || dataRange.to;

  const chartData = useMemo(() => {
    if (mode === "monthly") {
      return buildMonthlySeries(dates);
    }

    if (mode === "custom") {
      const from = parseDateInput(resolvedFrom);
      const to = parseDateInput(resolvedTo);
      if (!from || !to) return [];
      const start = startOfDay(from <= to ? from : to);
      const end = endOfDay(from <= to ? to : from);
      const inRange = dates.filter((date) => date >= start && date <= end);
      // Show weekly buckets for registrations that fall inside the chosen dates.
      return buildWeeklySeries(inRange);
    }

    // Weekly: count of registrations in each week
    return buildWeeklySeries(dates);
  }, [mode, dates, resolvedFrom, resolvedTo]);

  const chartTotal = chartData.reduce((s, r) => s + r.value, 0);
  const showDots = mode === "monthly" || chartData.length <= 12;

  const subtitle =
    mode === "weekly"
      ? "Registrations counted by week"
      : mode === "monthly"
        ? "Registrations counted by month"
        : `${formatShortDate(parseDateInput(resolvedFrom) ?? new Date())} – ${formatShortDate(parseDateInput(resolvedTo) ?? new Date())}`;

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
            <TimelineControls
              mode={mode}
              onModeChange={setMode}
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
            {chartData.length === 0 ? (
              <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-brand-900/15 bg-brand-50/30 text-[13px] text-muted-foreground">
                No registrations in this range
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
                    interval={mode === "monthly" ? 0 : "preserveStartEnd"}
                    minTickGap={mode === "monthly" ? 4 : 36}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#64748B" }}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                    tickFormatter={(v) => formatNumber(Number(v))}
                  />
                  <Tooltip content={<TrendTooltip mode={mode} />} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name="Registrations"
                    stroke={BRAND[700]}
                    strokeWidth={2.5}
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
