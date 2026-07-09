"use client";

import * as React from "react";
import { Filter, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterConfig {
  id: string;
  label: string;
  placeholder?: string;
  options: FilterOption[];
  value?: string;
  onChange: (value: string) => void;
}

export interface FiltersBarProps {
  filters?: FilterConfig[];
  children?: React.ReactNode;
  onClearAll?: () => void;
  showClearAll?: boolean;
  className?: string;
}

export function FiltersBar({
  filters = [],
  children,
  onClearAll,
  showClearAll = true,
  className,
}: FiltersBarProps) {
  const hasActiveFilters = filters.some(
    (filter) => filter.value && filter.value !== "all"
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end",
        className
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground sm:mr-2">
        <Filter className="h-4 w-4" aria-hidden />
        Filters
      </div>

      {filters.map((filter) => (
        <FilterSelect key={filter.id} {...filter} />
      ))}

      {children}

      {showClearAll && hasActiveFilters && onClearAll && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={onClearAll}
        >
          <X className="h-3.5 w-3.5" />
          Clear all
        </Button>
      )}
    </div>
  );
}

export function FilterSelect({
  id,
  label,
  placeholder = "All",
  options,
  value,
  onChange,
  className,
}: FilterConfig & { className?: string }) {
  return (
    <div className={cn("min-w-[160px] space-y-1.5", className)}>
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Select value={value ?? "all"} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-9">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
