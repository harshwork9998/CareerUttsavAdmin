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
  const [activeIndex, setActiveIndex] = useState<number | undefined>();
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
  const active = activeIndex != null ? data[activeIndex] : null;
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
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
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

      <div className="relative mx-auto aspect-square min-h-[240px] w-full max-w-[280px] flex-1">
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
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(undefined)}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={DONUT_PALETTE[index % DONUT_PALETTE.length]}
                  className="cursor-pointer outline-none"
                  opacity={
                    activeIndex == null || activeIndex === index ? 1 : 0.38
                  }
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
          <AnimatePresence mode="wait">
            <motion.div
              key={active?.name ?? "total"}
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center"
            >
              <p className="text-[11px] text-muted-foreground">
                {active?.name ?? "Total"}
              </p>
              <p className="text-[24px] font-semibold tabular-nums tracking-tight">
                {formatNumber(active?.value ?? total)}
              </p>
              {active ? (
                <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                  {Math.round((active.value / total) * 100)}%
                </p>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
