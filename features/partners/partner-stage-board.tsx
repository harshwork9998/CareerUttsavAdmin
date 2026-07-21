"use client";

import { useMemo, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion";

import { PARTNER_LIFECYCLE_STAGES } from "@/constants";
import { cn, formatNumber } from "@/lib/utils";
import type { Partner, PartnerLifecycleStage } from "@/types";
import { BRAND, LINE, PAPER, surface } from "@/features/dashboard/dashboard-ui";

const STAGE_ACCENT: Record<PartnerLifecycleStage, string> = {
  New: BRAND[700],
  Contacted: "#0B5F5E",
  "Meeting Scheduled": "#5C6B8A",
  Negotiation: "#8A6A2F",
  Confirmed: "#2F6B4F",
  "Not Proceeding": "#9A4A4A",
};

export function PartnerStageBoard({
  partners,
  renderCard,
  className,
}: {
  partners: Partner[];
  renderCard: (partner: Partner, index: number) => ReactNode;
  className?: string;
}) {
  const rows = useMemo(() => {
    const byStage = new Map<PartnerLifecycleStage, Partner[]>();
    for (const stage of PARTNER_LIFECYCLE_STAGES) {
      byStage.set(stage, []);
    }

    for (const partner of partners) {
      const stage = PARTNER_LIFECYCLE_STAGES.includes(
        partner.stage as (typeof PARTNER_LIFECYCLE_STAGES)[number]
      )
        ? partner.stage
        : "New";
      const bucket = byStage.get(stage) ?? [];
      bucket.push(partner);
      byStage.set(stage, bucket);
    }

    return PARTNER_LIFECYCLE_STAGES.map((stage) => ({
      stage,
      partners: (byStage.get(stage) ?? []).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    }));
  }, [partners]);

  return (
    <div className={cn(surface.mint, "space-y-5 p-3.5 sm:p-4", className)}>
      {rows
        .filter((row) => row.partners.length > 0)
        .map((row) => (
        <section key={row.stage} className="space-y-2.5">
          <div
            className="flex items-center gap-2 rounded-lg px-2.5 py-2"
            style={{
              background: PAPER.muted,
              border: `1px solid ${LINE.subtle}`,
            }}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: STAGE_ACCENT[row.stage] }}
            />
            <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">
              {row.stage}
            </p>
            <span className="text-[12px] font-semibold tabular-nums text-brand-800">
              {formatNumber(row.partners.length)}
            </span>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-1">
            <AnimatePresence mode="popLayout" initial={false}>
              {row.partners.map((partner, index) =>
                renderCard(partner, index)
              )}
            </AnimatePresence>
          </div>
        </section>
      ))}
      {rows.every((row) => row.partners.length === 0) ? (
        <p className="px-1 py-6 text-center text-sm text-muted-foreground">
          No partners match your filters.
        </p>
      ) : null}
    </div>
  );
}
