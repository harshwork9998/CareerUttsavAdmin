"use client";

import { Fragment, useMemo, useState } from "react";
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

const MONTH_ORDER = ["Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const MONTH_FULL: Record<(typeof MONTH_ORDER)[number], string> = {
  Aug: "August",
  Sep: "September",
  Oct: "October",
  Nov: "November",
  Dec: "December",
};

const SEASON_FROM = "2026-08-03";
const SEASON_TO = "2026-12-28";

/** Fallback series if slice data is missing — Aug → Dec 2026. */
const DUMMY_WEEKLY_TREND: Array<{ name: string; value: number }> = [
  { name: "3 Aug", value: 620 },
  { name: "10 Aug", value: 740 },
  { name: "17 Aug", value: 860 },
  { name: "24 Aug", value: 980 },
  { name: "31 Aug", value: 1120 },
  { name: "7 Sep", value: 1280 },
  { name: "14 Sep", value: 1410 },
  { name: "21 Sep", value: 1580 },
  { name: "28 Sep", value: 1720 },
  { name: "5 Oct", value: 1890 },
  { name: "12 Oct", value: 2100 },
  { name: "19 Oct", value: 2280 },
  { name: "26 Oct", value: 2410 },
  { name: "2 Nov", value: 2360 },
  { name: "9 Nov", value: 2180 },
  { name: "16 Nov", value: 1950 },
  { name: "23 Nov", value: 1720 },
  { name: "30 Nov", value: 1480 },
  { name: "7 Dec", value: 1260 },
  { name: "14 Dec", value: 1080 },
  { name: "21 Dec", value: 920 },
  { name: "28 Dec", value: 780 },
];

const MONTH_INDEX: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

function parseWeekLabel(label: string): Date | null {
  const parts = label.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const day = Number(parts[0]);
  const month = MONTH_INDEX[parts[1]];
  if (!Number.isFinite(day) || month == null) return null;
  return new Date(2026, month, day);
}

function parseDateInput(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
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
  const rangeLabel = `${formatShortDate(parseDateInput(customFrom) ?? new Date(2026, 7, 3))} – ${formatShortDate(parseDateInput(customTo) ?? new Date(2026, 11, 28))}`;

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
                min={SEASON_FROM}
                max={customTo || SEASON_TO}
                onChange={(e) => {
                  const next = e.target.value || SEASON_FROM;
                  onRangeChange(
                    next,
                    customTo < next ? next : customTo || SEASON_TO
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
                min={customFrom || SEASON_FROM}
                max={SEASON_TO}
                onChange={(e) => {
                  const next = e.target.value || SEASON_TO;
                  onRangeChange(
                    customFrom > next ? next : customFrom || SEASON_FROM,
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
  weeklyTrend,
  liveFeed,
}: {
  careerInterests: CareerInterestRow[];
  weeklyTrend: Array<{ name: string; value: number }>;
  liveFeed: LiveRegistrationItem[];
}) {
  const [mode, setMode] = useState<TimelineMode>("weekly");
  const [customFrom, setCustomFrom] = useState<string>(SEASON_FROM);
  const [customTo, setCustomTo] = useState<string>(SEASON_TO);

  const weeklyPoints = useMemo(() => {
    const source =
      weeklyTrend.length > 0 ? weeklyTrend : DUMMY_WEEKLY_TREND;
    return source.map((row) => {
      const date = parseWeekLabel(String(row.name));
      return {
        name: String(row.name),
        value: Number(row.value),
        date,
      };
    });
  }, [weeklyTrend]);

  const chartData = useMemo(() => {
    if (mode === "monthly") {
      const buckets = new Map<(typeof MONTH_ORDER)[number], number>();
      for (const point of weeklyPoints) {
        if (!point.date) continue;
        const abbr = (
          [
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
          ] as const
        )[point.date.getMonth()];
        if (!abbr || !(MONTH_ORDER as readonly string[]).includes(abbr))
          continue;
        const key = abbr as (typeof MONTH_ORDER)[number];
        buckets.set(key, (buckets.get(key) ?? 0) + point.value);
      }
      return MONTH_ORDER.filter((m) => buckets.has(m)).map((m) => ({
        name: MONTH_FULL[m],
        value: buckets.get(m) ?? 0,
      }));
    }

    if (mode === "custom") {
      const from = parseDateInput(customFrom) ?? parseDateInput(SEASON_FROM)!;
      const to = parseDateInput(customTo) ?? parseDateInput(SEASON_TO)!;
      const start = from <= to ? from : to;
      const end = from <= to ? to : from;
      return weeklyPoints
        .filter((p) => p.date && p.date >= start && p.date <= end)
        .map((p) => ({ name: p.name, value: p.value }));
    }

    return weeklyPoints.map((p) => ({ name: p.name, value: p.value }));
  }, [mode, weeklyPoints, customFrom, customTo]);

  const chartTotal = chartData.reduce((s, r) => s + r.value, 0);
  const showDots = mode === "monthly" || chartData.length <= 8;

  const subtitle =
    mode === "custom"
      ? `${formatShortDate(parseDateInput(customFrom) ?? new Date(2026, 7, 3))} – ${formatShortDate(parseDateInput(customTo) ?? new Date(2026, 11, 28))}`
      : "August – December 2026";

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
              customFrom={customFrom}
              customTo={customTo}
              onRangeChange={(from, to) => {
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

  const weeklyTrend = useMemo(() => {
    if (data.weeklyTrend?.length) {
      return data.weeklyTrend.map((item) => ({
        name: String(item.name),
        value: Number(item.value),
      }));
    }
    if (isAllCities) {
      return DUMMY_WEEKLY_TREND.map((item) => ({
        name: String(item.name),
        value: Number(item.value),
      }));
    }
    return [];
  }, [data.weeklyTrend, isAllCities]);

  const liveFeed = useMemo(
    () => data.liveFeed ?? [],
    [data.liveFeed]
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
        weeklyTrend={weeklyTrend}
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
