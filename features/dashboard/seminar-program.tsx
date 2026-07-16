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

import { Mail } from "lucide-react";

import { cn, formatNumber } from "@/lib/utils";
import type { ChartDataPoint, EventSeminar, OperatingCity } from "@/types";
import {
  CITY_COLORS,
  CHART_SERIES,
  BRAND,
  DASH_COLORS,
  surface,
} from "@/features/dashboard/dashboard-ui";
import { CAREER_UTSAV_SEMINARS } from "@/features/dashboard/seminars";
import { SeminarBroadcastDialog } from "@/features/messaging/seminar-broadcast-dialog";
import {
  buildSeminarBreakdown,
  buildSeminarCityProfile,
} from "@/lib/mock-data/seminar-breakdown";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  compact = false,
}: {
  title: string;
  items: ChartDataPoint[];
  centerLabel?: string;
  delay?: number;
  compact?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>();
  const data = items
    .map((item) => ({ name: String(item.name), value: Number(item.value) }))
    .filter((row) => row.value > 0);
  const total = data.reduce((s, r) => s + r.value, 0);
  const active = activeIndex != null ? data[activeIndex] : null;

  return (
    <motion.div
      className={cn(
        "rounded-lg border border-[rgba(212,209,200,0.85)] bg-white shadow-card",
        compact ? "p-2.5" : "flex min-h-[320px] flex-col p-3.5"
      )}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: easeOut }}
    >
      <p
        className={cn(
          "shrink-0 font-semibold text-foreground",
          compact ? "mb-2 text-[11px]" : "mb-2 text-[12px]"
        )}
      >
        {title}
      </p>
      <div
        className={cn(
          compact
            ? "flex items-start gap-2.5"
            : "flex flex-col"
        )}
      >
        <div
          className={cn(
            "relative shrink-0",
            compact ? "h-[88px] w-[88px]" : "mx-auto h-[160px] w-full max-w-[200px]"
          )}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={compact ? "52%" : "58%"}
                outerRadius={compact ? "88%" : "82%"}
                paddingAngle={2}
                strokeWidth={0}
                isAnimationActive
                animationDuration={650}
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
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col items-center text-center"
              >
                {!compact ? (
                  <p className="text-[10px] text-muted-foreground">
                    {active?.name ?? centerLabel ?? "Total"}
                  </p>
                ) : null}
                <p
                  className={cn(
                    "font-semibold tabular-nums tracking-tight",
                    compact ? "text-[13px]" : "text-[18px]"
                  )}
                >
                  {formatNumber(active?.value ?? total)}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        <ul
          className={cn(
            "min-w-0 space-y-0",
            compact ? "flex-1" : "mt-auto min-h-0 flex-1 overflow-auto pt-2"
          )}
        >
          {data.map((row, index) => {
            const isActive = activeIndex === index;
            return (
              <li
                key={row.name}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(undefined)}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 transition-colors",
                  compact ? "text-[10px]" : "text-[11px]",
                  isActive ? "bg-brand-50 text-foreground" : "text-muted-foreground"
                )}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-[1px]"
                  style={{
                    backgroundColor: DONUT_PALETTE[index % DONUT_PALETTE.length],
                  }}
                />
                <span className="min-w-0 truncate">{row.name}</span>
                <span className="ml-auto shrink-0 tabular-nums font-medium text-foreground">
                  {formatNumber(row.value)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </motion.div>
  );
}

function DataTable({
  title,
  rows,
  nameHeader,
  delay = 0,
  compact = false,
  fillHeight = false,
}: {
  title: string;
  rows: ChartDataPoint[];
  nameHeader: string;
  delay?: number;
  compact?: boolean;
  fillHeight?: boolean;
}) {
  const data = [...rows]
    .map((row) => ({ name: String(row.name), value: Number(row.value) }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <motion.div
      className={cn(
        "w-full rounded-lg border border-[rgba(212,209,200,0.85)] bg-white shadow-card",
        compact ? "flex h-full min-h-0 flex-col p-2.5" : "flex min-h-[320px] flex-col p-3.5",
      )}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: easeOut }}
    >
      <p
        className={cn(
          "shrink-0 font-semibold text-foreground",
          compact ? "mb-2 text-[11px]" : "mb-2 text-[12px]"
        )}
      >
        {title}
      </p>
      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-[rgba(212,209,200,0.75)]">
        <table className={cn("w-full text-sm", compact && "table-fixed")}>
          <colgroup>
            {compact ? (
              <>
                <col />
                <col className="w-[56px]" />
              </>
            ) : null}
          </colgroup>
          <thead className="sticky top-0 z-[1] bg-[#F1F0EC]">
            <tr className="border-b border-[rgba(212,209,200,0.85)]">
              <th
                className={cn(
                  "text-left font-semibold text-brand-900/55",
                  compact ? "px-1.5 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px]"
                )}
              >
                {nameHeader}
              </th>
              <th
                className={cn(
                  "text-right font-semibold text-brand-900/55",
                  compact ? "px-1.5 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px]"
                )}
              >
                Students
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const isHovered = hovered === row.name;
              return (
                <tr
                  key={row.name}
                  onMouseEnter={() => setHovered(row.name)}
                  onMouseLeave={() => setHovered(null)}
                  className={cn(
                    "border-b border-[rgba(212,209,200,0.55)] last:border-b-0 transition-colors",
                    isHovered ? "bg-brand-50" : "hover:bg-brand-50/60"
                  )}
                >
                  <td
                    className={cn(
                      "font-medium text-foreground",
                      compact ? "px-1.5 py-0.5 text-[11px]" : "px-2.5 py-1.5 text-[12px]"
                    )}
                  >
                    {row.name}
                  </td>
                  <td
                    className={cn(
                      "text-right font-semibold tabular-nums text-brand-900",
                      compact ? "px-1.5 py-0.5 text-[11px]" : "px-2.5 py-1.5 text-[12px]"
                    )}
                  >
                    {formatNumber(row.value)}
                  </td>
                </tr>
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
  eventId,
  eventTitle,
  eventSeminars,
  eventSeminarTitles,
}: {
  name: string;
  total: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  city: OperatingCity;
  showCityToggle?: boolean;
  eventId?: string;
  eventTitle?: string;
  eventSeminars?: EventSeminar[];
  eventSeminarTitles?: readonly string[];
}) {
  const [city, setCity] = useState<OperatingCity>(fixedCity);
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  const canMessage = Boolean(eventId && eventTitle && eventSeminarTitles?.length);
  const seminarSlot = eventSeminars?.find((s) => s.title === name);

  useEffect(() => {
    setCity(fixedCity);
  }, [fixedCity, name, open]);

  useEffect(() => {
    if (!open) setBroadcastOpen(false);
  }, [open]);

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
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-1.5rem)] max-w-[520px] flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="border-b border-border/50 px-4 py-3.5 pr-11 text-left">
          <DialogTitle className="text-[16px] leading-snug tracking-tight">
            {name}
          </DialogTitle>
          <DialogDescription className="text-[12px] leading-snug">
            {showCityToggle
              ? `${formatNumber(total)} students across cities · viewing ${city}`
              : `${formatNumber(total)} students in ${city}`}
            {" · "}
            gender, board, stream, and class
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {showCityToggle ? (
            <div
              role="tablist"
              aria-label="City"
              className="mb-3 inline-flex flex-wrap gap-1 rounded-lg border border-[rgba(212,209,200,0.85)] bg-[#F1F0EC]/80 p-0.5"
            >
              {CITY_PILL_ORDER.map((c) => {
                const slice = breakdown?.byCity.find((b) => b.city === c);
                const active = city === c;
                return (
                  <button
                    key={c}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setCity(c)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
                      active
                        ? "bg-white text-brand-900 shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-[2px]"
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
                  </button>
                );
              })}
            </div>
          ) : null}

          <AnimatePresence mode="wait">
            <motion.div
              key={city}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: easeOut }}
              className="grid w-full items-stretch gap-3 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)]"
            >
              <div className="flex flex-col gap-2.5">
                <MiniDonut
                  title="Gender"
                  items={profile.byGender}
                  centerLabel="Students"
                  delay={0.04}
                  compact
                />
                <MiniDonut
                  title="Board"
                  items={profile.byBoard}
                  centerLabel="Boards"
                  delay={0.08}
                  compact
                />
                <MiniDonut
                  title="Stream"
                  items={profile.byStream}
                  centerLabel="Streams"
                  delay={0.12}
                  compact
                />
              </div>
              <DataTable
                title="Class-wise registration"
                nameHeader="Class"
                rows={profile.byClass}
                delay={0.16}
                compact
                fillHeight
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {canMessage ? (
          <DialogFooter className="border-t border-border/50 px-4 py-3 sm:justify-start">
            <Button
              type="button"
              variant="outline"
              className="gap-1.5 text-[13px]"
              onClick={() => setBroadcastOpen(true)}
            >
              <Mail className="size-3.5" />
              Email / WhatsApp registrants
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>

      {canMessage && eventId && eventTitle && eventSeminarTitles ? (
        <SeminarBroadcastDialog
          open={broadcastOpen}
          onOpenChange={setBroadcastOpen}
          eventId={eventId}
          eventTitle={eventTitle}
          seminarTitle={name}
          seminarSlot={seminarSlot}
          eventSeminarTitles={eventSeminarTitles}
        />
      ) : null}
    </Dialog>
  );
}

export function SeminarProgram({
  items,
  isAllCities = true,
  cityLabel,
  seminarTitles,
  subtitle,
  uniformCards: uniformCardsProp,
  eventId,
  eventTitle,
  eventSeminars,
}: {
  items: Array<{ name: string; value: number }>;
  isAllCities?: boolean;
  cityLabel?: string;
  /** When set, only these seminar titles are shown (e.g. event schedule). */
  seminarTitles?: readonly string[];
  subtitle?: string;
  /** Equal-size cards instead of the featured mosaic layout. */
  uniformCards?: boolean;
  eventId?: string;
  eventTitle?: string;
  eventSeminars?: EventSeminar[];
}) {
  const uniformCards = uniformCardsProp ?? Boolean(seminarTitles);
  const catalog = useMemo(
    () => seminarTitles ?? CAREER_UTSAV_SEMINARS,
    [seminarTitles]
  );
  const catalogLabel =
    subtitle ??
    (catalog.length === CAREER_UTSAV_SEMINARS.length
      ? "All 20 seminars · tap for registration breakdown"
      : `${catalog.length} seminar${catalog.length === 1 ? "" : "s"} · tap for registration breakdown`);
  const byName = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(item.name, Number(item.value));
    }
    return map;
  }, [items]);

  const seminars = useMemo(() => {
    return catalog.map((name) => ({
      name,
      value: byName.get(name) ?? 0,
    })).sort((a, b) => b.value - a.value);
  }, [byName, catalog]);

  const total = seminars.reduce((s, i) => s + i.value, 0) || 1;
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [pressed, setPressed] = useState<string | null>(null);
  const selected = seminars.find((s) => s.name === selectedName) ?? null;
  const open = selectedName !== null;

  const activeCity: OperatingCity =
    cityLabel === "Mysore" || cityLabel === "Hubli" || cityLabel === "Bangalore"
      ? cityLabel
      : "Bangalore";

  const eventSeminarTitles = useMemo(
    () =>
      eventSeminars?.map((s) => s.title) ??
      (seminarTitles ? [...seminarTitles] : []),
    [eventSeminars, seminarTitles]
  );

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
            <p className="mt-0.5 text-[12px] text-white/70">{catalogLabel}</p>
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
          <div
            className={cn(
              uniformCards
                ? "grid auto-rows-fr grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4"
                : "grid auto-rows-[minmax(72px,auto)] grid-cols-2 gap-2.5 sm:grid-cols-6 sm:gap-3 lg:grid-cols-12 lg:gap-3"
            )}
          >
            {seminars.map((seminar, index) => {
              const size = uniformCards
                ? uniformCardSize()
                : seminarCardSize(index);
              const accent = DONUT_PALETTE[index % DONUT_PALETTE.length];
              const featured = !uniformCards && index === 0;
              const elevated = !uniformCards && index > 0 && index <= 2;
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
          eventId={eventId}
          eventTitle={eventTitle}
          eventSeminars={eventSeminars}
          eventSeminarTitles={eventSeminarTitles}
          onOpenChange={(next) => {
            if (!next) setSelectedName(null);
          }}
        />
      ) : null}
    </>
  );
}

function uniformCardSize(): {
  span: string;
  pad: string;
  title: string;
  value: string;
  lines: string;
} {
  return {
    span: "col-span-1 min-h-[124px]",
    pad: "p-3 sm:p-3.5",
    title: "text-[13px] sm:text-[14px]",
    value: "text-[28px] sm:text-[32px]",
    lines: "line-clamp-3",
  };
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
