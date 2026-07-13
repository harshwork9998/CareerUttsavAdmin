"use client";

import { useMemo, useState } from "react";
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

function ConsolidatedSeminarDialog({
  name,
  total,
  open,
  onOpenChange,
}: {
  name: string;
  total: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [city, setCity] = useState<OperatingCity>("Bangalore");
  const [activeIndex, setActiveIndex] = useState<number | undefined>();
  const breakdown = useMemo(
    () => buildSeminarBreakdown(name, Math.max(total, 1)),
    [name, total]
  );
  const citySlice = breakdown.byCity.find((c) => c.city === city);
  const cityProfile = useMemo(
    () =>
      buildSeminarCityProfile(
        name,
        Math.max(citySlice?.total ?? 1, 1),
        city
      ),
    [name, city, citySlice?.total]
  );
  const donutData =
    citySlice?.byClass
      .filter((c) => Number(c.value) > 0)
      .map((c) => ({ name: String(c.name), value: Number(c.value) })) ?? [];
  const maxCity = Math.max(...breakdown.byCity.map((c) => c.total), 1);
  const activeSlice = activeIndex != null ? donutData[activeIndex] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-[calc(100%-1.5rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogHeader className="border-b border-border/50 px-6 py-5 pr-12 text-left">
          <DialogTitle className="text-[18px] leading-snug tracking-tight">
            {name}
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            {formatNumber(total)} students registered · city split plus gender,
            board, stream, and class for the selected city
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto p-5 sm:p-6">
          <div className="grid gap-6 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:gap-8">
            <div>
              <p className="mb-3 text-[12px] font-medium text-muted-foreground">
                City
              </p>
              <div className="flex flex-col gap-2">
                {CITY_PILL_ORDER.map((c, index) => {
                  const slice = breakdown.byCity.find((b) => b.city === c);
                  const active = city === c;
                  const cityShare = Math.round(
                    ((slice?.total ?? 0) / maxCity) * 100
                  );
                  return (
                    <motion.button
                      key={c}
                      type="button"
                      onClick={() => {
                        setCity(c);
                        setActiveIndex(undefined);
                      }}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: 0.3,
                        delay: 0.05 * index,
                        ease: easeOut,
                      }}
                      whileHover={{ scale: 1.015, x: 2 }}
                      whileTap={{ scale: 0.985 }}
                      className={cn(
                        "relative overflow-hidden rounded-xl px-3.5 py-3 text-left transition-colors",
                        active
                          ? "bg-primary text-primary-foreground shadow-soft"
                          : "bg-muted/50 text-foreground hover:bg-muted"
                      )}
                    >
                      {!active ? (
                        <motion.span
                          className="absolute inset-y-0 left-0 bg-brand-100/80"
                          initial={false}
                          animate={{ width: `${cityShare}%` }}
                          transition={{ duration: 0.45, ease: easeOut }}
                          aria-hidden
                        />
                      ) : null}
                      <span className="relative flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2.5 text-[13px] font-semibold">
                          <span
                            className="h-2 w-2 rounded-[2px]"
                            style={{
                              backgroundColor: active
                                ? "rgba(255,255,255,0.85)"
                                : CITY_PILL_COLOR[c],
                            }}
                          />
                          {c}
                        </span>
                        <span
                          className={cn(
                            "text-[13px] font-semibold tabular-nums",
                            active
                              ? "text-primary-foreground"
                              : "text-foreground"
                          )}
                        >
                          {formatNumber(slice?.total ?? 0)}
                        </span>
                      </span>
                    </motion.button>
                  );
                })}
              </div>
              <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
                Details below update for{" "}
                <span className="font-medium text-foreground">{city}</span>
              </p>
            </div>

            <div className="flex min-h-[240px] flex-col">
              <p className="mb-2 text-[12px] font-medium text-muted-foreground">
                Registered by class
              </p>
              <AnimatePresence mode="wait">
                <motion.div
                  key={city}
                  className="relative min-h-[200px] flex-1"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.28, ease: easeOut }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius="58%"
                        outerRadius="82%"
                        paddingAngle={2}
                        strokeWidth={0}
                        isAnimationActive
                        animationBegin={0}
                        animationDuration={750}
                        animationEasing="ease-out"
                        onMouseEnter={(_, index) => setActiveIndex(index)}
                        onMouseLeave={() => setActiveIndex(undefined)}
                      >
                        {donutData.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={DONUT_PALETTE[index % DONUT_PALETTE.length]}
                            className="cursor-pointer outline-none"
                            opacity={
                              activeIndex == null || activeIndex === index
                                ? 1
                                : 0.35
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
                        key={activeSlice?.name ?? city}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18 }}
                        className="flex flex-col items-center"
                      >
                        <p className="text-[11px] text-muted-foreground">
                          {activeSlice?.name ?? city}
                        </p>
                        <p className="text-[22px] font-semibold tabular-nums tracking-tight">
                          {formatNumber(
                            activeSlice?.value ?? citySlice?.total ?? 0
                          )}
                        </p>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </motion.div>
              </AnimatePresence>
              <ul className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1">
                {donutData.slice(0, 9).map((row, index) => (
                  <motion.li
                    key={row.name}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(undefined)}
                    whileHover={{ scale: 1.03 }}
                    className={cn(
                      "flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 text-[10px] transition-colors",
                      activeIndex === index
                        ? "bg-brand-50 text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-[1px]"
                      style={{
                        backgroundColor:
                          DONUT_PALETTE[index % DONUT_PALETTE.length],
                      }}
                    />
                    <span className="truncate">
                      {row.name.replace("Class ", "C")}
                    </span>
                    <span className="ml-auto tabular-nums font-medium text-foreground">
                      {formatNumber(row.value)}
                    </span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={`mix-${city}`}
              className="mt-5 grid gap-4 sm:grid-cols-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: easeOut }}
            >
              <MiniDonut
                title="Gender"
                items={cityProfile.byGender}
                centerLabel="Students"
                delay={0.04}
              />
              <MiniDonut
                title="Board"
                items={cityProfile.byBoard}
                centerLabel="Boards"
                delay={0.1}
              />
              <MiniDonut
                title="Stream"
                items={cityProfile.byStream}
                centerLabel="Streams"
                delay={0.16}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CitySeminarDialog({
  name,
  total,
  city,
  open,
  onOpenChange,
}: {
  name: string;
  total: number;
  city: OperatingCity;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const profile = useMemo(
    () => buildSeminarCityProfile(name, Math.max(total, 1), city),
    [name, total, city]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-[calc(100%-1.5rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogHeader className="border-b border-border/50 px-6 py-5 pr-12 text-left">
          <DialogTitle className="text-[18px] leading-snug tracking-tight">
            {name}
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            {formatNumber(total)} students in {city} · hover charts and rows to
            explore the mix
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto p-5 sm:p-6">
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

        <div className="grid auto-rows-[minmax(68px,auto)] grid-cols-2 gap-2.5 p-3.5 sm:grid-cols-6 sm:gap-3 sm:p-4 lg:grid-cols-12 lg:gap-3 lg:p-4">
          {seminars.map((seminar, index) => {
            const size = seminarCardSize(index);
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
                  y: -3,
                  scale: 1.015,
                  transition: { duration: 0.18 },
                }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "group relative flex h-full min-h-0 flex-col justify-between overflow-hidden rounded-xl border border-brand-900/12 bg-white text-left shadow-[0_4px_14px_rgba(18,35,63,0.07)] transition-colors duration-150 hover:border-brand-700/25 hover:bg-brand-50/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700",
                  size.span,
                  size.pad,
                  isPressed && "bg-brand-50"
                )}
              >
                <motion.span
                  className="pointer-events-none absolute inset-x-0 top-0 h-0.5 origin-left bg-brand-700"
                  initial={{ scaleX: 0 }}
                  whileHover={{ scaleX: 1 }}
                  transition={{ duration: 0.28, ease: easeOut }}
                />
                <p
                  className={cn(
                    "font-semibold leading-snug tracking-tight text-foreground",
                    size.title,
                    size.lines
                  )}
                >
                  {seminar.name}
                </p>
                <motion.p
                  className={cn(
                    "mt-1 font-semibold leading-none tabular-nums tracking-tight text-brand-950",
                    size.value
                  )}
                  layout
                >
                  {formatNumber(seminar.value)}
                </motion.p>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {selected && isAllCities ? (
        <ConsolidatedSeminarDialog
          name={selected.name}
          total={selected.value}
          open={open}
          onOpenChange={(next) => {
            if (!next) setSelectedName(null);
          }}
        />
      ) : null}

      {selected && !isAllCities ? (
        <CitySeminarDialog
          name={selected.name}
          total={selected.value}
          city={activeCity}
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
      span: "col-span-2 row-span-2 sm:col-span-6 lg:col-span-6 min-h-[110px] sm:min-h-[124px]",
      pad: "p-3 sm:p-3.5",
      title: "text-[15px] sm:text-[17px]",
      value: "text-[40px] sm:text-[48px]",
      lines: "line-clamp-2",
    };
  }
  if (index <= 2) {
    return {
      span: "col-span-1 row-span-2 sm:col-span-3 lg:col-span-3 min-h-[110px] sm:min-h-[124px]",
      pad: "p-2.5 sm:p-3",
      title: "text-[13px] sm:text-[14px]",
      value: "text-[32px] sm:text-[38px]",
      lines: "line-clamp-2",
    };
  }
  if (index <= 5) {
    return {
      span: "col-span-1 sm:col-span-2 lg:col-span-4 min-h-[76px]",
      pad: "p-2.5",
      title: "text-[13px]",
      value: "text-[26px]",
      lines: "line-clamp-2",
    };
  }
  if (index <= 13) {
    return {
      span: "col-span-1 sm:col-span-2 lg:col-span-3 min-h-[72px]",
      pad: "p-2 sm:p-2.5",
      title: "text-[12px] sm:text-[13px]",
      value: "text-[24px]",
      lines: "line-clamp-2",
    };
  }
  return {
    span: "col-span-1 sm:col-span-2 lg:col-span-2 min-h-[68px]",
    pad: "p-2",
    title: "text-[12px]",
    value: "text-[22px]",
    lines: "line-clamp-2",
  };
}
