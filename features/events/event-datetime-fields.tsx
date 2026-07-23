"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDaysInMonth,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  parseISO,
  setMonth,
  setYear,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Keyboard } from "lucide-react";

import { cn } from "@/lib/utils";
import { fieldErrorClass } from "@/components/shared/form-field-error";
import { BRAND, INK, LINE, PAPER } from "@/features/dashboard/dashboard-ui";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function toISODate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function parseISODate(value: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return parseISO(`${value}T12:00:00`);
}

export function formatDisplayDate(value: string): string {
  const d = parseISODate(value);
  if (!d) return "";
  return format(d, "EEE, d MMM yyyy");
}

export function formatDisplayTime(value: string): string {
  if (!value) return "";
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h)) return value;
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return format(d, "h:mm a");
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toHHMM(hour24: number, minute: number) {
  return `${pad2(hour24)}:${pad2(minute)}`;
}

function parseHHMM(value: string): { hour24: number; minute: number } {
  const [h, m] = (value || "09:00").split(":").map(Number);
  return {
    hour24: Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 9,
    minute: Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0,
  };
}

function to12h(hour24: number): { hour12: number; period: "AM" | "PM" } {
  const period: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, period };
}

function from12h(hour12: number, period: "AM" | "PM"): number {
  if (period === "AM") return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

/** Year range: 2 years back → 10 years ahead — jump without month-clicking. */
function yearOptions(anchor = new Date()) {
  const y = anchor.getFullYear();
  return Array.from({ length: 13 }, (_, i) => y - 2 + i);
}

type DateFieldProps = {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  id?: string;
  className?: string;
  error?: string;
};

export function DateField({
  value,
  onChange,
  min,
  max,
  placeholder = "",
  id,
  className,
  error,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = parseISODate(value);
  const minDate = parseISODate(min ?? "");
  const maxDate = parseISODate(max ?? "");
  const [viewMonth, setViewMonth] = useState(
    () => selected ?? minDate ?? new Date()
  );

  const years = useMemo(() => yearOptions(), []);

  const weeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });
    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [viewMonth]);

  const isDisabled = (day: Date) => {
    if (minDate && isBefore(day, minDate) && !isSameDay(day, minDate)) return true;
    if (maxDate && isAfter(day, maxDate) && !isSameDay(day, maxDate)) return true;
    return false;
  };

  const jumpMonth = (monthIndex: number) => {
    setViewMonth((prev) => setMonth(prev, monthIndex));
  };

  const jumpYear = (year: number) => {
    setViewMonth((prev) => {
      let next = setYear(prev, year);
      // Clamp day so Feb 31 → Feb 28 etc. when month has fewer days
      const dim = getDaysInMonth(next);
      if (next.getDate() > dim) {
        next = new Date(year, next.getMonth(), dim);
      }
      return next;
    });
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setViewMonth(selected ?? minDate ?? new Date());
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-invalid={Boolean(error)}
          data-field-error={error ? "true" : undefined}
          className={fieldErrorClass(
            error,
            cn(
              "h-10 w-full justify-start gap-2 px-3 font-normal",
              !value && "text-muted-foreground",
              className
            )
          )}
        >
          <CalendarDays className="h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate">
            {value ? formatDisplayDate(value) : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="z-[80] w-[320px] p-3"
        style={{
          borderColor: LINE.subtle,
          background: PAPER.surface,
          boxShadow: "0 16px 40px rgba(18,35,63,0.16)",
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Month + year dropdowns (Airbnb / booking-site pattern) */}
        <div className="mb-3 flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label="Previous month"
            onClick={() => setViewMonth((m) => addMonths(m, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <label className="sr-only" htmlFor={`${id ?? "date"}-month`}>
            Month
          </label>
          <select
            id={`${id ?? "date"}-month`}
            value={viewMonth.getMonth()}
            onChange={(e) => jumpMonth(Number(e.target.value))}
            className="h-9 min-w-0 flex-1 cursor-pointer rounded-lg border bg-white px-2 text-sm font-medium outline-none focus:ring-2 focus:ring-ring"
            style={{ borderColor: LINE.subtle, color: INK.primary }}
          >
            {MONTHS.map((name, i) => (
              <option key={name} value={i}>
                {name}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor={`${id ?? "date"}-year`}>
            Year
          </label>
          <select
            id={`${id ?? "date"}-year`}
            value={viewMonth.getFullYear()}
            onChange={(e) => jumpYear(Number(e.target.value))}
            className="h-9 w-[88px] shrink-0 cursor-pointer rounded-lg border bg-white px-2 text-sm font-medium outline-none focus:ring-2 focus:ring-ring"
            style={{ borderColor: LINE.subtle, color: INK.primary }}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
            {/* Always include viewed year if outside default range */}
            {!years.includes(viewMonth.getFullYear()) ? (
              <option value={viewMonth.getFullYear()}>
                {viewMonth.getFullYear()}
              </option>
            ) : null}
          </select>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label="Next month"
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1">
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
            <div
              key={d}
              className="py-1 text-center text-[11px] font-medium"
              style={{ color: INK.muted }}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {weeks.flat().map((day) => {
            const inMonth = isSameMonth(day, viewMonth);
            const selectedDay = selected ? isSameDay(day, selected) : false;
            const disabled = isDisabled(day);
            const today = isSameDay(day, new Date());

            return (
              <button
                key={day.toISOString()}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onChange(toISODate(day));
                  setOpen(false);
                }}
                className={cn(
                  "flex h-9 w-full items-center justify-center rounded-lg text-sm transition-colors",
                  !inMonth && "opacity-35",
                  disabled && "cursor-not-allowed opacity-25",
                  !selectedDay && !disabled && "hover:bg-muted",
                  selectedDay && "font-semibold text-white"
                )}
                style={
                  selectedDay
                    ? { backgroundColor: BRAND[700] }
                    : today
                      ? { boxShadow: `inset 0 0 0 1px ${BRAND[500]}` }
                      : undefined
                }
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => {
              const today = toISODate(new Date());
              if (!min || today >= min) {
                onChange(today);
                setOpen(false);
              }
            }}
          >
            Today
          </Button>
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ─── Material / Google Alarm–style time picker ──────────────────────────── */

type ClockMode = "hour" | "minute";

type AnalogClockProps = {
  mode: ClockMode;
  hour12: number;
  minute: number;
  onHour: (h: number) => void;
  onHourCommit: (h: number) => void;
  onMinute: (m: number) => void;
};

function AnalogClock({
  mode,
  hour12,
  minute,
  onHour,
  onHourCommit,
  onMinute,
}: AnalogClockProps) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastHour = useRef(hour12);

  const angle =
    mode === "hour"
      ? ((hour12 % 12) / 12) * 360
      : (minute / 60) * 360;

  const pickFromEvent = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let deg = (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;

    if (mode === "hour") {
      let h = Math.round(deg / 30) % 12;
      if (h === 0) h = 12;
      lastHour.current = h;
      onHour(h);
    } else {
      let m = Math.round(deg / 30) * 5;
      if (m === 60) m = 0;
      onMinute(m);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pickFromEvent(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    pickFromEvent(e.clientX, e.clientY);
  };
  const onPointerUp = () => {
    if (dragging.current && mode === "hour") {
      onHourCommit(lastHour.current);
    }
    dragging.current = false;
  };

  const labels =
    mode === "hour"
      ? [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
      : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const activeMinute = (Math.round(minute / 5) * 5) % 60;

  return (
    <div
      ref={ref}
      className="relative mx-auto aspect-square w-[220px] touch-none select-none rounded-full"
      style={{ backgroundColor: PAPER.muted }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 origin-bottom"
        style={{
          width: 2,
          height: "34%",
          marginLeft: -1,
          marginTop: "-34%",
          backgroundColor: BRAND[700],
          transform: `rotate(${angle}deg)`,
          borderRadius: 2,
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ backgroundColor: BRAND[700] }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 rounded-full"
        style={{
          backgroundColor: `${BRAND[700]}33`,
          transform: `rotate(${angle}deg) translateY(-78px)`,
          marginTop: -18,
        }}
      />

      {labels.map((n, i) => {
        const a = (i / 12) * 360;
        const rad = ((a - 90) * Math.PI) / 180;
        const r = 78;
        const x = Math.cos(rad) * r;
        const y = Math.sin(rad) * r;
        const isActive =
          mode === "hour" ? n === hour12 : n === activeMinute;

        return (
          <button
            key={`${mode}-${n}`}
            type="button"
            className="absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-sm font-medium transition-colors hover:bg-white/70"
            style={{
              left: `calc(50% + ${x}px)`,
              top: `calc(50% + ${y}px)`,
              backgroundColor: isActive ? BRAND[700] : "transparent",
              color: isActive ? "#fff" : INK.primary,
              zIndex: 1,
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (mode === "hour") onHourCommit(n === 0 ? 12 : n);
              else onMinute(n);
            }}
          >
            {mode === "hour" ? n : pad2(n)}
          </button>
        );
      })}
    </div>
  );
}

type TimeFieldProps = {
  value: string;
  onChange: (hhmm: string) => void;
  min?: string;
  placeholder?: string;
  id?: string;
  className?: string;
};

export function TimeField({
  value,
  onChange,
  min,
  placeholder = "",
  id,
  className,
}: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  const initial = parseHHMM(value || "09:00");
  const initial12 = to12h(initial.hour24);

  const [hour12, setHour12] = useState(initial12.hour12);
  const [minute, setMinute] = useState(initial.minute);
  const [period, setPeriod] = useState<"AM" | "PM">(initial12.period);
  const [mode, setMode] = useState<ClockMode>("hour");
  const [inputMode, setInputMode] = useState<"dial" | "keyboard">("dial");
  const [draftHour, setDraftHour] = useState(String(initial12.hour12));
  const [draftMinute, setDraftMinute] = useState(pad2(initial.minute));

  useEffect(() => {
    if (!open) return;
    const parsed = parseHHMM(value || "09:00");
    const t = to12h(parsed.hour24);
    setHour12(t.hour12);
    setMinute(parsed.minute);
    setPeriod(t.period);
    setMode("hour");
    setInputMode("dial");
    setDraftHour(String(t.hour12));
    setDraftMinute(pad2(parsed.minute));
  }, [open, value]);

  const commit = () => {
    let h12 = hour12;
    let m = minute;
    if (inputMode === "keyboard") {
      h12 = Math.min(12, Math.max(1, Number(draftHour) || 12));
      m = Math.min(59, Math.max(0, Number(draftMinute) || 0));
    }
    const hour24 = from12h(h12, period);
    const next = toHHMM(hour24, m);
    if (min && next <= min) {
      // Keep selection but nudge past min by +15m if possible
      const { hour24: mh, minute: mm } = parseHHMM(min);
      const bumped = new Date();
      bumped.setHours(mh, mm + 15, 0, 0);
      onChange(toHHMM(bumped.getHours(), bumped.getMinutes()));
    } else {
      onChange(next);
    }
    setOpen(false);
  };

  const setHourLive = (h: number) => {
    setHour12(h);
    setDraftHour(String(h));
  };

  const setHourCommit = (h: number) => {
    setHour12(h);
    setDraftHour(String(h));
    setMode("minute");
  };

  const setMinuteFromDial = (m: number) => {
    setMinute(m);
    setDraftMinute(pad2(m));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            "h-10 w-full justify-start gap-2 px-3 font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <Clock className="h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate">
            {value ? formatDisplayTime(value) : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="z-[80] w-[300px] p-4"
        style={{
          borderColor: LINE.subtle,
          background: PAPER.surface,
          boxShadow: "0 16px 40px rgba(18,35,63,0.16)",
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <p
          className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: INK.muted }}
        >
          Time
        </p>

        {/* Digital display — tap hour / minute (Material pattern) */}
        <div className="mb-4 flex items-stretch justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setInputMode("dial");
              setMode("hour");
            }}
            className={cn(
              "min-w-[72px] rounded-xl px-3 py-2 text-center text-3xl font-semibold tabular-nums transition-colors",
              mode === "hour" && inputMode === "dial"
                ? "text-white"
                : "bg-muted"
            )}
            style={
              mode === "hour" && inputMode === "dial"
                ? { backgroundColor: BRAND[700] }
                : { color: INK.primary }
            }
          >
            {pad2(hour12)}
          </button>
          <span
            className="self-center text-3xl font-semibold"
            style={{ color: INK.primary }}
          >
            :
          </span>
          <button
            type="button"
            onClick={() => {
              setInputMode("dial");
              setMode("minute");
            }}
            className={cn(
              "min-w-[72px] rounded-xl px-3 py-2 text-center text-3xl font-semibold tabular-nums transition-colors",
              mode === "minute" && inputMode === "dial"
                ? "text-white"
                : "bg-muted"
            )}
            style={
              mode === "minute" && inputMode === "dial"
                ? { backgroundColor: BRAND[700] }
                : { color: INK.primary }
            }
          >
            {pad2(minute)}
          </button>

          <div className="ml-1 flex flex-col overflow-hidden rounded-lg border" style={{ borderColor: LINE.subtle }}>
            {(["AM", "PM"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-2.5 py-1.5 text-xs font-semibold transition-colors",
                  period === p ? "text-white" : "hover:bg-muted"
                )}
                style={
                  period === p
                    ? { backgroundColor: BRAND[700] }
                    : { color: INK.secondary }
                }
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {inputMode === "dial" ? (
          <AnalogClock
            mode={mode}
            hour12={hour12}
            minute={minute}
            onHour={setHourLive}
            onHourCommit={setHourCommit}
            onMinute={setMinuteFromDial}
          />
        ) : (
          <div className="flex items-center justify-center gap-2 py-6">
            <input
              type="number"
              min={1}
              max={12}
              value={draftHour}
              onChange={(e) => setDraftHour(e.target.value)}
              className="h-14 w-16 rounded-xl border text-center text-2xl font-semibold tabular-nums outline-none focus:ring-2 focus:ring-ring"
              style={{ borderColor: LINE.subtle, color: INK.primary }}
              aria-label="Hour"
            />
            <span className="text-2xl font-semibold">:</span>
            <input
              type="number"
              min={0}
              max={59}
              value={draftMinute}
              onChange={(e) => setDraftMinute(e.target.value)}
              className="h-14 w-16 rounded-xl border text-center text-2xl font-semibold tabular-nums outline-none focus:ring-2 focus:ring-ring"
              style={{ borderColor: LINE.subtle, color: INK.primary }}
              aria-label="Minute"
            />
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() =>
              setInputMode((m) => (m === "dial" ? "keyboard" : "dial"))
            }
          >
            {inputMode === "dial" ? (
              <>
                <Keyboard className="h-4 w-4" />
                Keyboard
              </>
            ) : (
              <>
                <Clock className="h-4 w-4" />
                Dial
              </>
            )}
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1 text-white"
              style={{ backgroundColor: BRAND[700] }}
              onClick={commit}
            >
              <Check className="h-3.5 w-3.5" />
              OK
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type DateRangeQuickProps = {
  startDate: string;
  endDate: string;
  onStartChange: (iso: string) => void;
  onEndChange: (iso: string) => void;
};

export function DateRangeQuickPicks({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
}: DateRangeQuickProps) {
  const setLength = (extraDays: number) => {
    const base = startDate || toISODate(new Date());
    if (!startDate) onStartChange(base);
    const start = parseISODate(base)!;
    const end = new Date(start);
    end.setDate(end.getDate() + extraDays);
    onEndChange(toISODate(end));
  };

  const lengthDays = (() => {
    if (!startDate || !endDate) return null;
    const a = parseISODate(startDate)!;
    const b = parseISODate(endDate)!;
    return Math.round((b.getTime() - a.getTime()) / 86_400_000);
  })();

  const chips = [
    { label: "1 day", days: 0 },
    { label: "2 days", days: 1 },
    { label: "3 days", days: 2 },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs" style={{ color: INK.muted }}>
        Length:
      </span>
      {chips.map((chip) => {
        const active = lengthDays === chip.days && Boolean(startDate);
        return (
          <button
            key={chip.label}
            type="button"
            onClick={() => setLength(chip.days)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              active ? "text-white" : "hover:bg-muted"
            )}
            style={
              active
                ? { backgroundColor: BRAND[700] }
                : {
                    backgroundColor: PAPER.muted,
                    color: INK.secondary,
                  }
            }
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
