"use client";

import { useMemo, useRef, useState, type Ref } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarClock,
  CheckCircle2,
  MessageSquare,
  Pencil,
  Plus,
  Sparkles,
  XCircle,
} from "lucide-react";

import {
  DateField,
  TimeField,
  formatDisplayDate,
  formatDisplayTime,
} from "@/features/events/event-datetime-fields";
import {
  BRAND,
  INK,
  LINE,
  PAPER,
  STATUS,
  displayClass,
} from "@/features/dashboard/dashboard-ui";
import { useTimelineSpine } from "@/lib/use-timeline-spine";
import {
  MEETING_OUTCOME_LABELS,
  combineDateAndTime,
  formatFollowUpDateTime,
  formatMeetingDateTime,
  getPartnerMeetings,
  splitDateTime,
} from "@/lib/partner-meetings";
import { cn, generateId } from "@/lib/utils";
import type {
  Partner,
  PartnerMeetingLog,
  PartnerMeetingOutcome,
} from "@/types";
import { Button } from "@/components/ui/button";
import {
  FieldError,
  fieldErrorClass,
  fieldErrorSurfaceClass,
  applyFormErrors,
} from "@/components/shared/form-field-error";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const OUTCOMES: PartnerMeetingOutcome[] = ["won", "in_discussion", "lost"];

function outcomeMeta(outcome: PartnerMeetingOutcome) {
  switch (outcome) {
    case "won":
      return {
        icon: CheckCircle2,
        label: MEETING_OUTCOME_LABELS.won,
        bg: STATUS.successSoft,
        color: STATUS.success,
        ring: "rgba(47,107,79,0.35)",
      };
    case "lost":
      return {
        icon: XCircle,
        label: MEETING_OUTCOME_LABELS.lost,
        bg: "rgba(163,59,59,0.14)",
        color: "#A33B3B",
        ring: "rgba(163,59,59,0.35)",
      };
    default:
      return {
        icon: MessageSquare,
        label: MEETING_OUTCOME_LABELS.in_discussion,
        bg: "rgba(176,125,42,0.16)",
        color: "#8A6A2F",
        ring: "rgba(176,125,42,0.35)",
      };
  }
}

function MeetingOutcomeBadge({
  outcome,
}: {
  outcome: PartnerMeetingOutcome;
}) {
  const meta = outcomeMeta(outcome);
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: meta.bg, color: meta.color }}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function MeetingTimelineCard({
  meeting,
  onEdit,
  dotRef,
}: {
  meeting: PartnerMeetingLog;
  onEdit: () => void;
  dotRef?: Ref<HTMLSpanElement>;
}) {
  const { date, time } = splitDateTime(meeting.meetingAt);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative z-0 pl-8 pb-4 last:pb-0"
    >
      <span
        ref={dotRef}
        className="absolute left-0 top-0 z-[1] flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white"
        style={{ borderColor: meeting.outcome ? BRAND[700] : LINE.strong }}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{
            background: meeting.outcome ? BRAND[700] : LINE.strong,
          }}
        />
      </span>

      <div
        className="rounded-2xl border p-4 shadow-sm"
        style={{
          borderColor: LINE.subtle,
          background: `linear-gradient(135deg, ${PAPER.surface} 0%, ${PAPER.muted} 100%)`,
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p
              className={cn(displayClass, "text-base font-semibold")}
              style={{ color: INK.primary }}
            >
              {formatMeetingDateTime(meeting.meetingAt)}
            </p>
            <p className="text-xs" style={{ color: INK.muted }}>
              {formatDisplayDate(date)}
              {time ? ` · ${formatDisplayTime(time)}` : ""}
            </p>
          </div>
          {meeting.outcome ? (
            <MeetingOutcomeBadge outcome={meeting.outcome} />
          ) : (
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ background: "rgba(31,56,100,0.1)", color: INK.secondary }}
            >
              Outcome pending
            </span>
          )}
        </div>

        {meeting.notes ? (
          <p
            className="mt-3 text-sm leading-relaxed"
            style={{ color: INK.secondary }}
          >
            {meeting.notes}
          </p>
        ) : null}

        {meeting.followUpNotes || meeting.followUpAt ? (
          <div
            className="mt-3 rounded-xl border px-3 py-2.5"
            style={{ borderColor: LINE.subtle, background: BRAND[50] }}
          >
            <p
              className="text-[11px] font-semibold tracking-wide uppercase"
              style={{ color: BRAND[700] }}
            >
              Follow-up
            </p>
            {meeting.followUpNotes ? (
              <p className="mt-1 text-sm" style={{ color: INK.secondary }}>
                {meeting.followUpNotes}
              </p>
            ) : null}
            {meeting.followUpAt ? (
              <p
                className="mt-1 flex items-center gap-1.5 text-xs font-medium"
                style={{ color: INK.primary }}
              >
                <CalendarClock
                  className="h-3.5 w-3.5"
                  style={{ color: BRAND[700] }}
                />
                {formatFollowUpDateTime(meeting.followUpAt)}
              </p>
            ) : null}
          </div>
        ) : null}

        {meeting.lostReason ? (
          <div
            className="mt-3 rounded-xl border px-3 py-2.5"
            style={{
              borderColor: "rgba(163,59,59,0.2)",
              background: "rgba(163,59,59,0.06)",
            }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-destructive">
              Reason deal lost
            </p>
            <p className="mt-1 text-sm" style={{ color: INK.secondary }}>
              {meeting.lostReason}
            </p>
          </div>
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 gap-1.5 rounded-full"
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" />
          {meeting.outcome ? "Edit meeting" : "Edit / record outcome"}
        </Button>
      </div>
    </motion.li>
  );
}

type MeetingFormState = {
  meetingDate: string;
  meetingTime: string;
  notes: string;
  outcome: PartnerMeetingOutcome | "";
  followUpNotes: string;
  followUpDate: string;
  followUpTime: string;
  lostReason: string;
};

const emptyForm = (): MeetingFormState => ({
  meetingDate: "",
  meetingTime: "10:00",
  notes: "",
  outcome: "",
  followUpNotes: "",
  followUpDate: "",
  followUpTime: "11:00",
  lostReason: "",
});

export function ChapterMeetings({
  partner,
  onPersist,
  saving,
}: {
  partner: Partner;
  onPersist: (
    meetings: PartnerMeetingLog[],
    meta: {
      outcome?: PartnerMeetingOutcome;
      lostReason?: string;
      editingMeetingId?: string | null;
    }
  ) => void;
  saving: boolean;
}) {
  const meetings = useMemo(() => getPartnerMeetings(partner), [partner]);
  const containerRef = useRef<HTMLDivElement>(null);
  const firstDotRef = useRef<HTMLSpanElement>(null);
  const lastDotRef = useRef<HTMLSpanElement>(null);
  const spineStyle = useTimelineSpine(containerRef, firstDotRef, lastDotRef, [
    meetings.length,
    meetings.map((meeting) => meeting.id).join(","),
  ]);
  const [composerOpen, setComposerOpen] = useState(meetings.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MeetingFormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setErrors({});
  };

  const openComposer = () => {
    resetForm();
    setComposerOpen(true);
  };

  const openEditMeeting = (meeting: PartnerMeetingLog) => {
    const { date, time } = splitDateTime(meeting.meetingAt);
    const follow = splitDateTime(meeting.followUpAt ?? "");
    setEditingId(meeting.id);
    setForm({
      meetingDate: date,
      meetingTime: time || "10:00",
      notes: meeting.notes ?? "",
      outcome: meeting.outcome ?? "",
      followUpNotes: meeting.followUpNotes ?? "",
      followUpDate: follow.date,
      followUpTime: follow.time || "11:00",
      lostReason: meeting.lostReason ?? "",
    });
    setComposerOpen(true);
    setErrors({});
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.meetingDate) next.meetingDate = "Meeting date is required";
    if (form.outcome === "in_discussion") {
      if (!form.followUpNotes.trim()) {
        next.followUpNotes = "Follow-up notes are required";
      }
      if (!form.followUpDate) next.followUpDate = "Follow-up date is required";
    }
    if (form.outcome === "lost" && !form.lostReason.trim()) {
      next.lostReason = "Reason is required when deal is lost";
    }
    if (applyFormErrors(setErrors, next)) return false;
    return true;
  };

  const handleSave = () => {
    if (!validate()) return;

    const now = new Date().toISOString();
    const meetingAt = combineDateAndTime(form.meetingDate, form.meetingTime);
    const followUpAt =
      form.outcome === "in_discussion" || form.outcome === "lost"
        ? form.followUpDate
          ? combineDateAndTime(form.followUpDate, form.followUpTime)
          : undefined
        : undefined;

    const payload: PartnerMeetingLog = {
      id: editingId ?? generateId(),
      meetingAt,
      notes: form.notes.trim() || undefined,
      outcome: form.outcome || undefined,
      followUpNotes:
        form.outcome === "in_discussion"
          ? form.followUpNotes.trim()
          : form.outcome === "lost"
            ? form.followUpNotes.trim() || undefined
            : undefined,
      followUpAt,
      lostReason:
        form.outcome === "lost" ? form.lostReason.trim() : undefined,
      createdAt: editingId
        ? meetings.find((m) => m.id === editingId)?.createdAt ?? now
        : now,
      updatedAt: now,
    };

    const nextMeetings = editingId
      ? meetings.map((m) => (m.id === editingId ? payload : m))
      : [payload, ...meetings];

    onPersist(nextMeetings, {
      outcome: form.outcome || undefined,
      lostReason: form.outcome === "lost" ? form.lostReason.trim() : undefined,
      editingMeetingId: editingId,
    });

    resetForm();
    setComposerOpen(false);
  };

  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl border p-4 sm:p-5"
        style={{
          borderColor: LINE.subtle,
          background: `linear-gradient(135deg, ${BRAND[50]} 0%, ${PAPER.surface} 55%, ${PAPER.muted} 100%)`,
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p
              className="flex items-center gap-2 text-sm font-semibold"
              style={{ color: BRAND[700] }}
            >
              <Sparkles className="h-4 w-4" />
              Meeting log
            </p>
            <p className="mt-1 max-w-xl text-sm" style={{ color: INK.secondary }}>
              Log every touchpoint, record the outcome, and schedule follow-ups.
              Deal won moves the partnership to the next stage.
            </p>
          </div>
          {!composerOpen ? (
            <Button
              type="button"
              onClick={openComposer}
              className="gap-2 rounded-full text-white"
              style={{ backgroundColor: BRAND[700] }}
            >
              <Plus className="h-4 w-4" />
              Log meeting
            </Button>
          ) : null}
        </div>
      </div>

      {meetings.length > 0 ? (
        <div ref={containerRef} className="relative isolate">
          {spineStyle && meetings.length > 1 ? (
            <span
              className="pointer-events-none absolute left-3 -z-10 w-px -translate-x-1/2"
              style={{
                top: spineStyle.top,
                height: spineStyle.height,
                background: LINE.subtle,
              }}
              aria-hidden
            />
          ) : null}
          <ol>
            {meetings.map((meeting, index) => (
              <MeetingTimelineCard
                key={meeting.id}
                meeting={meeting}
                dotRef={
                  index === 0
                    ? firstDotRef
                    : index === meetings.length - 1
                      ? lastDotRef
                      : undefined
                }
                onEdit={() => openEditMeeting(meeting)}
              />
            ))}
          </ol>
        </div>
      ) : (
        <div
          className="rounded-2xl border border-dashed px-6 py-10 text-center"
          style={{ borderColor: LINE.strong, background: PAPER.muted }}
        >
          <p className="text-sm font-medium" style={{ color: INK.primary }}>
            No meetings logged yet
          </p>
          <p className="mt-1 text-sm" style={{ color: INK.muted }}>
            Add the first meeting to start tracking outcomes and follow-ups.
          </p>
        </div>
      )}

      <AnimatePresence initial={false}>
        {composerOpen ? (
          <motion.div
            key="composer"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className="rounded-2xl border p-5 sm:p-6"
              style={{
                borderColor: LINE.subtle,
                background: PAPER.surface,
                boxShadow: "0 20px 50px -40px rgba(18, 35, 63, 0.35)",
              }}
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <h3
                  className={cn(displayClass, "text-lg font-bold")}
                  style={{ color: INK.primary }}
                >
                  {editingId ? "Edit meeting" : "Log a meeting"}
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    resetForm();
                    setComposerOpen(false);
                  }}
                >
                  Cancel
                </Button>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-1.5" data-field-error={errors.meetingDate ? "true" : undefined}>
                  <Label>Meeting date</Label>
                  <DateField
                    value={form.meetingDate}
                    onChange={(v) => setForm((f) => ({ ...f, meetingDate: v }))}
                    error={errors.meetingDate}
                  />
                  <FieldError message={errors.meetingDate} />
                </div>
                <div className="space-y-1.5">
                  <Label>Meeting time</Label>
                  <TimeField
                    value={form.meetingTime}
                    onChange={(v) => setForm((f) => ({ ...f, meetingTime: v }))}
                  />
                </div>
                <div className="space-y-1.5 lg:col-span-2">
                  <Label>
                    Meeting notes{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <Textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    placeholder="Who attended, topics discussed, interest level…"
                  />
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <Label>Meeting outcome</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {OUTCOMES.map((outcome) => {
                    const meta = outcomeMeta(outcome);
                    const Icon = meta.icon;
                    const selected = form.outcome === outcome;
                    return (
                      <button
                        key={outcome}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            outcome: selected ? "" : outcome,
                          }))
                        }
                        className={cn(
                          "flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-all",
                          selected && "ring-2"
                        )}
                        style={{
                          borderColor: selected ? meta.ring : LINE.subtle,
                          background: selected ? meta.bg : PAPER.muted,
                          color: selected ? meta.color : INK.secondary,
                          boxShadow: selected
                            ? `0 0 0 3px ${meta.ring}`
                            : undefined,
                        }}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <AnimatePresence initial={false}>
                {form.outcome === "in_discussion" ? (
                  <motion.div
                    key="discussion"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className={fieldErrorSurfaceClass(
                      errors.followUpNotes || errors.followUpDate,
                      "mt-5 grid gap-4 rounded-xl border p-4 lg:grid-cols-2"
                    )}
                    style={
                      errors.followUpNotes || errors.followUpDate
                        ? undefined
                        : { borderColor: LINE.subtle, background: BRAND[50] }
                    }
                    data-field-error={
                      errors.followUpNotes || errors.followUpDate
                        ? "true"
                        : undefined
                    }
                  >
                    <div className="space-y-1.5 lg:col-span-2">
                      <Label>Follow-up notes</Label>
                      <Textarea
                        rows={3}
                        className={fieldErrorClass(errors.followUpNotes)}
                        aria-invalid={Boolean(errors.followUpNotes)}
                        value={form.followUpNotes}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            followUpNotes: e.target.value,
                          }))
                        }
                        placeholder="What to cover on the next call…"
                      />
                      <FieldError message={errors.followUpNotes} />
                    </div>
                    <div className="space-y-1.5" data-field-error={errors.followUpDate ? "true" : undefined}>
                      <Label>Next follow-up date</Label>
                      <DateField
                        value={form.followUpDate}
                        onChange={(v) =>
                          setForm((f) => ({ ...f, followUpDate: v }))
                        }
                        error={errors.followUpDate}
                      />
                      <FieldError message={errors.followUpDate} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Next follow-up time</Label>
                      <TimeField
                        value={form.followUpTime}
                        onChange={(v) =>
                          setForm((f) => ({ ...f, followUpTime: v }))
                        }
                      />
                    </div>
                  </motion.div>
                ) : null}

                {form.outcome === "lost" ? (
                  <motion.div
                    key="lost"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className={fieldErrorSurfaceClass(
                      errors.lostReason,
                      "mt-5 space-y-4 rounded-xl border p-4"
                    )}
                    style={
                      errors.lostReason
                        ? undefined
                        : {
                            borderColor: "rgba(163,59,59,0.2)",
                            background: "rgba(163,59,59,0.05)",
                          }
                    }
                    data-field-error={errors.lostReason ? "true" : undefined}
                  >
                    <div className="space-y-1.5">
                      <Label>Reason deal lost</Label>
                      <Textarea
                        rows={3}
                        className={fieldErrorClass(errors.lostReason)}
                        aria-invalid={Boolean(errors.lostReason)}
                        value={form.lostReason}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            lostReason: e.target.value,
                          }))
                        }
                        placeholder="Budget, timing, competing event…"
                      />
                      <FieldError message={errors.lostReason} />
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-1.5 lg:col-span-2">
                        <Label>
                          Follow-up notes{" "}
                          <span className="font-normal text-muted-foreground">
                            (optional)
                          </span>
                        </Label>
                        <Textarea
                          rows={2}
                          value={form.followUpNotes}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              followUpNotes: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Optional follow-up date</Label>
                        <DateField
                          value={form.followUpDate}
                          onChange={(v) =>
                            setForm((f) => ({ ...f, followUpDate: v }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Optional follow-up time</Label>
                        <TimeField
                          value={form.followUpTime}
                          onChange={(v) =>
                            setForm((f) => ({ ...f, followUpTime: v }))
                          }
                        />
                      </div>
                    </div>
                  </motion.div>
                ) : null}

                {form.outcome === "won" ? (
                  <motion.div
                    key="won"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="mt-5 rounded-xl border px-4 py-3 text-sm"
                    style={{
                      borderColor: "rgba(47,107,79,0.25)",
                      background: STATUS.successSoft,
                      color: STATUS.success,
                    }}
                  >
                    Saving will mark the deal as won and unlock partnership
                    details (next stage).
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div className="mt-6 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    resetForm();
                    setComposerOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="rounded-full px-6 text-white"
                  style={{ backgroundColor: BRAND[700] }}
                >
                  {editingId ? "Save meeting" : "Log meeting"}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {partner.stage === "Negotiation" ? (
        <p className="text-center text-sm" style={{ color: STATUS.success }}>
          Deal won — you can continue to partnership details using Save &amp; next.
        </p>
      ) : null}
    </div>
  );
}

export function PartnerFollowUpLink({ partnerId }: { partnerId: string }) {
  return (
    <Link
      href={`/partners/${partnerId}`}
      className="text-sm font-medium underline-offset-2 hover:underline"
      style={{ color: BRAND[700] }}
    >
      Open partnership
    </Link>
  );
}
