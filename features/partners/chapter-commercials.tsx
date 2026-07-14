"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Mic2 } from "lucide-react";

import {
  BRAND,
  INK,
  LINE,
  PAPER,
  displayClass,
} from "@/features/dashboard/dashboard-ui";
import { cn } from "@/lib/utils";
import type {
  Event,
  PartnerDeliverable,
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
  deliverables: PartnerDeliverable[];
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

  const includedDeliverables = useMemo(
    () => props.deliverables.filter((d) => d.included),
    [props.deliverables]
  );

  const slotSummary = useMemo(() => {
    return props.slotAssignments
      .filter((a) => a.slots > 0)
      .map((a) => {
        const event = props.events.find((e) => e.id === a.eventId);
        const seminar = event?.seminars.find((s) => s.id === a.seminarId);
        return {
          id: `${a.eventId}-${a.seminarId}`,
          eventTitle: event?.title ?? a.eventId,
          city: event?.city ?? "",
          seminarTitle: seminar?.title ?? a.seminarId,
          slots: a.slots,
        };
      });
  }, [props.slotAssignments, props.events]);

  const totalSeats = slotSummary.reduce((s, row) => s + row.slots, 0);

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
            <p className={cn(displayClass, "mt-1 text-3xl font-bold tabular-nums sm:text-4xl")}>
              <span className="mr-1 text-2xl opacity-90">₹</span>
              {formatInr(net)}
            </p>
          </div>
        </div>
        {props.errors.netAmount ? (
          <p className="mt-2 text-xs text-destructive">{props.errors.netAmount}</p>
        ) : null}
      </motion.section>

      <div className="grid gap-5 lg:grid-cols-2">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.3 }}
          className="rounded-[28px] border p-5 sm:p-6"
          style={{ borderColor: LINE.subtle, background: PAPER.surface }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p
                className="text-[11px] font-semibold tracking-[0.16em] uppercase"
                style={{ color: BRAND[700] }}
              >
                Deliverables
              </p>
              <h3
                className={cn(displayClass, "mt-1 text-xl font-bold")}
                style={{ color: INK.primary }}
              >
                In the package
              </h3>
            </div>
            <span
              className="rounded-full px-3 py-1 text-xs font-bold tabular-nums"
              style={{ background: BRAND[50], color: BRAND[700] }}
            >
              {includedDeliverables.length}
            </span>
          </div>

          {includedDeliverables.length === 0 ? (
            <p className="mt-5 text-sm" style={{ color: INK.muted }}>
              No deliverables selected.
            </p>
          ) : (
            <ul className="mt-5 space-y-2">
              {includedDeliverables.map((item, index) => (
                <motion.li
                  key={item.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.03 * index }}
                  className="flex items-start gap-3 rounded-2xl px-3 py-2.5"
                  style={{
                    background: index % 2 === 0 ? PAPER.muted : "transparent",
                  }}
                >
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={{ background: BRAND[700], color: "#fff" }}
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span className="min-w-0">
                    <span
                      className="block text-sm font-medium leading-snug"
                      style={{ color: INK.primary }}
                    >
                      {item.label}
                    </span>
                    {item.option ? (
                      <span
                        className="mt-0.5 block text-xs"
                        style={{ color: INK.muted }}
                      >
                        {item.option}
                      </span>
                    ) : null}
                  </span>
                </motion.li>
              ))}
            </ul>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="rounded-[28px] border p-5 sm:p-6"
          style={{ borderColor: LINE.subtle, background: PAPER.surface }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p
                className="text-[11px] font-semibold tracking-[0.16em] uppercase"
                style={{ color: BRAND[700] }}
              >
                Seminar slots
              </p>
              <h3
                className={cn(displayClass, "mt-1 text-xl font-bold")}
                style={{ color: INK.primary }}
              >
                Seat allotment
              </h3>
            </div>
            <span
              className="rounded-full px-3 py-1 text-xs font-bold tabular-nums"
              style={{ background: BRAND[50], color: BRAND[700] }}
            >
              {totalSeats} seat{totalSeats === 1 ? "" : "s"}
            </span>
          </div>

          {slotSummary.length === 0 ? (
            <p className="mt-5 text-sm" style={{ color: INK.muted }}>
              No seminar seats allotted.
            </p>
          ) : (
            <ul className="mt-5 space-y-3">
              {slotSummary.map((row, index) => (
                <motion.li
                  key={row.id}
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.03 * index }}
                  className="rounded-2xl border px-3 py-3"
                  style={{ borderColor: LINE.subtle, background: PAPER.muted }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: BRAND[50], color: BRAND[700] }}
                    >
                      <Mic2 className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm font-semibold leading-snug"
                        style={{ color: INK.primary }}
                      >
                        {row.seminarTitle}
                      </p>
                      <p className="mt-0.5 text-xs" style={{ color: INK.muted }}>
                        {row.eventTitle}
                        {row.city ? ` · ${row.city}` : ""}
                      </p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums"
                      style={{ background: BRAND[700], color: "#fff" }}
                    >
                      {row.slots}
                    </span>
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </motion.section>
      </div>
    </div>
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
