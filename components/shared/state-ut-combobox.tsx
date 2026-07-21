"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { BRAND, INK } from "@/features/dashboard/dashboard-ui";
import { INDIAN_STATES_AND_UTS } from "@/lib/indian-states-uts";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";

type StateUtComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
};

export function StateUtCombobox({
  value,
  onChange,
  id,
  placeholder = "Type to search state or UT…",
}: StateUtComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...INDIAN_STATES_AND_UTS];
    return INDIAN_STATES_AND_UTS.filter((s) => s.toLowerCase().includes(q));
  }, [query]);

  const display = open ? query : value;
  const listboxId = id ? `${id}-listbox` : "state-ut-listbox";
  const activeOptionId =
    activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const selectAt = (index: number) => {
    const state = filtered[index];
    if (!state) return;
    onChange(state);
    setQuery(state);
    setOpen(false);
    setActiveIndex(-1);
  };

  return (
    <Popover
      modal={false}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setQuery(value);
          setActiveIndex(-1);
        } else {
          setActiveIndex(-1);
        }
      }}
    >
      <PopoverAnchor asChild>
        <div className="relative">
          <Input
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-activedescendant={activeOptionId}
            autoComplete="off"
            placeholder={placeholder}
            value={display}
            onChange={(e) => {
              const next = e.target.value;
              setQuery(next);
              if (!open) setOpen(true);
            }}
            onFocus={() => {
              setQuery(value);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
                setActiveIndex(-1);
                return;
              }

              if (e.key === "ArrowDown") {
                e.preventDefault();
                if (!open) {
                  setOpen(true);
                  setActiveIndex(filtered.length ? 0 : -1);
                  return;
                }
                if (!filtered.length) return;
                setActiveIndex((i) =>
                  i < 0 ? 0 : Math.min(i + 1, filtered.length - 1)
                );
                return;
              }

              if (e.key === "ArrowUp") {
                e.preventDefault();
                if (!open || !filtered.length) return;
                setActiveIndex((i) =>
                  i <= 0 ? filtered.length - 1 : i - 1
                );
                return;
              }

              if (e.key === "Home" && open && filtered.length) {
                e.preventDefault();
                setActiveIndex(0);
                return;
              }

              if (e.key === "End" && open && filtered.length) {
                e.preventDefault();
                setActiveIndex(filtered.length - 1);
                return;
              }

              if (e.key === "Enter") {
                if (!open || filtered.length === 0) return;
                e.preventDefault();
                const index = activeIndex >= 0 ? activeIndex : 0;
                selectAt(index);
              }
            }}
            className="pr-9"
          />
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50"
            aria-hidden
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="z-[100] w-[var(--radix-popover-trigger-width)] p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="max-h-72 overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No matching states
            </p>
          ) : (
            filtered.map((state, index) => {
              const selected = state === value;
              const active = index === activeIndex;
              return (
                <button
                  key={state}
                  id={`${listboxId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={selected || active}
                  data-index={index}
                  className={cn(
                    "flex w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                    selected && !active && "font-medium"
                  )}
                  style={{
                    background: active
                      ? BRAND[100]
                      : selected
                        ? BRAND[50]
                        : "transparent",
                    color: active || selected ? BRAND[800] : INK.primary,
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectAt(index)}
                >
                  {state}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
