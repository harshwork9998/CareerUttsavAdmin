"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  ChevronDown,
  Clock3,
  MapPin,
  Mic2,
  Minus,
  Plus,
  User,
  Users,
} from "lucide-react";

import {
  BRAND,
  BRASS,
  INK,
  LINE,
  PAPER,
  STATUS,
  TEAL,
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

function formatTimeLabel(time: string): string {
  if (!time) return "—";
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h)) return time;
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDayLabel(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
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

  const totalAssigned = useMemo(
    () => props.assignments.reduce((s, a) => s + a.slots, 0),
    [props.assignments]
  );

  const setSlots = (eventId: string, seminarId: string, slots: number) => {
    props.setAssignments((prev) => {
      const others = prev.filter((a) => a.seminarId !== seminarId);
      if (slots <= 0) return others;
      return [...others, { eventId, seminarId, slots }];
    });
  };

  if (eventBlocks.length === 0) {
    return (
      <div
        className="rounded-[24px] border px-5 py-8 text-center"
        style={{ borderColor: LINE.subtle, background: PAPER.muted }}
      >
        <p className="text-sm font-medium" style={{ color: INK.secondary }}>
          No events selected in partnership details.
        </p>
        <p className="mt-1 text-xs" style={{ color: INK.muted }}>
          Pick events on the previous step to allot seminar seats here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[28px] border px-5 py-5 sm:px-7 sm:py-6"
        style={{
          borderColor: LINE.subtle,
          background: `radial-gradient(120% 90% at 0% 0%, ${BRAND[50]} 0%, ${PAPER.surface} 58%)`,
        }}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl space-y-2">
            <p
              className="text-[11px] font-semibold tracking-[0.18em] uppercase"
              style={{ color: BRAND[700] }}
            >
              Seminar slots
            </p>
            <h3
              className={cn(displayClass, "text-2xl font-bold sm:text-3xl")}
              style={{ color: INK.primary }}
            >
              Allot panelist seats
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: INK.secondary }}>
              Optional — leave at zero if this partner isn’t speaking. Seats
              already taken by other partners stay locked.
            </p>
          </div>
          <div
            className="rounded-2xl border px-4 py-3 text-right"
            style={{ borderColor: LINE.subtle, background: PAPER.surface }}
          >
            <p
              className="text-[11px] font-semibold tracking-[0.14em] uppercase"
              style={{ color: INK.muted }}
            >
              Total reserved
            </p>
            <p
              className={cn(displayClass, "mt-0.5 text-3xl font-bold tabular-nums")}
              style={{ color: BRAND[700] }}
            >
              {totalAssigned}
            </p>
            <p className="text-xs" style={{ color: INK.muted }}>
              seat{totalAssigned === 1 ? "" : "s"} across events
            </p>
          </div>
        </div>
      </motion.header>

      {eventBlocks.map((event, eventIndex) => {
        const mineOnEvent = props.assignments
          .filter((a) => a.eventId === event.id)
          .reduce((s, a) => s + a.slots, 0);
        const eventError = props.errors[`event-${event.id}`];
        const seminarCount = event.seminars?.length ?? 0;

        return (
          <motion.section
            key={event.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: eventIndex * 0.06,
              duration: 0.35,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="space-y-4"
          >
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3.5"
              style={{
                borderColor: LINE.subtle,
                background: PAPER.muted,
              }}
            >
              <div className="flex min-w-0 items-start gap-3">
                <div
                  className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: BRAND[700], color: "#fff" }}
                >
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide"
                      style={{ background: BRASS[100], color: BRASS[700] }}
                    >
                      {event.city}
                    </span>
                    <span className="text-xs" style={{ color: INK.muted }}>
                      {seminarCount} seminar{seminarCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <h4
                    className={cn(
                      displayClass,
                      "mt-1 truncate text-xl font-bold tracking-tight"
                    )}
                    style={{ color: INK.primary }}
                  >
                    {event.title}
                  </h4>
                </div>
              </div>
              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold"
                style={{
                  background: mineOnEvent > 0 ? STATUS.successSoft : PAPER.surface,
                  color: mineOnEvent > 0 ? STATUS.success : INK.secondary,
                  border: `1px solid ${mineOnEvent > 0 ? "transparent" : LINE.subtle}`,
                }}
              >
                <Users className="h-3.5 w-3.5" />
                {mineOnEvent === 0
                  ? "No seats yet"
                  : `${mineOnEvent} seat${mineOnEvent === 1 ? "" : "s"}`}
              </div>
            </div>

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

  const bump = (delta: number) => {
    const next = Math.min(maxMine, Math.max(0, mine + delta));
    onAssign(next);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[26px] border"
      style={{
        borderColor: mine > 0 ? `${BRAND[700]}55` : LINE.subtle,
        background: PAPER.surface,
        boxShadow:
          mine > 0
            ? `0 20px 44px -30px ${BRAND[700]}88`
            : "0 1px 2px rgba(18,35,63,0.04), 0 8px 24px rgba(18,35,63,0.04)",
      }}
    >
      {mine > 0 ? (
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{
            background: `linear-gradient(90deg, ${BRAND[700]}, ${TEAL[500]})`,
          }}
        />
      ) : null}

      <div className="grid gap-0 lg:grid-cols-[1fr_220px]">
        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: mine > 0 ? BRAND[50] : PAPER.muted,
                color: mine > 0 ? BRAND[700] : INK.secondary,
              }}
            >
              <Mic2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-base font-semibold leading-snug sm:text-lg"
                style={{ color: INK.primary }}
              >
                {title}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <MetaChip icon={CalendarDays} label={formatDayLabel(date)} />
                <MetaChip
                  icon={Clock3}
                  label={`${formatTimeLabel(startTime)} – ${formatTimeLabel(endTime)}`}
                />
                <MetaChip icon={MapPin} label={`Audi ${hall}`} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p
                className="text-[11px] font-semibold tracking-[0.14em] uppercase"
                style={{ color: INK.muted }}
              >
                Seat map · {total} total
              </p>
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium">
                <LegendDot tone="mine" label={`${mine} yours`} />
                <LegendDot tone="taken" label={`${taken} taken`} />
                <LegendDot tone="open" label={`${open} open`} />
              </div>
            </div>

            <SeatMap
              total={total}
              mine={mine}
              taken={taken}
              onAssign={onAssign}
            />

            {taken > 0 ? (
              <div>
                <button
                  type="button"
                  onClick={() => setShowPartners((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-semibold"
                  style={{ color: BRAND[700] }}
                >
                  Who holds the other seats
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform duration-200",
                      showPartners && "rotate-180"
                    )}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {showPartners ? (
                    <motion.ul
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="overflow-hidden"
                    >
                      <div
                        className="mt-2 space-y-1.5 rounded-2xl px-3 py-2.5"
                        style={{ background: PAPER.muted }}
                      >
                        {others.map((o) => (
                          <li
                            key={o.partnerId}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <span
                              className="truncate font-medium"
                              style={{ color: INK.primary }}
                            >
                              {o.name}
                            </span>
                            <span
                              className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
                              style={{
                                background: PAPER.surface,
                                color: INK.secondary,
                                border: `1px solid ${LINE.subtle}`,
                              }}
                            >
                              {o.slots}
                            </span>
                          </li>
                        ))}
                      </div>
                    </motion.ul>
                  ) : null}
                </AnimatePresence>
              </div>
            ) : null}
          </div>
        </div>

        <div
          className="flex flex-col justify-center gap-4 border-t px-5 py-5 lg:border-l lg:border-t-0"
          style={{
            borderColor: LINE.subtle,
            background:
              mine > 0
                ? `linear-gradient(180deg, ${BRAND[50]} 0%, ${PAPER.surface} 100%)`
                : PAPER.muted,
          }}
        >
          <div>
            <p
              className="text-[11px] font-semibold tracking-[0.14em] uppercase"
              style={{ color: INK.muted }}
            >
              Your seats
            </p>
            {fullyBooked ? (
              <p
                className="mt-2 text-sm font-semibold"
                style={{ color: INK.secondary }}
              >
                Fully booked
              </p>
            ) : (
              <p
                className={cn(
                  displayClass,
                  "mt-1 text-4xl font-bold tabular-nums leading-none"
                )}
                style={{ color: BRAND[700] }}
              >
                {mine}
              </p>
            )}
          </div>

          {!fullyBooked ? (
            <div className="flex items-center gap-2">
              <StepperButton
                label="Decrease seats"
                onClick={() => bump(-1)}
                disabled={mine <= 0}
              >
                <Minus className="h-4 w-4" />
              </StepperButton>
              <div
                className="flex h-12 flex-1 items-center justify-center rounded-2xl border text-sm font-semibold tabular-nums"
                style={{
                  borderColor: LINE.subtle,
                  background: PAPER.surface,
                  color: INK.primary,
                }}
              >
                {mine} / {maxMine}
              </div>
              <StepperButton
                label="Increase seats"
                onClick={() => bump(1)}
                disabled={mine >= maxMine}
              >
                <Plus className="h-4 w-4" />
              </StepperButton>
            </div>
          ) : null}

          {!fullyBooked ? (
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: maxMine + 1 }, (_, n) => n).map((n) => {
                const selected = mine === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onAssign(n)}
                    className={cn(
                      "flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-bold tabular-nums transition-all",
                      selected && "text-white"
                    )}
                    style={{
                      background: selected ? BRAND[700] : PAPER.surface,
                      color: selected ? "#fff" : INK.secondary,
                      border: selected ? "none" : `1px solid ${LINE.subtle}`,
                      boxShadow: selected
                        ? `0 0 0 3px ${BRAND[100]}`
                        : undefined,
                    }}
                    aria-pressed={selected}
                    aria-label={`Assign ${n} seat${n === 1 ? "" : "s"}`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          ) : null}

          <p className="text-xs leading-snug" style={{ color: INK.muted }}>
            {fullyBooked
              ? "No seats left on this panel."
              : mine > 0
                ? `${mine} reserved for this partner`
                : `Up to ${maxMine} still open`}
          </p>
        </div>
      </div>
    </motion.article>
  );
}

function MetaChip({
  icon: Icon,
  label,
}: {
  icon: typeof CalendarDays;
  label: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{
        background: PAPER.muted,
        color: INK.secondary,
        border: `1px solid ${LINE.subtle}`,
      }}
    >
      <Icon className="h-3 w-3 shrink-0" style={{ color: BRAND[700] }} />
      {label}
    </span>
  );
}

function LegendDot({
  tone,
  label,
}: {
  tone: "mine" | "taken" | "open";
  label: string;
}) {
  const style =
    tone === "mine"
      ? { background: BRAND[700], color: "#fff", boxShadow: undefined }
      : tone === "taken"
        ? { background: "#D1D5DC", color: "#8B93A1", boxShadow: undefined }
        : {
            background: "#fff",
            color: BRAND[700],
            boxShadow: `inset 0 0 0 1.5px ${BRAND[700]}`,
          };

  return (
    <span className="inline-flex items-center gap-1.5" style={{ color: INK.secondary }}>
      <span
        className="flex h-4 w-4 items-center justify-center rounded-full"
        style={style}
      >
        <User className="h-2.5 w-2.5" strokeWidth={2.5} />
      </span>
      {label}
    </span>
  );
}

function SeatMap({
  total,
  mine,
  taken,
  onAssign,
}: {
  total: number;
  mine: number;
  taken: number;
  onAssign: (slots: number) => void;
}) {
  if (total <= 0) return null;

  return (
    <div
      className="rounded-2xl border px-3.5 py-3.5"
      style={{ borderColor: LINE.subtle, background: PAPER.muted }}
    >
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: total }, (_, i) => {
          const seatNo = i + 1;
          const isBlocked = i < taken;
          const isMine = !isBlocked && i < taken + mine;
          const availableIndex = i - taken;

          return (
            <motion.button
              key={i}
              type="button"
              disabled={isBlocked}
              whileHover={isBlocked ? undefined : { scale: 1.05 }}
              whileTap={isBlocked ? undefined : { scale: 0.94 }}
              onClick={() => {
                if (isBlocked) return;
                const desired = availableIndex + 1;
                onAssign(mine === desired ? availableIndex : desired);
              }}
              aria-label={
                isBlocked
                  ? `Seat ${seatNo} taken`
                  : isMine
                    ? `Seat ${seatNo} selected`
                    : `Take seat ${seatNo}`
              }
              className={cn(
                "flex flex-col items-center gap-1",
                isBlocked ? "cursor-not-allowed" : "cursor-pointer"
              )}
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full transition-[box-shadow,background-color]"
                style={{
                  background: isBlocked
                    ? "#D1D5DC"
                    : isMine
                      ? BRAND[700]
                      : "#FFFFFF",
                  color: isBlocked
                    ? "#8B93A1"
                    : isMine
                      ? "#FFFFFF"
                      : BRAND[700],
                  boxShadow: isBlocked
                    ? "none"
                    : isMine
                      ? `0 0 0 3px ${BRAND[100]}`
                      : `inset 0 0 0 2px ${BRAND[700]}`,
                  opacity: isBlocked ? 0.85 : 1,
                }}
              >
                <User className="h-5 w-5" strokeWidth={isMine ? 2.25 : 2} />
              </span>
              <span
                className="text-[11px] font-bold tabular-nums leading-none"
                style={{
                  color: isBlocked
                    ? "#9AA3B0"
                    : isMine
                      ? BRAND[700]
                      : INK.secondary,
                }}
              >
                {seatNo}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function StepperButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-12 w-12 items-center justify-center rounded-2xl border transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
      style={{
        borderColor: LINE.subtle,
        background: PAPER.surface,
        color: BRAND[700],
      }}
    >
      {children}
    </button>
  );
}
