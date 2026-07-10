"use client";

import { cn, formatNumber } from "@/lib/utils";

/** Compact ranked bar — high information density, minimal chrome. */
export function RankedBar({
  name,
  value,
  max,
  total,
  rank,
  color = "hsl(var(--primary))",
  active,
  onHover,
  onLeave,
  onClick,
  dense,
}: {
  name: string;
  value: number;
  max: number;
  total?: number;
  rank?: number;
  color?: string;
  active?: boolean;
  onHover?: () => void;
  onLeave?: () => void;
  onClick?: () => void;
  dense?: boolean;
}) {
  const width = max > 0 ? Math.round((value / max) * 100) : 0;
  const pct =
    total && total > 0 ? Math.round((value / total) * 100) : undefined;
  const dimmed = active === false;
  const highlighted = active === true;

  const className = cn(
    "group w-full text-left transition-colors duration-150",
    dense ? "rounded-md px-1.5 py-1" : "rounded-lg px-2 py-1.5",
    onClick && "cursor-pointer",
    highlighted && "bg-muted/60",
    !highlighted && !dimmed && "hover:bg-muted/40",
    dimmed && "opacity-40"
  );

  const body = (
    <>
      <div className="flex items-baseline gap-2">
        {rank !== undefined && (
          <span className="w-3.5 shrink-0 text-[10px] tabular-nums text-muted-foreground">
            {rank}
          </span>
        )}
        <span
          className={cn(
            "min-w-0 flex-1 truncate font-medium text-foreground",
            dense ? "text-[12px]" : "text-[13px]"
          )}
        >
          {name}
        </span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          <span
            className={cn(
              "font-semibold text-foreground",
              dense ? "text-[12px]" : "text-[13px]"
            )}
          >
            {formatNumber(value)}
          </span>
          {pct !== undefined && (
            <span className="ml-1.5 text-[10px]">{pct}%</span>
          )}
        </span>
      </div>
      <div
        className={cn(
          "overflow-hidden rounded-full bg-muted/70",
          dense ? "mt-1 h-1" : "mt-1.5 h-1.5",
          rank !== undefined && "ml-[22px]"
        )}
      >
        <div
          className="h-full rounded-full transition-[width,opacity] duration-300 ease-out"
          style={{
            width: `${width}%`,
            backgroundColor: color,
            opacity: dimmed ? 0.35 : 0.85,
          }}
        />
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={onHover}
        onMouseLeave={onLeave}
        className={className}
      >
        {body}
      </button>
    );
  }

  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={className}
    >
      {body}
    </div>
  );
}

export function DistributionRow({
  name,
  value,
  total,
  color,
  active,
  onHover,
  onLeave,
  onClick,
  dense,
}: {
  name: string;
  value: number;
  total: number;
  color: string;
  active?: boolean;
  onHover?: () => void;
  onLeave?: () => void;
  onClick?: () => void;
  dense?: boolean;
}) {
  return (
    <RankedBar
      name={name}
      value={value}
      max={total}
      total={total}
      color={color}
      active={active}
      onHover={onHover}
      onLeave={onLeave}
      onClick={onClick}
      dense={dense}
    />
  );
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  valueLabel = "Count",
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string; name?: string; color?: string }>;
  label?: string;
  valueLabel?: string;
}) {
  if (!active || !payload?.length) return null;

  const item = payload[0];
  const value = Number(item?.value ?? 0);
  const title = label || String(item?.name ?? "");

  return (
    <div className="rounded-lg border border-border/80 bg-card px-3 py-2 shadow-card">
      <p className="max-w-[220px] text-[12px] font-medium leading-snug">
        {title}
      </p>
      <p className="mt-1 text-[12px] tabular-nums text-muted-foreground">
        <span className="font-semibold text-foreground">
          {formatNumber(value)}
        </span>
        {valueLabel ? ` ${valueLabel}` : ""}
      </p>
    </div>
  );
}

/** Tiny metric chip used inside denser compositions. */
export function MetricChip({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-[15px] font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
