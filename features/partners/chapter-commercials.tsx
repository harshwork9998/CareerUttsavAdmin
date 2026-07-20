"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, MapPin, Mic2, Package } from "lucide-react";

import {
  BRAND,
  INK,
  LINE,
  PAPER,
  displayClass,
} from "@/features/dashboard/dashboard-ui";
import {
  buildEventPackageSummaries,
  type EventPackageSummary,
} from "@/lib/partner-event-config";
import { cn } from "@/lib/utils";
import type {
  Event,
  PartnerEventPartnership,
  PartnerSeminarSlotAssignment,
} from "@/types";
import { Label } from "@/components/ui/label";

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function ChapterCommercials(props: {
  totalAmount: string;
  setTotalAmount: (v: string) => void;
  discountAmount: string;
  setDiscountAmount: (v: string) => void;
  eventPartnerships: PartnerEventPartnership[];
  slotAssignments: PartnerSeminarSlotAssignment[];
  events: Event[];
  errors: Record<string, string>;
}) {
  const [percentMode, setPercentMode] = useState(false);
  const [discountPercent, setDiscountPercent] = useState("");

  const total = parseAmount(props.totalAmount);
  const discount = parseAmount(props.discountAmount);
  const net = Math.max(0, total - discount);

  useEffect(() => {
    if (!percentMode) return;
    const pct = parseAmount(discountPercent);
    if (!props.totalAmount) {
      props.setDiscountAmount("");
      return;
    }
    const rupees = Math.round((total * pct) / 100);
    props.setDiscountAmount(rupees > 0 ? String(rupees) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync discount from % only
  }, [percentMode, discountPercent, props.totalAmount, total]);

  const eventSummaries = useMemo(
    () =>
      buildEventPackageSummaries(
        props.eventPartnerships,
        props.slotAssignments,
        props.events
      ),
    [props.eventPartnerships, props.slotAssignments, props.events]
  );

  const totalDeliverables = eventSummaries.reduce(
    (s, e) => s + e.deliverables.length,
    0
  );
  const totalSeats = eventSummaries.reduce((s, e) => s + e.seatsAssigned, 0);

  const togglePercentMode = () => {
    setPercentMode((on) => {
      const next = !on;
      if (next) {
        if (total > 0 && discount > 0) {
          const pct = Math.round((discount / total) * 1000) / 10;
          setDiscountPercent(String(pct));
        } else {
          setDiscountPercent("");
        }
      }
      return next;
    });
  };

  return (
    <div className="space-y-8">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-[28px] border p-6 sm:p-8"
        style={{
          borderColor: LINE.subtle,
          background: `radial-gradient(120% 90% at 100% 0%, ${BRAND[50]} 0%, ${PAPER.surface} 52%)`,
        }}
      >
        <div
          className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full opacity-40"
          style={{ background: BRAND[50] }}
          aria-hidden
        />
        <p
          className="text-[11px] font-semibold tracking-[0.18em] uppercase"
          style={{ color: BRAND[700] }}
        >
          Commercials
        </p>
        <h3
          className={cn(displayClass, "mt-2 text-2xl font-bold sm:text-3xl")}
          style={{ color: INK.primary }}
        >
          Package value
        </h3>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <AmountField
            label="Total amount"
            prefix="₹"
            value={props.totalAmount}
            onChange={props.setTotalAmount}
            error={props.errors.totalAmount}
          />
          <div className="space-y-1.5">
            <Label>Discount offered (if any)</Label>
            <AmountField
              suffix={percentMode ? "%" : "₹"}
              onSuffixClick={togglePercentMode}
              value={percentMode ? discountPercent : props.discountAmount}
              onChange={
                percentMode ? setDiscountPercent : props.setDiscountAmount
              }
              error={props.errors.discountAmount}
              hideLabel
            />
            {percentMode && discount > 0 ? (
              <p className="text-[11px]" style={{ color: INK.muted }}>
                that’s ₹{formatInr(discount)} off
              </p>
            ) : null}
          </div>
        </div>

        <div
          className="mt-6 flex flex-wrap items-end justify-between gap-3 rounded-2xl border px-5 py-4"
          style={{
            borderColor: BRAND[700],
            background: `linear-gradient(120deg, ${BRAND[700]} 0%, #2A4A7A 100%)`,
            color: "#fff",
          }}
        >
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] uppercase opacity-80">
              Net total amount
            </p>
            <p
              className={cn(
                displayClass,
                "mt-1 text-3xl font-bold tabular-nums sm:text-4xl"
              )}
            >
              <span className="mr-1 text-2xl opacity-90">₹</span>
              {formatInr(net)}
            </p>
          </div>
        </div>
        {props.errors.netAmount ? (
          <p className="mt-2 text-xs text-destructive">{props.errors.netAmount}</p>
        ) : null}
      </motion.section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p
              className="text-[11px] font-semibold tracking-[0.18em] uppercase"
              style={{ color: BRAND[700] }}
            >
              Package summary
            </p>
            <h3
              className={cn(displayClass, "mt-1 text-xl font-bold sm:text-2xl")}
              style={{ color: INK.primary }}
            >
              By event
            </h3>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span
              className="rounded-full px-3 py-1 tabular-nums"
              style={{ background: BRAND[50], color: BRAND[700] }}
            >
              {eventSummaries.length} event{eventSummaries.length === 1 ? "" : "s"}
            </span>
            <span
              className="rounded-full px-3 py-1 tabular-nums"
              style={{ background: BRAND[50], color: BRAND[700] }}
            >
              {totalDeliverables} deliverable{totalDeliverables === 1 ? "" : "s"}
            </span>
            <span
              className="rounded-full px-3 py-1 tabular-nums"
              style={{ background: BRAND[50], color: BRAND[700] }}
            >
              {totalSeats} seat{totalSeats === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {eventSummaries.length === 0 ? (
          <p className="text-sm" style={{ color: INK.muted }}>
            No event packages configured yet.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {eventSummaries.map((summary, index) => (
              <EventPackageCard
                key={summary.eventId}
                summary={summary}
                index={index}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EventPackageCard({
  summary,
  index,
}: {
  summary: EventPackageSummary;
  index: number;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.32 }}
      className="flex flex-col overflow-hidden rounded-[22px] border shadow-sm"
      style={{
        borderColor: LINE.subtle,
        background: PAPER.surface,
      }}
    >
      <div
        className="border-b px-4 py-3.5 sm:px-5"
        style={{
          borderColor: LINE.subtle,
          background: `linear-gradient(135deg, ${BRAND[50]} 0%, ${PAPER.muted} 100%)`,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: BRAND[700] }}
            >
              <MapPin className="h-3 w-3 shrink-0" />
              {summary.city}
            </p>
            <h4
              className={cn(
                displayClass,
                "mt-1 truncate text-lg font-bold leading-snug"
              )}
              style={{ color: INK.primary }}
            >
              {summary.title}
            </h4>
          </div>
          <span
            className="max-w-[48%] shrink-0 rounded-full px-2.5 py-1 text-right text-[10px] font-semibold leading-tight"
            style={{ background: "rgba(31,56,100,0.12)", color: INK.primary }}
          >
            {summary.tier}
          </span>
        </div>
      </div>

      <div className="grid flex-1 gap-0 sm:grid-cols-2">
        <div className="border-b p-4 sm:border-b-0 sm:border-r" style={{ borderColor: LINE.subtle }}>
          <div className="mb-2.5 flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: BRAND[50], color: BRAND[700] }}
            >
              <Package className="h-3.5 w-3.5" />
            </span>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Deliverables
            </p>
            <span
              className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
              style={{ background: BRAND[50], color: BRAND[700] }}
            >
              {summary.deliverables.length}
            </span>
          </div>
          {summary.deliverables.length === 0 ? (
            <p className="text-xs" style={{ color: INK.muted }}>
              None selected
            </p>
          ) : (
            <ul
              className="max-h-[148px] space-y-1.5 overflow-y-auto overscroll-contain pr-1"
              style={{ scrollbarWidth: "thin" }}
            >
              {summary.deliverables.map((item) => (
                <li key={item.id} className="flex items-start gap-2">
                  <Check
                    className="mt-0.5 h-3 w-3 shrink-0"
                    style={{ color: BRAND[700] }}
                    strokeWidth={3}
                  />
                  <span className="min-w-0 text-xs leading-snug" style={{ color: INK.secondary }}>
                    <span className="font-medium" style={{ color: INK.primary }}>
                      {item.label}
                    </span>
                    {item.option ? (
                      <span style={{ color: INK.muted }}> · {item.option}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4">
          <div className="mb-2.5 flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: BRAND[50], color: BRAND[700] }}
            >
              <Mic2 className="h-3.5 w-3.5" />
            </span>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Seminar seats
            </p>
            <span
              className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
              style={{ background: BRAND[50], color: BRAND[700] }}
            >
              {summary.seatsAssigned}/{summary.slotBudget}
            </span>
          </div>
          {summary.seminars.length === 0 ? (
            <p className="text-xs" style={{ color: INK.muted }}>
              {summary.slotBudget > 0
                ? "No seminars picked yet"
                : "No panelist slots"}
            </p>
          ) : (
            <ul
              className="max-h-[148px] space-y-1.5 overflow-y-auto overscroll-contain pr-1"
              style={{ scrollbarWidth: "thin" }}
            >
              {summary.seminars.map((seminar) => (
                <li
                  key={seminar.id}
                  className="rounded-lg px-2 py-1.5 text-xs"
                  style={{ background: PAPER.muted }}
                >
                  <span className="font-medium" style={{ color: INK.primary }}>
                    {seminar.title}
                  </span>
                  <span className="ml-1 tabular-nums" style={{ color: INK.muted }}>
                    · {seminar.slots} seat{seminar.slots === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </motion.article>
  );
}

function AmountField({
  label,
  prefix,
  suffix,
  onSuffixClick,
  value,
  onChange,
  error,
  hideLabel,
}: {
  label?: string;
  prefix?: string;
  suffix?: string;
  onSuffixClick?: () => void;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hideLabel?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      {!hideLabel && label ? <Label>{label}</Label> : null}
      <div
        className="flex h-12 items-center gap-2 rounded-lg border px-3 transition-shadow focus-within:ring-2 focus-within:ring-ring"
        style={{ borderColor: LINE.strong, background: PAPER.surface }}
      >
        {prefix ? (
          <span
            className="select-none text-base font-semibold leading-none"
            style={{ color: INK.secondary }}
          >
            {prefix}
          </span>
        ) : null}
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
          className="h-full w-full min-w-0 bg-transparent text-base tabular-nums outline-none"
          style={{ color: INK.primary }}
        />
        {suffix ? (
          onSuffixClick ? (
            <button
              type="button"
              onClick={onSuffixClick}
              className="shrink-0 rounded-md px-1.5 py-0.5 text-base font-semibold leading-none transition-colors hover:bg-black/[0.04]"
              style={{ color: BRAND[700] }}
              aria-label={`Switch to ${suffix === "%" ? "rupees" : "percent"}`}
              title="Click to switch ₹ / %"
            >
              {suffix}
            </button>
          ) : (
            <span
              className="select-none text-base font-semibold leading-none"
              style={{ color: INK.secondary }}
            >
              {suffix}
            </span>
          )
        ) : null}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export { parseAmount };
