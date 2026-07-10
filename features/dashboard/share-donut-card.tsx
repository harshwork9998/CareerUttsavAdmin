"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
} from "recharts";

import { cn, formatNumber } from "@/lib/utils";
import { DONUT_COLORS, surface } from "@/features/dashboard/dashboard-ui";

const DONUT_PALETTE = [...DONUT_COLORS];

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

function renderActiveShape(props: {
  cx?: number;
  cy?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  fill?: string;
}) {
  const {
    cx = 0,
    cy = 0,
    innerRadius = 0,
    outerRadius = 0,
    startAngle = 0,
    endAngle = 0,
    fill = "#059669",
  } = props;

  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 6}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      stroke="none"
    />
  );
}

export function ShareDonutCard({
  title,
  items,
  className,
  delay = 0,
}: {
  title: string;
  items: Array<{ name: string; value: number }>;
  className?: string;
  delay?: number;
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
  const chartKey = data.map((d) => `${d.name}:${d.value}`).join("|");

  return (
    <motion.div
      className={cn(surface.opening, "flex flex-col p-5 sm:p-6", className)}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div className="mb-2">
        <h3 className="text-[15px] font-bold tracking-tight text-foreground">
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
              key={chartKey}
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="88%"
              paddingAngle={2}
              strokeWidth={0}
              isAnimationActive
              animationBegin={Math.round(delay * 1000)}
              animationDuration={1100}
              animationEasing="ease-out"
              activeShape={renderActiveShape}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={DONUT_PALETTE[index % DONUT_PALETTE.length]}
                  className="cursor-pointer outline-none"
                />
              ))}
            </Pie>
            <Tooltip
              content={<DonutTooltip />}
              wrapperStyle={{ zIndex: 20, outline: "none" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <motion.div
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: 0.4,
            delay: delay + 0.35,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <p className="text-[11px] text-muted-foreground">Total</p>
          <p className="text-[24px] font-semibold tabular-nums tracking-tight">
            {formatNumber(total)}
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
