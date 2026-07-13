"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

import { cn, formatNumber } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export interface KpiCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    label?: string;
  };
  className?: string;
}

function formatTrendValue(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value}%`;
}

export function KpiCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  className,
}: KpiCardProps) {
  const displayValue =
    typeof value === "number" ? formatNumber(value) : value;

  const trendDirection =
    trend === undefined ? null : trend.value > 0 ? "up" : trend.value < 0 ? "down" : "neutral";

  const TrendIcon =
    trendDirection === "up"
      ? TrendingUp
      : trendDirection === "down"
        ? TrendingDown
        : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                {title}
              </p>
              <p className="text-3xl font-bold tracking-tight text-foreground">
                {displayValue}
              </p>
              {(description || trend) && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {trend && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-medium",
                        trendDirection === "up" && "text-[#2F6B4F] dark:text-[#7CB89A]",
                        trendDirection === "down" && "text-[#A33B3B] dark:text-[#D48989]",
                        trendDirection === "neutral" && "text-muted-foreground"
                      )}
                    >
                      <TrendIcon className="h-3.5 w-3.5" aria-hidden />
                      {formatTrendValue(trend.value)}
                      {trend.label && (
                        <span className="font-normal text-muted-foreground">
                          {trend.label}
                        </span>
                      )}
                    </span>
                  )}
                  {description && (
                    <span className="text-muted-foreground">{description}</span>
                  )}
                </div>
              )}
            </div>

            {Icon && (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" aria-hidden />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
