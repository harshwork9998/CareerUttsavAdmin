"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Filter, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

interface FilterConfigBase {
  id: string;
  label: string;
  placeholder?: string;
  options: FilterOption[];
}

export interface SingleFilterConfig extends FilterConfigBase {
  mode?: "single";
  value?: string;
  onChange: (value: string) => void;
}

export interface MultiFilterConfig extends FilterConfigBase {
  mode: "multi";
  values: string[];
  onChange: (values: string[]) => void;
}

export type FilterConfig = SingleFilterConfig | MultiFilterConfig;

export interface FiltersBarProps {
  filters?: FilterConfig[];
  children?: React.ReactNode;
  onClearAll?: () => void;
  showClearAll?: boolean;
  className?: string;
}

function isMultiFilter(filter: FilterConfig): filter is MultiFilterConfig {
  return filter.mode === "multi";
}

function isFilterActive(filter: FilterConfig): boolean {
  if (isMultiFilter(filter)) return filter.values.length > 0;
  return Boolean(filter.value && filter.value !== "all");
}

export function FiltersBar({
  filters = [],
  children,
  onClearAll,
  showClearAll = true,
  className,
}: FiltersBarProps) {
  const hasActiveFilters = filters.some(isFilterActive);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end",
        className
      )}
    >
      <div className="flex h-9 shrink-0 items-center gap-2 text-sm font-medium text-muted-foreground sm:mr-1">
        <Filter className="h-4 w-4" aria-hidden />
        Filters
      </div>

      {filters.map((filter) =>
        isMultiFilter(filter) ? (
          <FilterMultiSelect key={filter.id} {...filter} />
        ) : (
          <FilterSelect key={filter.id} {...filter} />
        )
      )}

      {children}

      {showClearAll && hasActiveFilters && onClearAll && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 text-muted-foreground"
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
}: SingleFilterConfig & { className?: string }) {
  return (
    <div className={cn("flex min-w-[148px] flex-col gap-1.5", className)}>
      <Label
        htmlFor={id}
        className="h-4 text-xs leading-4 text-muted-foreground"
      >
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

export function FilterMultiSelect({
  id,
  label,
  placeholder = "All",
  options,
  values,
  onChange,
  className,
}: MultiFilterConfig & { className?: string }) {
  const [open, setOpen] = React.useState(false);
  const selected = new Set(values);

  const summary =
    values.length === 0
      ? placeholder
      : values.length === 1
        ? (options.find((o) => o.value === values[0])?.label ?? values[0])
        : `${values.length} selected`;

  const toggle = (value: string) => {
    if (selected.has(value)) {
      onChange(values.filter((v) => v !== value));
    } else {
      onChange([...values, value]);
    }
  };

  return (
    <div className={cn("flex min-w-[168px] flex-col gap-1.5", className)}>
      <Label
        htmlFor={id}
        className="h-4 text-xs leading-4 text-muted-foreground"
      >
        {label}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "h-9 w-full justify-between px-3 font-normal",
              values.length === 0 && "text-muted-foreground"
            )}
          >
            <span className="truncate">{summary}</span>
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1" align="start">
          <div className="max-h-60 space-y-0.5 overflow-y-auto">
            {options.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">
                No options
              </p>
            ) : (
              options.map((option) => {
                const checked = selected.has(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggle(option.value)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent",
                      checked && "bg-accent/60"
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      tabIndex={-1}
                      aria-hidden
                      className="pointer-events-none"
                    />
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {checked && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                    )}
                  </button>
                );
              })
            )}
          </div>
          {values.length > 0 && (
            <div className="border-t p-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-full justify-start text-muted-foreground"
                onClick={() => onChange([])}
              >
                Clear selection
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
