"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/** Minimal section label — no subtitle tax. */
export function DashboardSectionHeader({
  title,
  badge,
  meta,
  className,
}: {
  title: string;
  description?: string;
  badge?: string;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3",
        className
      )}
    >
      <div className="flex min-w-0 flex-wrap items-baseline gap-2">
        <h2 className="text-[13px] font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {badge && badge !== "All Cities" && (
          <Badge
            variant="secondary"
            className="h-5 rounded-md px-1.5 text-[10px] font-medium"
          >
            {badge}
          </Badge>
        )}
      </div>
      {meta && (
        <div className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
          {meta}
        </div>
      )}
    </div>
  );
}
