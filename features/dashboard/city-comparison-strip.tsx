"use client";

import { formatNumber } from "@/lib/utils";
import type { CityComparisonMetric } from "@/types";

export function CityComparisonInline({
  metrics,
}: {
  cityLabel: string;
  metrics: CityComparisonMetric[];
}) {
  if (metrics.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border/50 pt-3">
      {metrics.map((metric) => {
        const delta = metric.deltaPercent;
        const relation =
          delta > 0 ? "above" : delta < 0 ? "below" : "at avg";

        return (
          <div
            key={metric.id}
            className="flex items-baseline gap-1 text-[11px]"
          >
            <span className="text-muted-foreground">{metric.label}</span>
            <span className="font-semibold tabular-nums text-foreground">
              {formatNumber(metric.cityValue)}
            </span>
            <span className="tabular-nums text-muted-foreground/80">
              {delta === 0 ? relation : `${Math.abs(delta)}% ${relation}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
