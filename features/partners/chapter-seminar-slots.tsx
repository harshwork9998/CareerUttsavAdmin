"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

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
  Partner,
  PartnerSeminarSlotAssignment,
} from "@/types";

type Occupant = { partnerId: string; name: string; slots: number };

function slotsForSeminar(
  assignments: PartnerSeminarSlotAssignment[] | undefined,
  seminarId: string
) {
  return (assignments ?? [])
    .filter((a) => a.seminarId === seminarId)
    .reduce((sum, a) => sum + a.slots, 0);
}

function occupantsForSeminar(
  partners: Partner[],
  seminarId: string,
  excludePartnerId?: string
): Occupant[] {
  return partners
    .filter((p) => p.id !== excludePartnerId)
    .map((p) => ({
      partnerId: p.id,
      name: p.name,
      slots: slotsForSeminar(p.seminarSlotAssignments, seminarId),
    }))
    .filter((o) => o.slots > 0);
}

export function ChapterSeminarSlots(props: {
  partnerId: string;
  eventIds: string[];
  events: Event[];
  allPartners: Partner[];
  assignments: PartnerSeminarSlotAssignment[];
  setAssignments: (
    v:
      | PartnerSeminarSlotAssignment[]
      | ((p: PartnerSeminarSlotAssignment[]) => PartnerSeminarSlotAssignment[])
  ) => void;
  errors: Record<string, string>;
}) {
  const eventBlocks = useMemo(() => {
    return props.eventIds
      .map((id) => props.events.find((e) => e.id === id))
      .filter((e): e is Event => Boolean(e));
  }, [props.eventIds, props.events]);

  const setSlots = (eventId: string, seminarId: string, slots: number) => {
    props.setAssignments((prev) => {
      const others = prev.filter((a) => a.seminarId !== seminarId);
      if (slots <= 0) return others;
      return [...others, { eventId, seminarId, slots }];
    });
  };

  if (eventBlocks.length === 0) {
    return (
      <p className="text-sm" style={{ color: INK.muted }}>
        No events selected in partnership details.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {eventBlocks.map((event, eventIndex) => {
        const mineOnEvent = props.assignments
          .filter((a) => a.eventId === event.id)
          .reduce((s, a) => s + a.slots, 0);
        const eventError = props.errors[`event-${event.id}`];

        return (
          <motion.section
            key={event.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: eventIndex * 0.06, duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >
            <header className="flex flex-wrap items-end justify-between gap-3 px-1">
              <div className="space-y-2">
                <span
                  className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide"
                  style={{ background: BRAND[50], color: BRAND[700] }}
                >
                  {event.city}
                </span>
                <h3
                  className={cn(displayClass, "text-2xl font-bold tracking-tight")}
                  style={{ color: INK.primary }}
                >
                  {event.title}
                </h3>
              </div>
              <p className="pb-1 text-sm" style={{ color: INK.secondary }}>
                {mineOnEvent === 0 ? (
                  "No seats assigned yet"
                ) : (
                  <>
                    <span className="font-semibold" style={{ color: BRAND[700] }}>
                      {mineOnEvent}
                    </span>{" "}
                    seat{mineOnEvent === 1 ? "" : "s"} assigned
                  </>
                )}
              </p>
            </header>

            <div className="space-y-3">
              {event.seminars.map((seminar, seminarIndex) => {
                const total = seminar.panelistSlots;
                const mine = slotsForSeminar(props.assignments, seminar.id);
                const others = occupantsForSeminar(
                  props.allPartners,
                  seminar.id,
                  props.partnerId
                );
                const taken = others.reduce((s, o) => s + o.slots, 0);
                const open = Math.max(0, total - taken - mine);
                const maxMine = Math.max(0, total - taken);

                return (
                  <SeminarCard
                    key={seminar.id}
                    index={seminarIndex}
                    title={seminar.title}
                    date={seminar.date}
                    startTime={seminar.startTime}
                    endTime={seminar.endTime}
                    hall={seminar.hall}
                    total={total}
                    mine={mine}
                    taken={taken}
                    open={open}
                    maxMine={maxMine}
                    others={others}
                    onAssign={(next) => setSlots(event.id, seminar.id, next)}
                  />
                );
              })}
            </div>

            {eventError ? (
              <p className="px-1 text-xs text-destructive">{eventError}</p>
            ) : null}
          </motion.section>
        );
      })}
    </div>
  );
}

function SeminarCard({
  index,
  title,
  date,
  startTime,
  endTime,
  hall,
  total,
  mine,
  taken,
  open,
  maxMine,
  others,
  onAssign,
}: {
  index: number;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  hall: number;
  total: number;
  mine: number;
  taken: number;
  open: number;
  maxMine: number;
  others: Occupant[];
  onAssign: (slots: number) => void;
}) {
  const [showPartners, setShowPartners] = useState(false);
  const fullyBooked = maxMine === 0 && mine === 0;
  const choices = Array.from({ length: maxMine + 1 }, (_, i) => i);

  const takenPct = total > 0 ? (taken / total) * 100 : 0;
  const minePct = total > 0 ? (mine / total) * 100 : 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.28 }}
      className="relative overflow-hidden rounded-3xl border p-5 sm:p-6"
      style={{
        borderColor: mine > 0 ? BRAND[700] : LINE.subtle,
        background:
          mine > 0
            ? `linear-gradient(135deg, ${BRAND[50]} 0%, ${PAPER.surface} 48%)`
            : PAPER.surface,
        boxShadow: mine > 0 ? `0 18px 40px -28px ${BRAND[700]}66` : "none",
      }}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-1.5">
            <p
              className="text-base font-semibold leading-snug sm:text-lg"
              style={{ color: INK.primary }}
            >
              {title}
            </p>
            <p className="text-xs" style={{ color: INK.muted }}>
              {formatSeminarMeta(date, startTime, endTime, hall)}
              {" · "}
              {total} panelist seat{total === 1 ? "" : "s"}
            </p>
          </div>

          <div className="space-y-2">
            <div
              className="flex h-1.5 overflow-hidden rounded-full"
              style={{ background: "#E8EEF5" }}
              aria-hidden
            >
              {taken > 0 ? (
                <motion.div
                  className="h-full"
                  initial={false}
                  animate={{ width: `${takenPct}%` }}
                  transition={{ duration: 0.35 }}
                  style={{ background: "#A8B4C4" }}
                />
              ) : null}
              {mine > 0 ? (
                <motion.div
                  className="h-full"
                  initial={false}
                  animate={{ width: `${minePct}%` }}
                  transition={{ duration: 0.35 }}
                  style={{ background: BRAND[700] }}
                />
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span style={{ color: INK.secondary }}>
                <span className="font-semibold tabular-nums" style={{ color: INK.primary }}>
                  {open}
                </span>{" "}
                open
              </span>
              <span style={{ color: LINE.strong }}>·</span>
              <span style={{ color: INK.secondary }}>
                <span className="font-semibold tabular-nums" style={{ color: INK.primary }}>
                  {taken}
                </span>{" "}
                taken
                {taken > 0 ? (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={() => setShowPartners((v) => !v)}
                      className="inline-flex items-center gap-0.5 font-semibold"
                      style={{ color: BRAND[700] }}
                    >
                      by others
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform duration-200",
                          showPartners && "rotate-180"
                        )}
                      />
                    </button>
                  </>
                ) : null}
              </span>
            </div>

            <AnimatePresence initial={false}>
              {showPartners && taken > 0 ? (
                <motion.ul
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div
                    className="mt-1 space-y-1.5 rounded-2xl px-3 py-2.5"
                    style={{ background: PAPER.muted }}
                  >
                    {others.map((o) => (
                      <li
                        key={o.partnerId}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="truncate font-medium" style={{ color: INK.primary }}>
                          {o.name}
                        </span>
                        <span className="shrink-0 tabular-nums" style={{ color: INK.muted }}>
                          {o.slots}
                        </span>
                      </li>
                    ))}
                  </div>
                </motion.ul>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        <div
          className="flex w-full flex-col justify-center gap-3 rounded-2xl border px-4 py-4 lg:w-[240px] lg:shrink-0"
          style={{
            borderColor: LINE.subtle,
            background: PAPER.surface,
          }}
        >
          <div>
            <p
              className="text-[11px] font-semibold tracking-[0.14em] uppercase"
              style={{ color: INK.muted }}
            >
              Seats for this partner
            </p>
            {fullyBooked ? (
              <p className="mt-2 text-sm font-medium" style={{ color: INK.secondary }}>
                Fully booked
              </p>
            ) : null}
          </div>

          {!fullyBooked ? (
            <div className="flex flex-wrap gap-2">
              {choices.map((n) => {
                const selected = mine === n;
                return (
                  <motion.button
                    key={n}
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={() => onAssign(n)}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-bold tabular-nums transition-colors",
                      selected ? "text-white" : "hover:bg-black/[0.03]"
                    )}
                    style={{
                      background: selected ? BRAND[700] : PAPER.muted,
                      color: selected ? "#fff" : INK.primary,
                      boxShadow: selected ? `0 0 0 3px ${BRAND[50]}` : undefined,
                      border: selected ? "none" : `1px solid ${LINE.subtle}`,
                    }}
                    aria-pressed={selected}
                    aria-label={`Assign ${n} seat${n === 1 ? "" : "s"}`}
                  >
                    {n}
                  </motion.button>
                );
              })}
            </div>
          ) : null}

          {mine > 0 ? (
            <p className="text-xs font-medium" style={{ color: BRAND[700] }}>
              {mine} seat{mine === 1 ? "" : "s"} reserved
            </p>
          ) : !fullyBooked ? (
            <p className="text-xs" style={{ color: INK.muted }}>
              Up to {maxMine} available
            </p>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}

function formatSeminarMeta(
  date: string,
  startTime: string,
  endTime: string,
  hall: number
) {
  const d = new Date(`${date}T12:00:00`);
  const day = Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      });
  return `${day} · ${startTime}–${endTime} · Audi ${hall}`;
}
