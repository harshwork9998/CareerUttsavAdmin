"use client";

import { cn } from "@/lib/utils";
import type { DashboardCityFilter } from "@/types";

const CITY_TABS: Array<{ value: DashboardCityFilter; label: string }> = [
  { value: "all", label: "Consolidated" },
  { value: "Bangalore", label: "Bangalore" },
  { value: "Mysore", label: "Mysore" },
  { value: "Hubli", label: "Hubli" },
];

export function DashboardCitySelector({
  value,
  onChange,
  className,
  variant = "pills",
}: {
  value: DashboardCityFilter;
  onChange: (city: DashboardCityFilter) => void;
  className?: string;
  /** `hero` = segmented control on the hero card */
  variant?: "pills" | "hero";
}) {
  if (variant === "hero") {
    return (
      <div
        role="tablist"
        aria-label="City view"
        className={cn(
          "flex w-full flex-wrap gap-1 rounded-xl bg-brand-950/10 p-1",
          className
        )}
      >
        {CITY_TABS.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(option.value)}
              className={cn(
                "min-w-0 flex-1 rounded-lg px-3 py-2 text-center text-[13px] transition-colors duration-150 sm:text-[14px]",
                active
                  ? "bg-white font-semibold text-brand-900 shadow-[0_2px_8px_rgba(18,35,63,0.18)]"
                  : "font-medium text-brand-900/55 hover:bg-white/50 hover:text-brand-900"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-label="City view"
      className={cn("flex flex-wrap items-center gap-x-1 gap-y-1", className)}
    >
      {CITY_TABS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative rounded-lg px-2.5 py-1.5 text-[13px] transition-colors duration-150",
              active
                ? "bg-brand-700 font-semibold text-white shadow-sm"
                : "font-medium text-brand-900/55 hover:bg-brand-50 hover:text-brand-900"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
