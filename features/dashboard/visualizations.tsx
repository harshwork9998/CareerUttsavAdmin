"use client";

import { useState } from "react";
import { motion } from "framer-motion";

import { cn, formatNumber } from "@/lib/utils";
import {
  CITY_COLORS,
  DASH_COLORS,
  BRAND,
  displayClass,
} from "@/features/dashboard/dashboard-ui";

/* ─── City columns ─── */

const CITY_SCALE = [
  CITY_COLORS.Bangalore,
  CITY_COLORS.Mysore,
  CITY_COLORS.Hubli,
] as const;

export function CityMosaic({
  cities,
  colors,
}: {
  cities: Array<{ name: string; value: number }>;
  colors: Record<string, string>;
}) {
  return <CitySharePanel cities={cities} colors={colors} />;
}

/**
 * City comparison cards — white panels with a soft green shadow hint.
 */
export function CitySharePanel({
  cities,
  colors,
  unitLabel = "students",
  onSelectCity,
}: {
  cities: Array<{ name: string; value: number }>;
  colors?: Record<string, string>;
  unitLabel?: string;
  /** Click a city card to filter the dashboard to that city */
  onSelectCity?: (city: string) => void;
}) {
  const total = cities.reduce((s, c) => s + c.value, 0) || 1;
  const [hover, setHover] = useState<string | null>(null);

  const palette = (name: string, index: number) =>
    colors?.[name] ??
    CITY_COLORS[name] ??
    CITY_SCALE[index % CITY_SCALE.length];

  return (
    <div
      className="flex h-full min-h-[280px] w-full gap-3 bg-brand-50/50 p-3 sm:gap-4 sm:p-4"
      onMouseLeave={() => setHover(null)}
    >
      {cities.map((city, index) => {
        const share = city.value / total;
        const pct = Math.round(share * 100);
        const active = hover === null || hover === city.name;
        const accent = palette(city.name, index);

        return (
          <button
            key={city.name}
            type="button"
            onMouseEnter={() => setHover(city.name)}
            onClick={() => onSelectCity?.(city.name)}
            className={cn(
              "relative flex min-w-0 flex-1 flex-col justify-between overflow-hidden rounded-2xl border border-brand-900/10 bg-white p-4 text-left transition-all duration-150 sm:p-5",
              "shadow-card",
              active ? "shadow-soft" : "opacity-55",
              onSelectCity && "cursor-pointer hover:border-brand-700/30"
            )}
            aria-label={`${city.name}: ${formatNumber(city.value)} ${unitLabel}, ${pct}%`}
          >
            <span
              className="absolute inset-x-0 top-0 h-1"
              style={{ backgroundColor: accent }}
              aria-hidden
            />
            <div className="relative pt-1">
              <p className="text-[16px] font-semibold tracking-[-0.02em] text-foreground sm:text-[18px]">
                {city.name}
              </p>
              <p
                className="mt-1.5 text-[13px] font-semibold tabular-nums tracking-[-0.01em] sm:text-[14px]"
                style={{ color: accent }}
              >
                {pct}%
              </p>
            </div>
            <p className="relative text-[44px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-brand-950 sm:text-[56px]">
              {formatNumber(city.value)}
            </p>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Class profile curve ─── */

export function ClassRidge({
  classes,
}: {
  classes: Array<{ name: string; value: number; segment?: string | number }>;
}) {
  const max = Math.max(...classes.map((c) => c.value), 1);
  const [hover, setHover] = useState<number | null>(null);
  const w = 100;
  const h = 56;
  const padY = 4;

  const points = classes.map((c, i) => {
    const x =
      classes.length === 1 ? w / 2 : (i / (classes.length - 1)) * w;
    const y = h - padY - (c.value / max) * (h - padY * 2);
    return { x, y, ...c, i };
  });

  const lineD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
  const areaD = `${lineD} L ${w} ${h} L 0 ${h} Z`;
  const active = hover !== null ? points[hover] : null;
  const coreStart = classes.findIndex((c) => c.segment === "core");

  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="h-[140px] w-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="classFill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={DASH_COLORS.primary}
                stopOpacity="0.22"
              />
              <stop
                offset="100%"
                stopColor={DASH_COLORS.primary}
                stopOpacity="0.01"
              />
            </linearGradient>
          </defs>
          {coreStart > 0 && classes.length > 1 && (
            <rect
              x={(coreStart / (classes.length - 1)) * w}
              y={0}
              width={w - (coreStart / (classes.length - 1)) * w}
              height={h}
              fill={DASH_COLORS.secondary}
              opacity={0.06}
            />
          )}
          <path d={areaD} fill="url(#classFill)" />
          <path
            d={lineD}
            fill="none"
            stroke={DASH_COLORS.primary}
            strokeWidth="1.75"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((p) => (
            <circle
              key={p.name}
              cx={p.x}
              cy={p.y}
              r={hover === p.i ? 2.4 : 1.4}
              fill={
                p.segment === "core"
                  ? DASH_COLORS.secondary
                  : DASH_COLORS.primary
              }
              className="cursor-pointer"
              onMouseEnter={() => setHover(p.i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        {active && (
          <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded-md border border-border/70 bg-card px-2.5 py-1 shadow-sm">
            <p className="whitespace-nowrap text-[11px] font-medium leading-none">
              {active.name}
              <span className="ml-1.5 tabular-nums text-muted-foreground">
                {formatNumber(active.value)}
              </span>
            </p>
          </div>
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>Class 4</span>
        <span className="text-foreground/70">9–12 focus</span>
        <span>Class 12</span>
      </div>
    </div>
  );
}

/* ─── Share rows — quiet proportions, not waffle gimmick ─── */

const SHARE_PALETTE = [
  DASH_COLORS.primary,
  DASH_COLORS.secondary,
  DASH_COLORS.accent,
  "#64748B",
  "#94A3B8",
];

export function ShareRows({
  items,
}: {
  items: Array<{ name: string; value: number }>;
}) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const max = Math.max(...items.map((i) => i.value), 1);
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div className="space-y-2.5" onMouseLeave={() => setHover(null)}>
      {items.map((item, index) => {
        const pct = Math.round((item.value / total) * 100);
        const width = (item.value / max) * 100;
        const active = hover === null || hover === item.name;
        return (
          <button
            key={item.name}
            type="button"
            onMouseEnter={() => setHover(item.name)}
            className={cn(
              "group w-full text-left transition-opacity duration-150",
              !active && "opacity-35"
            )}
          >
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-[13px] font-medium">{item.name}</span>
              <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {formatNumber(item.value)}
                </span>
                <span className="ml-1.5 text-[10px]">{pct}%</span>
              </span>
            </div>
            <div className="h-[3px] w-full overflow-hidden rounded-full bg-border/50">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${width}%`,
                  backgroundColor: SHARE_PALETTE[index % SHARE_PALETTE.length],
                }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** @deprecated Prefer ShareRows */
export const ShareWaffle = ShareRows;
export const ShareMosaic = ShareRows;

export { SeminarProgram } from "@/features/dashboard/seminar-program";
export { SeminarProgram as SeminarTreemap } from "@/features/dashboard/seminar-program";
export { SeminarProgram as SeminarLollipops } from "@/features/dashboard/seminar-program";

/* ─── Schools ─── */

export function SchoolLeaderboard({
  schools,
}: {
  schools: Array<{ name: string; value: number; city?: string }>;
}) {
  return (
    <ol>
      {schools.slice(0, 5).map((school, index) => (
        <li
          key={school.name}
          className="flex items-baseline gap-3 border-b border-border/30 py-2 last:border-b-0"
        >
          <span
            className={cn(
              "w-5 shrink-0 text-[12px] tabular-nums",
              index === 0
                ? cn(displayClass, "font-medium text-foreground")
                : "text-muted-foreground"
            )}
          >
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "truncate text-[13px]",
                index === 0 ? "font-semibold" : "font-medium"
              )}
            >
              {school.name}
            </p>
          </div>
          {school.city && (
            <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">
              {school.city}
            </span>
          )}
          <span className="shrink-0 text-[13px] font-semibold tabular-nums">
            {formatNumber(school.value)}
          </span>
        </li>
      ))}
    </ol>
  );
}

/* ─── Activity feed ─── */

export function ActivityFeed({
  items,
}: {
  items: Array<{
    id: string;
    primary: string;
    secondary: string;
    time: string;
  }>;
}) {
  return (
    <ul>
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-baseline gap-3 border-b border-border/25 py-2 last:border-b-0"
        >
          <span className="w-12 shrink-0 text-[10px] tabular-nums text-muted-foreground">
            {item.time}
          </span>
          <span className="min-w-0 flex-1 truncate text-[12.5px]">
            <span className="font-medium">{item.primary}</span>
            <span className="text-muted-foreground"> · {item.secondary}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ─── In-discussion pipeline — large connected stages ─── */

const DISCUSSION_STAGES = [
  "New",
  "Contacted",
  "Meeting Scheduled",
  "Proposal Sent",
  "Discussion",
] as const;

const DISCUSSION_LABELS: Record<(typeof DISCUSSION_STAGES)[number], string> = {
  New: "New",
  Contacted: "Contacted",
  "Meeting Scheduled": "Meeting",
  "Proposal Sent": "Proposal",
  Discussion: "Discussion",
};

function PipelineArrow({ delay }: { delay: number }) {
  return (
    <motion.div
      className="relative mt-3 hidden h-8 w-6 shrink-0 sm:block md:w-10 lg:w-14"
      initial={{ opacity: 0, scaleX: 0.4 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{
        duration: 0.45,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      style={{ transformOrigin: "left center" }}
      aria-hidden
    >
      <svg
        viewBox="0 0 64 24"
        className="absolute inset-0 h-full w-full overflow-visible"
        preserveAspectRatio="none"
      >
        <motion.line
          x1="0"
          y1="12"
          x2="48"
          y2="12"
          stroke={BRAND[700]}
          strokeWidth="4"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.55, delay: delay + 0.05, ease: "easeOut" }}
        />
        <motion.polygon
          points="44,3 62,12 44,21"
          fill={BRAND[700]}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: delay + 0.35 }}
        />
      </svg>
      <motion.span
        className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-white/90 shadow-sm"
        animate={{ left: ["4%", "72%"], opacity: [0, 1, 1, 0] }}
        transition={{
          duration: 1.7,
          delay: delay + 0.5,
          repeat: Infinity,
          repeatDelay: 1,
          ease: "easeInOut",
        }}
      />
    </motion.div>
  );
}

export function PartnerJourneyFlow({
  stages,
  onSelect,
}: {
  stages: Array<{ name: string; count: number }>;
  onSelect: (name: string) => void;
}) {
  const byName = Object.fromEntries(stages.map((s) => [s.name, s.count]));
  const flow = DISCUSSION_STAGES.map((name) => ({
    name,
    count: byName[name] ?? 0,
  }));
  const total = flow.reduce((s, x) => s + x.count, 0) || 1;
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-bold tracking-tight text-foreground">
            In discussion pipeline
          </h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Path from first hello to a decision
          </p>
        </div>
        <p className="text-[12px] tabular-nums text-muted-foreground">
          <span className="font-semibold text-foreground">
            {formatNumber(total)}
          </span>{" "}
          in discussion
        </p>
      </div>

      <div
        className="flex items-center overflow-x-auto pb-0.5"
        onMouseLeave={() => setHover(null)}
      >
        {flow.map((stage, index) => {
          const active = hover === null || hover === stage.name;
          const share = Math.round((stage.count / total) * 100);
          const isLast = index === flow.length - 1;

          return (
            <div
              key={stage.name}
              className="flex min-w-0 flex-1 items-start"
            >
              <motion.button
                type="button"
                onClick={() => onSelect(stage.name)}
                onMouseEnter={() => setHover(stage.name)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.35,
                  delay: index * 0.06,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={cn(
                  "group relative z-[1] flex w-full min-w-[80px] flex-col items-center gap-2 px-1 text-center outline-none transition-opacity duration-150 sm:min-w-0 sm:px-1.5",
                  !active && "opacity-35"
                )}
              >
                <motion.div
                  className="relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_0_0_4px_rgba(31,56,100,0.1)] sm:h-16 sm:w-16 sm:shadow-[0_0_0_5px_rgba(31,56,100,0.1)]"
                  style={{ backgroundColor: BRAND[700] }}
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 280,
                    damping: 20,
                    delay: 0.08 + index * 0.06,
                  }}
                  whileHover={{ scale: 1.05 }}
                >
                  <span className="text-[22px] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[26px]">
                    {formatNumber(stage.count)}
                  </span>
                </motion.div>

                <div className="space-y-0.5">
                  <p className="text-[12px] font-bold leading-snug tracking-tight text-foreground sm:text-[13px]">
                    {DISCUSSION_LABELS[stage.name]}
                  </p>
                  <p className="text-[10px] tabular-nums text-muted-foreground sm:text-[11px]">
                    {share}% of open
                  </p>
                </div>
              </motion.button>

              {!isLast && <PipelineArrow delay={0.16 + index * 0.06} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Sponsorship typography ─── */

const TIER_ORDER = [
  "Presenting Partner",
  "Co-Presenting Partner",
  "University Partner",
  "Knowledge Partner (Gold)",
  "Knowledge Partner (Silver)",
  "Education Partner",
  "Stall Partner",
] as const;

const TIER_TYPE = [
  "text-[22px] sm:text-[26px]",
  "text-[18px] sm:text-[20px]",
  "text-[16px]",
  "text-[14px]",
  "text-[13px]",
  "text-[12px]",
  "text-[12px]",
] as const;

export function TierHierarchy({
  tiers,
  onSelect,
}: {
  tiers: Array<{ name: string; value: number }>;
  onSelect: (name: string) => void;
}) {
  const byName = Object.fromEntries(tiers.map((t) => [t.name, t.value]));
  const ordered = TIER_ORDER.map((name, index) => ({
    name,
    value: byName[name] ?? 0,
    index,
  })).filter((t) => tiers.some((x) => x.name === t.name));

  const total = ordered.reduce((s, t) => s + t.value, 0) || 1;

  return (
    <div className="space-y-0.5">
      {ordered.map((tier) => {
        const pct = Math.round((tier.value / total) * 100);
        return (
          <button
            key={tier.name}
            type="button"
            onClick={() => onSelect(tier.name)}
            className="group flex w-full items-baseline justify-between gap-4 py-1.5 text-left transition-colors duration-100 hover:bg-muted/25"
          >
            <span
              className={cn(
                displayClass,
                "min-w-0 font-medium text-foreground",
                TIER_TYPE[tier.index] ?? "text-[12px]"
              )}
            >
              {tier.name}
            </span>
            <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
              <span className="font-semibold text-foreground">
                {formatNumber(tier.value)}
              </span>
              <span className="ml-1.5 text-[10px]">{pct}%</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
