"use client";

import { cn } from "@/lib/utils";

export function ChapterLabel({
  children,
  meta,
  className,
}: {
  children: React.ReactNode;
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
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {children}
      </h2>
      {meta && (
        <div className="text-[11px] tabular-nums text-muted-foreground/80">
          {meta}
        </div>
      )}
    </div>
  );
}
