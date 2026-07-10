"use client";

import { cn } from "@/lib/utils";
import type { DashboardCityFilter, OperatingCity } from "@/types";
import { OPERATING_CITIES } from "@/lib/mock-data/dashboard-city-slices";

const CITY_OPTIONS: Array<{ value: DashboardCityFilter; label: string }> = [
  { value: "all", label: "All cities" },
  ...OPERATING_CITIES.map((city) => ({
    value: city as OperatingCity,
    label: city,
  })),
];

export function DashboardCitySelector({
  value,
  onChange,
  className,
}: {
  value: DashboardCityFilter;
  onChange: (city: DashboardCityFilter) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="City"
      className={cn("flex flex-wrap items-center gap-x-1 gap-y-1", className)}
    >
      {CITY_OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative px-2.5 py-1.5 text-[13px] transition-colors duration-150",
              active
                ? "font-semibold text-foreground"
                : "font-medium text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
            {active && (
              <span
                className="absolute inset-x-2.5 -bottom-px h-[2px] rounded-sm bg-primary"
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
