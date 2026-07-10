"use client";

import { useMemo, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { cn, formatNumber } from "@/lib/utils";
import type { OperatingCity } from "@/types";
import { surface } from "@/features/dashboard/dashboard-ui";
import {
  CAREER_UTSAV_SEMINARS,
} from "@/features/dashboard/seminars";
import { buildSeminarBreakdown } from "@/lib/mock-data/seminar-breakdown";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CITY_PILL_ORDER: OperatingCity[] = ["Bangalore", "Mysore", "Hubli"];

const CITY_PILL_COLOR: Record<OperatingCity, string> = {
  Bangalore: "#064E3B",
  Mysore: "#047857",
  Hubli: "#059669",
};

const CLASS_DONUT_COLORS = [
  "#059669",
  "#2563EB",
  "#E11D48",
  "#EAB308",
  "#8B5CF6",
  "#F97316",
  "#06B6D4",
  "#EC4899",
  "#64748B",
];

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

export function SeminarProgram({
  items,
}: {
  items: Array<{ name: string; value: number }>;
}) {
  const byName = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(item.name, Number(item.value));
    }
    return map;
  }, [items]);

  /** Always show all 20 catalogue seminars, sorted by registrations. */
  const seminars = useMemo(() => {
    return CAREER_UTSAV_SEMINARS.map((name) => ({
      name,
      value: byName.get(name) ?? 0,
    })).sort((a, b) => b.value - a.value);
  }, [byName]);

  const total = seminars.reduce((s, i) => s + i.value, 0) || 1;

  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [city, setCity] = useState<OperatingCity>("Bangalore");

  const selected = seminars.find((s) => s.name === selectedName) ?? null;
  const breakdown = useMemo(
    () =>
      selected
        ? buildSeminarBreakdown(selected.name, Math.max(selected.value, 1))
        : null,
    [selected]
  );

  const citySlice = breakdown?.byCity.find((c) => c.city === city);
  const donutData =
    citySlice?.byClass
      .filter((c) => Number(c.value) > 0)
      .map((c) => ({ name: String(c.name), value: Number(c.value) })) ?? [];

  const open = selectedName !== null;

  return (
    <>
      <div className={cn(surface.opening, "overflow-hidden")}>
        <div className="flex items-baseline justify-between gap-3 border-b border-emerald-800/20 bg-emerald-700 px-5 py-4 sm:px-6">
          <div>
            <h3 className="text-[15px] font-bold tracking-tight text-white">
              Seminar wise Registration
            </h3>
            <p className="mt-0.5 text-[12px] text-white/70">
              All 20 seminars · tap for city and class breakdown
            </p>
          </div>
          <p className="shrink-0 text-[12px] tabular-nums text-white/75">
            {formatNumber(total)} registered
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:gap-3.5 sm:p-5 lg:grid-cols-4 xl:grid-cols-5">
          {seminars.map((seminar, index) => {
            return (
              <button
                key={seminar.name}
                type="button"
                onClick={() => {
                  setSelectedName(seminar.name);
                  setCity("Bangalore");
                }}
                className="group flex min-h-[108px] flex-col justify-between rounded-2xl border border-emerald-900/12 bg-white p-4 text-left shadow-[0_6px_20px_rgba(5,150,105,0.08)] transition-colors duration-150 hover:bg-emerald-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
              >
                <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="line-clamp-3 text-[13px] font-semibold leading-snug tracking-tight text-foreground">
                    {seminar.name}
                  </p>
                  <p className="mt-2.5 text-[20px] font-semibold tabular-nums tracking-tight text-emerald-950">
                    {formatNumber(seminar.value)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setSelectedName(null);
        }}
      >
        <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="border-b border-border/50 px-6 py-5 pr-12 text-left">
            <DialogTitle className="text-[18px] leading-snug tracking-tight">
              {selected?.name}
            </DialogTitle>
            <DialogDescription className="text-[13px]">
              {selected
                ? `${formatNumber(selected.value)} students registered · city and class view`
                : null}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 p-6 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:gap-8">
            <div>
              <p className="mb-3 text-[12px] font-medium text-muted-foreground">
                City
              </p>
              <div className="flex flex-col gap-2">
                {CITY_PILL_ORDER.map((c) => {
                  const slice = breakdown?.byCity.find((b) => b.city === c);
                  const active = city === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCity(c)}
                      className={cn(
                        "flex items-center justify-between rounded-xl px-3.5 py-3 text-left transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/50 text-foreground hover:bg-muted"
                      )}
                    >
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
                          active ? "text-primary-foreground" : "text-foreground"
                        )}
                      >
                        {formatNumber(slice?.total ?? 0)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
                Class mix for{" "}
                <span className="font-medium text-foreground">{city}</span>
              </p>
            </div>

            <div className="flex min-h-[240px] flex-col">
              <p className="mb-2 text-[12px] font-medium text-muted-foreground">
                Registered by class
              </p>
              <div className="relative min-h-[200px] flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      key={`${city}-${donutData.map((d) => `${d.name}:${d.value}`).join("|")}`}
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
                      animationDuration={900}
                      animationEasing="ease-out"
                    >
                      {donutData.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={
                            CLASS_DONUT_COLORS[index % CLASS_DONUT_COLORS.length]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<DonutTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-[11px] text-muted-foreground">{city}</p>
                  <p className="text-[22px] font-semibold tabular-nums tracking-tight">
                    {formatNumber(citySlice?.total ?? 0)}
                  </p>
                </div>
              </div>
              <ul className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1">
                {donutData.slice(0, 9).map((row, index) => (
                  <li
                    key={row.name}
                    className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-[1px]"
                      style={{
                        backgroundColor:
                          CLASS_DONUT_COLORS[index % CLASS_DONUT_COLORS.length],
                      }}
                    />
                    <span className="truncate">
                      {row.name.replace("Class ", "C")}
                    </span>
                    <span className="ml-auto tabular-nums font-medium text-foreground">
                      {formatNumber(row.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
