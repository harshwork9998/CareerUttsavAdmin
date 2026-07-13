"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { cn, formatNumber } from "@/lib/utils";
import type { ChartDataPoint, OperatingCity } from "@/types";
import {
  CITY_COLORS,
  CHART_SERIES,
  BRAND,
  DASH_COLORS,
  surface,
} from "@/features/dashboard/dashboard-ui";
import { CAREER_UTSAV_SEMINARS } from "@/features/dashboard/seminars";
import {
  buildSeminarBreakdown,
  buildSeminarCityProfile,
} from "@/lib/mock-data/seminar-breakdown";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CITY_PILL_ORDER: OperatingCity[] = ["Bangalore", "Mysore", "Hubli"];

const CITY_PILL_COLOR: Record<OperatingCity, string> = {
  Bangalore: CITY_COLORS.Bangalore,
  Mysore: CITY_COLORS.Mysore,
  Hubli: CITY_COLORS.Hubli,
};

const DONUT_PALETTE = [...CHART_SERIES];

const easeOut = [0.22, 1, 0.36, 1] as const;

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
}) {
  if (!active || !payload?.[0]) return null;
  const row = payload[0];
  return (
    <div className="rounded-lg border border-border/60 bg-card px-2.5 py-1.5 shadow-soft">
      <p className="text-[12px] font-medium">
        {row.name}
        <span className="ml-2 tabular-nums text-muted-foreground">
          {formatNumber(row.value)}
        </span>
      </p>
    </div>
  );
}

function MiniDonut({
  title,
  items,
  centerLabel,
  delay = 0,
}: {
  title: string;
  items: ChartDataPoint[];
  centerLabel?: string;
  delay?: number;
}) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>();
  const data = items
    .map((item) => ({ name: String(item.name), value: Number(item.value) }))
    .filter((row) => row.value > 0);
  const total = data.reduce((s, r) => s + r.value, 0);
  const active = activeIndex != null ? data[activeIndex] : null;

  return (
    <motion.div
      className="rounded-xl border border-[rgba(212,209,200,0.85)] bg-white p-3.5 shadow-card transition-shadow hover:shadow-soft"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: easeOut }}
      whileHover={{ y: -2 }}
    >
      <p className="mb-2 text-[12px] font-semibold text-foreground">{title}</p>
      <div className="relative mx-auto h-[160px] w-full max-w-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={2}
              strokeWidth={0}
              isAnimationActive
              animationDuration={800}
              animationEasing="ease-out"
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(undefined)}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={DONUT_PALETTE[index % DONUT_PALETTE.length]}
                  className="cursor-pointer outline-none transition-opacity"
                  opacity={
                    activeIndex == null || activeIndex === index ? 1 : 0.35
                  }
                />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={active?.name ?? "total"}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col items-center"
            >
              <p className="text-[10px] text-muted-foreground">
                {active?.name ?? centerLabel ?? "Total"}
              </p>
              <p className="text-[18px] font-semibold tabular-nums tracking-tight">
                {formatNumber(active?.value ?? total)}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <ul className="mt-2 space-y-0.5">
        {data.map((row, index) => {
          const share =
            total > 0 ? Math.round((row.value / total) * 1000) / 10 : 0;
          const isActive = activeIndex === index;
          return (
            <motion.li
              key={row.name}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(undefined)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[11px] transition-colors",
                isActive ? "bg-brand-50 text-foreground" : "text-muted-foreground"
              )}
              whileHover={{ x: 2 }}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-[1px]"
                style={{
                  backgroundColor: DONUT_PALETTE[index % DONUT_PALETTE.length],
                }}
              />
              <span className="min-w-0 truncate">{row.name}</span>
              <span className="ml-auto tabular-nums font-medium text-foreground">
                {formatNumber(row.value)}
                <span className="ml-1 text-muted-foreground">
                  ({share % 1 === 0 ? share : share.toFixed(1)}%)
                </span>
              </span>
            </motion.li>
          );
        })}
      </ul>
    </motion.div>
  );
}

function DataTable({
  title,
  rows,
  nameHeader,
  delay = 0,
}: {
  title: string;
  rows: ChartDataPoint[];
  nameHeader: string;
  delay?: number;
}) {
  const data = [...rows]
    .map((row) => ({ name: String(row.name), value: Number(row.value) }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = data.reduce((s, r) => s + r.value, 0) || 1;
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <motion.div
      className="rounded-xl border border-[rgba(212,209,200,0.85)] bg-white p-3.5 shadow-card transition-shadow hover:shadow-soft"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: easeOut }}
      whileHover={{ y: -2 }}
    >
      <p className="mb-2 text-[12px] font-semibold text-foreground">{title}</p>
      <div className="max-h-[220px] overflow-auto rounded-lg border border-[rgba(212,209,200,0.75)]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-[1] bg-[#F1F0EC]">
            <tr className="border-b border-[rgba(212,209,200,0.85)]">
              <th className="px-2.5 py-1.5 text-left text-[11px] font-semibold text-brand-900/55">
                {nameHeader}
              </th>
              <th className="px-2.5 py-1.5 text-right text-[11px] font-semibold text-brand-900/55">
                Students
              </th>
              <th className="w-[38%] px-2.5 py-1.5 text-right text-[11px] font-semibold text-brand-900/55">
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => {
              const share = Math.round((row.value / total) * 1000) / 10;
              const isHovered = hovered === row.name;
              return (
                <motion.tr
                  key={row.name}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.28,
                    delay: delay + 0.04 * index,
                    ease: easeOut,
                  }}
                  onMouseEnter={() => setHovered(row.name)}
                  onMouseLeave={() => setHovered(null)}
                  className={cn(
                    "border-b border-[rgba(212,209,200,0.55)] last:border-b-0 transition-colors",
                    isHovered ? "bg-brand-50" : "hover:bg-brand-50/60"
                  )}
                >
                  <td className="px-2.5 py-1.5 text-[12px] font-medium text-foreground">
                    {row.name}
                  </td>
                  <td className="px-2.5 py-1.5 text-right text-[12px] font-semibold tabular-nums text-brand-900">
                    {formatNumber(row.value)}
                  </td>
                  <td className="px-2.5 py-1.5">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-brand-100">
                        <motion.div
                          className="h-full rounded-full bg-brand-700"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(share, 100)}%` }}
                          transition={{
                            duration: 0.55,
                            delay: delay + 0.08 + index * 0.04,
                            ease: easeOut,
                          }}
                        />
                      </div>
                      <span className="w-10 text-right text-[11px] tabular-nums text-muted-foreground">
                        {share % 1 === 0 ? share : share.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function SeminarDetailDialog({
  name,
  total,
  open,
  onOpenChange,
  city: fixedCity,
  showCityToggle = false,
}: {
  name: string;
  total: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  city: OperatingCity;
  showCityToggle?: boolean;
}) {
  const [city, setCity] = useState<OperatingCity>(fixedCity);

  useEffect(() => {
    setCity(fixedCity);
  }, [fixedCity, name, open]);

  const breakdown = useMemo(
    () =>
      showCityToggle
        ? buildSeminarBreakdown(name, Math.max(total, 1))
        : null,
    [showCityToggle, name, total]
  );

  const cityTotal = showCityToggle
    ? (breakdown?.byCity.find((c) => c.city === city)?.total ?? total)
    : total;

  const profile = useMemo(
    () => buildSeminarCityProfile(name, Math.max(cityTotal, 1), city),
    [name, cityTotal, city]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-[calc(100%-1.5rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogHeader className="border-b border-border/50 px-6 py-5 pr-12 text-left">
          <DialogTitle className="text-[18px] leading-snug tracking-tight">
            {name}
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            {showCityToggle
              ? `${formatNumber(total)} students across cities · viewing ${city}`
              : `${formatNumber(total)} students in ${city}`}
            {" · "}
            gender, board, stream, hometown, and class
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto p-5 sm:p-6">
          {showCityToggle ? (
            <div
              role="tablist"
              aria-label="City"
              className="mb-5 inline-flex flex-wrap gap-1 rounded-xl border border-[rgba(212,209,200,0.85)] bg-[#F1F0EC]/80 p-1"
            >
              {CITY_PILL_ORDER.map((c) => {
                const slice = breakdown?.byCity.find((b) => b.city === c);
                const active = city === c;
                return (
                  <motion.button
                    key={c}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setCity(c)}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors",
                      active
                        ? "bg-white text-brand-900 shadow-card"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span
                      className="h-2 w-2 rounded-[2px]"
                      style={{ backgroundColor: CITY_PILL_COLOR[c] }}
                    />
                    {c}
                    <span
                      className={cn(
                        "tabular-nums",
                        active ? "text-brand-700" : "text-muted-foreground"
                      )}
                    >
                      {formatNumber(slice?.total ?? 0)}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          ) : null}

          <AnimatePresence mode="wait">
            <motion.div
              key={city}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: easeOut }}
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <MiniDonut
                  title="Gender"
                  items={profile.byGender}
                  centerLabel="Students"
                  delay={0.05}
                />
                <MiniDonut
                  title="Board"
                  items={profile.byBoard}
                  centerLabel="Boards"
                  delay={0.12}
                />
                <MiniDonut
                  title="Stream"
                  items={profile.byStream}
                  centerLabel="Streams"
                  delay={0.18}
                />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <DataTable
                  title="City of registration"
                  nameHeader="Location"
                  rows={profile.byRegistrantCity}
                  delay={0.22}
                />
                <DataTable
                  title="Class-wise registration"
                  nameHeader="Class"
                  rows={profile.byClass}
                  delay={0.28}
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SeminarProgram({
  items,
  isAllCities = true,
  cityLabel,
}: {
  items: Array<{ name: string; value: number }>;
  isAllCities?: boolean;
  cityLabel?: string;
}) {
  const byName = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(item.name, Number(item.value));
    }
    return map;
  }, [items]);

  const seminars = useMemo(() => {
    return CAREER_UTSAV_SEMINARS.map((name) => ({
      name,
      value: byName.get(name) ?? 0,
    })).sort((a, b) => b.value - a.value);
  }, [byName]);

  const total = seminars.reduce((s, i) => s + i.value, 0) || 1;
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [pressed, setPressed] = useState<string | null>(null);
  const selected = seminars.find((s) => s.name === selectedName) ?? null;
  const open = selectedName !== null;

  const activeCity: OperatingCity =
    cityLabel === "Mysore" || cityLabel === "Hubli" || cityLabel === "Bangalore"
      ? cityLabel
      : "Bangalore";

  return (
    <>
      <motion.div
        className={cn(surface.opening, "overflow-hidden")}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: easeOut }}
      >
        <div className="flex items-baseline justify-between gap-3 border-b border-brand-800/20 bg-brand-700 px-5 py-4 sm:px-6">
          <div>
            <h3 className="text-[15px] font-bold tracking-tight text-white">
              Seminar wise Registration
            </h3>
            <p className="mt-0.5 text-[12px] text-white/70">
              All 20 seminars · tap for{" "}
              {isAllCities ? "city and class breakdown" : "registration mix"}
            </p>
          </div>
          <motion.p
            className="shrink-0 text-[12px] tabular-nums text-white/75"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            {formatNumber(total)} registered
          </motion.p>
        </div>

        <div className="bg-gradient-to-b from-[#F3F6FA] via-[#F7F6F3] to-[#F1F0EC] p-3.5 sm:p-4 lg:p-5">
          <div className="grid auto-rows-[minmax(72px,auto)] grid-cols-2 gap-2.5 sm:grid-cols-6 sm:gap-3 lg:grid-cols-12 lg:gap-3">
            {seminars.map((seminar, index) => {
              const size = seminarCardSize(index);
              const accent = DONUT_PALETTE[index % DONUT_PALETTE.length];
              const featured = index === 0;
              const elevated = index > 0 && index <= 2;
              const isPressed = pressed === seminar.name;

              return (
                <motion.button
                  key={seminar.name}
                  type="button"
                  onClick={() => setSelectedName(seminar.name)}
                  onMouseDown={() => setPressed(seminar.name)}
                  onMouseUp={() => setPressed(null)}
                  onMouseLeave={() => setPressed(null)}
                  initial={{ opacity: 0, y: 14, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    duration: 0.35,
                    delay: Math.min(index * 0.03, 0.45),
                    ease: easeOut,
                  }}
                  whileHover={{
                    y: -4,
                    scale: 1.02,
                    transition: { duration: 0.18 },
                  }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "group relative flex h-full min-h-0 flex-col justify-between overflow-hidden rounded-2xl text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700",
                    size.span,
                    size.pad,
                    featured
                      ? "border border-brand-800/20 text-white shadow-[0_14px_36px_rgba(18,35,63,0.28)]"
                      : elevated
                        ? "border border-brand-700/15 bg-white shadow-[0_10px_28px_rgba(18,35,63,0.12)]"
                        : "border border-[rgba(212,209,200,0.9)] bg-white shadow-card hover:border-brand-700/20 hover:shadow-soft",
                    isPressed && !featured && "bg-brand-50"
                  )}
                  style={
                    featured
                      ? { background: DASH_COLORS.gradient }
                      : elevated
                        ? {
                            background: `linear-gradient(160deg, ${BRAND[50]} 0%, #ffffff 58%)`,
                          }
                        : undefined
                  }
                >
                  {!featured ? (
                    <span
                      className="absolute inset-y-0 left-0 w-[3px]"
                      style={{ backgroundColor: accent }}
                      aria-hidden
                    />
                  ) : null}

                  {!featured ? (
                    <span
                      className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-[0.12] blur-2xl transition-opacity duration-300 group-hover:opacity-22"
                      style={{ backgroundColor: accent }}
                      aria-hidden
                    />
                  ) : (
                    <span
                      className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl"
                      aria-hidden
                    />
                  )}

                  <p
                    className={cn(
                      "relative font-semibold leading-snug tracking-tight",
                      size.title,
                      size.lines,
                      featured ? "text-white" : "text-foreground"
                    )}
                  >
                    {seminar.name}
                  </p>

                  <div className="relative mt-auto pt-3">
                    <motion.p
                      className={cn(
                        "font-semibold leading-none tabular-nums tracking-tight",
                        size.value,
                        featured ? "text-white" : "text-brand-950"
                      )}
                      layout
                    >
                      {formatNumber(seminar.value)}
                    </motion.p>
                    <p
                      className={cn(
                        "mt-2 text-[12px] font-medium tracking-tight opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100",
                        featured
                          ? "translate-y-1 text-white/80"
                          : "translate-y-1 text-brand-700"
                      )}
                    >
                      Click for more stats
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {selected ? (
        <SeminarDetailDialog
          name={selected.name}
          total={selected.value}
          city={activeCity}
          showCityToggle={isAllCities}
          open={open}
          onOpenChange={(next) => {
            if (!next) setSelectedName(null);
          }}
        />
      ) : null}
    </>
  );
}

function seminarCardSize(index: number): {
  span: string;
  pad: string;
  title: string;
  value: string;
  lines: string;
} {
  if (index === 0) {
    return {
      span: "col-span-2 row-span-2 sm:col-span-6 lg:col-span-6 min-h-[128px] sm:min-h-[148px]",
      pad: "p-3.5 sm:p-4",
      title: "text-[15px] sm:text-[17px]",
      value: "text-[42px] sm:text-[52px]",
      lines: "line-clamp-2",
    };
  }
  if (index <= 2) {
    return {
      span: "col-span-1 row-span-2 sm:col-span-3 lg:col-span-3 min-h-[128px] sm:min-h-[148px]",
      pad: "p-3 sm:p-3.5",
      title: "text-[13px] sm:text-[15px]",
      value: "text-[34px] sm:text-[40px]",
      lines: "line-clamp-2",
    };
  }
  if (index <= 5) {
    return {
      span: "col-span-1 sm:col-span-2 lg:col-span-4 min-h-[88px]",
      pad: "p-3",
      title: "text-[13px]",
      value: "text-[28px]",
      lines: "line-clamp-2",
    };
  }
  if (index <= 13) {
    return {
      span: "col-span-1 sm:col-span-2 lg:col-span-3 min-h-[84px]",
      pad: "p-2.5 sm:p-3",
      title: "text-[12px] sm:text-[13px]",
      value: "text-[26px]",
      lines: "line-clamp-2",
    };
  }
  return {
    span: "col-span-1 sm:col-span-2 lg:col-span-2 min-h-[80px]",
    pad: "p-2.5",
    title: "text-[12px]",
    value: "text-[24px]",
    lines: "line-clamp-2",
  };
}
