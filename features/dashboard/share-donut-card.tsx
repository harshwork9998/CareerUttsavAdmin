"use client";

import { useMemo } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { cn, formatNumber } from "@/lib/utils";
import { surface } from "@/features/dashboard/dashboard-ui";

const DONUT_PALETTE = [
  "#1F3864",
  "#0E7C7B",
  "#3D5478",
  "#6B7C93",
  "#254a7a",
  "#94A3B8",
  "#475569",
  "#14948f",
  "#64748B",
];

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
  }>;
}) {
  if (!active || !payload?.[0]) return null;
  const row = payload[0];
  const value = Number(row.value);
  return (
    <div className="rounded-xl border border-border/60 bg-card px-3 py-2 shadow-soft">
      <p className="text-[13px] font-semibold tracking-tight text-foreground">
        {row.name}
      </p>
      <p className="mt-0.5 text-[12px] tabular-nums text-muted-foreground">
        <span className="font-semibold text-foreground">
          {formatNumber(value)}
        </span>{" "}
        students
      </p>
    </div>
  );
}

export function ShareDonutCard({
  title,
  items,
  className,
}: {
  title: string;
  items: Array<{ name: string; value: number }>;
  className?: string;
}) {
  const data = useMemo(
    () =>
      items
        .map((item) => ({
          name: item.name,
          value: Number(item.value),
        }))
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value),
    [items]
  );

  const total = data.reduce((s, i) => s + i.value, 0) || 1;
  const lead = data[0];

  return (
    <div
      className={cn(
        surface.opening,
        "flex flex-col p-5 sm:p-6",
        className
      )}
    >
      <div className="mb-2">
        <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        {lead && (
          <p className="mt-1 text-[12px] text-muted-foreground">
            Leading ·{" "}
            <span className="font-medium text-foreground">{lead.name}</span>
          </p>
        )}
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[280px] flex-1 min-h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="88%"
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={DONUT_PALETTE[index % DONUT_PALETTE.length]}
                  className="cursor-pointer outline-none transition-opacity hover:opacity-90"
                />
              ))}
            </Pie>
            <Tooltip
              content={<DonutTooltip />}
              wrapperStyle={{ zIndex: 20, outline: "none" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[11px] text-muted-foreground">Total</p>
          <p className="text-[24px] font-semibold tabular-nums tracking-tight">
            {formatNumber(total)}
          </p>
        </div>
      </div>
    </div>
  );
}
