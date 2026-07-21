"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Calendar,
  Check,
  FileStack,
  Mail,
  MapPin,
  Phone,
  User,
} from "lucide-react";

import { eventsService } from "@/services/api";
import {
  BRAND,
  INK,
  LINE,
  PAPER,
  TEAL,
  displayClass,
} from "@/features/dashboard/dashboard-ui";
import {
  buildEventPackageSummaries,
  getPartnerDisplayTier,
  resolveEventPartnerships,
} from "@/lib/partner-event-config";
import {
  getPartnerPortalUploadProgress,
  getPartnerPortalUploadStatus,
} from "@/lib/partner-portal-docs";
import { useTimelineSpine } from "@/lib/use-timeline-spine";
import { cn } from "@/lib/utils";
import type { Partner, PartnerLifecycleStage } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STAGE_ACCENT: Record<PartnerLifecycleStage, string> = {
  New: BRAND[600],
  Contacted: TEAL[700],
  "Meeting Scheduled": "#5C6B8A",
  Negotiation: "#8A6A2F",
  Confirmed: "#2F6B4F",
  "Not Proceeding": "#9A4A4A",
};

type TimelineState = "done" | "current" | "pending";

type TimelineStep = {
  label: string;
  detail: string;
  date?: string | null;
  done: boolean;
  state: TimelineState;
};

function withTimelineState(
  steps: Array<Omit<TimelineStep, "state">>
): TimelineStep[] {
  const currentIndex = steps.findIndex((s) => !s.done);

  return steps.map((step, index) => ({
    ...step,
    state: step.done
      ? "done"
      : index === currentIndex
        ? "current"
        : "pending",
  }));
}

function formatDate(value?: string) {
  if (!value) return null;
  const d = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatInr(value?: number) {
  if (value == null) return null;
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value)}`;
}

function partnerInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function JourneyTimeline({ steps }: { steps: TimelineStep[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const firstDotRef = useRef<HTMLSpanElement>(null);
  const lastDotRef = useRef<HTMLSpanElement>(null);
  const spineStyle = useTimelineSpine(containerRef, firstDotRef, lastDotRef, [
    steps.length,
    steps.map((step) => step.state).join(","),
  ]);

  return (
    <div ref={containerRef} className="relative isolate">
      {spineStyle && steps.length > 1 ? (
        <span
          className="pointer-events-none absolute left-3 -z-10 w-px -translate-x-1/2"
          style={{
            top: spineStyle.top,
            height: spineStyle.height,
            backgroundColor: LINE.subtle,
          }}
          aria-hidden
        />
      ) : null}
      <ol>
        {steps.map((step, index) => {
          return (
            <li key={step.label} className="relative flex gap-4 pb-5 last:pb-0">
              <div className="relative w-6 shrink-0 self-start">
                <span
                  ref={
                    index === 0
                      ? firstDotRef
                      : index === steps.length - 1
                        ? lastDotRef
                        : undefined
                  }
                  className={cn(
                    "relative z-[1] flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors",
                step.state === "done" && "border-transparent text-white",
                step.state === "current" && "border-[#D4D1C8] bg-white",
                step.state === "pending" && "border-[#D4D1C8] bg-white"
              )}
              style={
                step.state === "done"
                  ? { backgroundColor: BRAND[700] }
                  : step.state === "current"
                    ? { borderColor: BRAND[700], color: BRAND[700], backgroundColor: "#fff" }
                    : { backgroundColor: "#fff" }
              }
            >
              {step.state === "done" ? (
                <Check className="h-3 w-3" strokeWidth={3} />
              ) : step.state === "current" ? (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: BRAND[700] }}
                />
              ) : null}
              </span>
            </div>

            <div className="min-w-0 flex-1 pt-0.5">
              <p
                className={cn(
                  "text-sm leading-tight",
                  step.state === "pending"
                    ? "font-medium text-muted-foreground"
                    : "font-semibold"
                )}
                style={{
                  color:
                    step.state === "pending" ? INK.muted : INK.primary,
                }}
              >
                {step.label}
              </p>
              <p
                className="mt-0.5 text-xs leading-relaxed"
                style={{
                  color:
                    step.state === "current" ? BRAND[700] : INK.muted,
                }}
              >
                {step.detail}
              </p>
            </div>
          </li>
        );
      })}
      </ol>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div
      className="rounded-xl border px-3 py-2.5"
      style={{ borderColor: LINE.subtle, background: PAPER.surface }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(displayClass, "mt-0.5 text-base font-semibold tabular-nums")}
        style={{ color: INK.primary }}
      >
        {value}
      </p>
      {sub ? (
        <p className="mt-0.5 truncate text-[11px]" style={{ color: INK.muted }}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}

export function PartnerSummaryDialog({
  partner,
  open,
  onOpenChange,
  onViewDocs,
}: {
  partner: Partner | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewDocs?: (partner: Partner) => void;
}) {
  const eventsQuery = useQuery({
    queryKey: ["events"],
    queryFn: () => eventsService.getAll(),
    enabled: open,
  });

  const events = eventsQuery.data ?? [];

  const timeline = useMemo((): TimelineStep[] => {
    if (!partner) return [];

    const meetingCount = partner.meetings?.length ?? 0;
    const latestMeeting = partner.meetings?.[0];
    const meetingDetail = latestMeeting
      ? `${formatDate(latestMeeting.meetingAt) ?? "Logged"}${
          latestMeeting.outcome
            ? ` · ${latestMeeting.outcome.replace("_", " ")}`
            : ""
        }`
      : partner.meetingAt
        ? formatDate(partner.meetingAt) || "Scheduled"
        : "Pending";

    const tier = getPartnerDisplayTier(partner);
    const owner = partner.relationshipOwner;
    const eps = resolveEventPartnerships(partner);
    const partnershipDetail = tier
      ? `${tier}${owner?.organization ? ` · ${owner.organization}` : ""}`
      : "Terms not captured yet";

    const deliverableCount = eps.reduce(
      (sum, ep) => sum + ep.deliverables.filter((d) => d.included).length,
      0
    );
    const seatCount = (partner.seminarSlotAssignments ?? []).reduce(
      (s, a) => s + a.slots,
      0
    );

    return withTimelineState([
      {
        label: "Partner details",
        detail: [partner.city, partner.state].filter(Boolean).join(", ") || "—",
        date: partner.createdAt,
        done: true,
      },
      {
        label: "First contact",
        detail: partner.contactedAt
          ? formatDate(partner.contactedAt) || "—"
          : "Awaiting first outreach",
        date: partner.contactedAt,
        done: Boolean(partner.contactedAt),
      },
      {
        label: "Meeting",
        detail:
          meetingCount > 0
            ? `${meetingCount} logged · ${meetingDetail}`
            : partner.meetingAt
              ? formatDate(partner.meetingAt) || "Scheduled"
              : "No meeting logged yet",
        date: latestMeeting?.meetingAt ?? partner.meetingAt,
        done: meetingCount > 0 || Boolean(partner.meetingAt),
      },
      {
        label: "Partnership terms",
        detail: partnershipDetail,
        date: partner.updatedAt,
        done: Boolean(
          tier &&
            partner.eventIds.length > 0 &&
            partner.relationshipOwner?.managerName
        ),
      },
      {
        label: "Deliverables",
        detail: partner.deliverablesConfirmedAt
          ? `${deliverableCount} included in package`
          : "Package not confirmed",
        date: partner.deliverablesConfirmedAt,
        done: Boolean(partner.deliverablesConfirmedAt),
      },
      {
        label: "Seminar slots",
        detail: partner.seminarSlotsConfirmedAt
          ? `${seatCount} seat${seatCount === 1 ? "" : "s"} allotted`
          : "Slots not assigned",
        date: partner.seminarSlotsConfirmedAt,
        done: Boolean(partner.seminarSlotsConfirmedAt),
      },
      {
        label: "Commercials",
        detail: partner.commercialsConfirmedAt
          ? formatInr(partner.netAmount) || "Confirmed"
          : "Pricing not finalised",
        date: partner.commercialsConfirmedAt,
        done: Boolean(partner.commercialsConfirmedAt),
      },
      {
        label: "Partner portal",
        detail: partner.portalInviteSentAt
          ? `Invite sent · ${partner.portalLogin || "—"}`
          : "Access not sent",
        date: partner.portalInviteSentAt,
        done: Boolean(partner.portalInviteSentAt),
      },
    ]);
  }, [partner]);

  const eventPackages = useMemo(() => {
    if (!partner) return [];
    const eps = resolveEventPartnerships(partner);
    return buildEventPackageSummaries(
      eps,
      partner.seminarSlotAssignments ?? [],
      events
    );
  }, [partner, events]);

  const uploadStatus = useMemo(
    () => (partner ? getPartnerPortalUploadStatus(partner) : null),
    [partner]
  );

  const docProgress = uploadStatus
    ? getPartnerPortalUploadProgress(uploadStatus)
    : null;

  const nextFollowUp = useMemo(() => {
    if (!partner?.meetings?.length) return null;
    const withFollowUp = partner.meetings
      .filter((m) => m.followUpAt)
      .sort(
        (a, b) =>
          new Date(a.followUpAt!).getTime() - new Date(b.followUpAt!).getTime()
      );
    return withFollowUp[0] ?? null;
  }, [partner]);

  if (!partner) return null;

  const stageAccent =
    STAGE_ACCENT[partner.stage as PartnerLifecycleStage] ?? BRAND[600];
  const tierLabel = getPartnerDisplayTier(partner);
  const completedSteps = timeline.filter((s) => s.state === "done").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <div
          className="h-1.5 shrink-0"
          style={{ backgroundColor: stageAccent }}
          aria-hidden
        />

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 pb-4 pt-5">
          <DialogHeader className="space-y-0 text-left">
            <div className="flex items-start gap-4">
              <span
                className={cn(
                  displayClass,
                  "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
                )}
                style={{ background: BRAND[50], color: BRAND[700] }}
                aria-hidden
              >
                {partnerInitials(partner.name)}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
                    style={{
                      background: `${stageAccent}18`,
                      color: stageAccent,
                    }}
                  >
                    {partner.stage}
                  </span>
                  {tierLabel ? (
                    <span
                      className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
                      style={{
                        background: PAPER.muted,
                        color: INK.secondary,
                      }}
                    >
                      {tierLabel}
                    </span>
                  ) : null}
                </div>
                <DialogTitle
                  className={cn(
                    displayClass,
                    "mt-1.5 text-2xl leading-tight tracking-tight"
                  )}
                >
                  {partner.name}
                </DialogTitle>
                <p
                  className="mt-1 flex items-center gap-1 text-sm"
                  style={{ color: INK.muted }}
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {[partner.city, partner.state].filter(Boolean).join(" · ") ||
                    "Location not set"}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile
              label="Journey"
              value={`${completedSteps}/${timeline.length}`}
              sub="steps complete"
            />
            <StatTile
              label="Events"
              value={String(partner.eventIds.length)}
              sub={
                eventPackages[0]?.title ??
                (partner.eventIds.length ? "Linked" : "None yet")
              }
            />
            <StatTile
              label="Deal value"
              value={
                partner.netAmount != null
                  ? formatInr(partner.netAmount) ?? "—"
                  : "—"
              }
              sub={
                partner.commercialsConfirmedAt ? "Confirmed" : "Not finalised"
              }
            />
            <StatTile
              label="Portal docs"
              value={
                docProgress
                  ? `${docProgress.uploaded}/${docProgress.total}`
                  : "—"
              }
              sub={uploadStatus?.allComplete ? "All submitted" : "In progress"}
            />
          </div>

          {(partner.primaryContact.name ||
            partner.relationshipOwner?.managerName) && (
            <section
              className="mt-5 rounded-2xl border p-4"
              style={{ borderColor: LINE.subtle, background: PAPER.muted }}
            >
              <p
                className="mb-3 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: BRAND[700] }}
              >
                Key contacts
              </p>
              <div className="space-y-3">
                {partner.primaryContact.name ? (
                  <div className="flex items-start gap-3">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: PAPER.surface, color: BRAND[700] }}
                    >
                      <User className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm font-semibold"
                        style={{ color: INK.primary }}
                      >
                        {partner.primaryContact.name}
                      </p>
                      <p className="text-xs" style={{ color: INK.muted }}>
                        {partner.primaryContact.designation || "Primary contact"}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                        {partner.primaryContact.phone ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs"
                            style={{ color: INK.secondary }}
                          >
                            <Phone className="h-3 w-3" />
                            {partner.primaryContact.phone}
                          </span>
                        ) : null}
                        {partner.primaryContact.email ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs"
                            style={{ color: INK.secondary }}
                          >
                            <Mail className="h-3 w-3" />
                            {partner.primaryContact.email}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
                {partner.relationshipOwner?.managerName ? (
                  <div
                    className="flex items-center gap-3 border-t pt-3"
                    style={{ borderColor: LINE.subtle }}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: PAPER.surface, color: TEAL[700] }}
                    >
                      <User className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs" style={{ color: INK.muted }}>
                        Relationship owner ·{" "}
                        {partner.relationshipOwner.organization || "—"}
                      </p>
                      <p
                        className="text-sm font-medium"
                        style={{ color: INK.primary }}
                      >
                        {partner.relationshipOwner.managerName}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          )}

          {nextFollowUp ? (
            <div
              className="mt-4 flex items-start gap-3 rounded-xl border px-3 py-2.5"
              style={{
                borderColor: "rgba(176,125,42,0.25)",
                background: "rgba(176,125,42,0.08)",
              }}
            >
              <Calendar
                className="mt-0.5 h-4 w-4 shrink-0"
                style={{ color: "#8A6A2F" }}
              />
              <div>
                <p className="text-xs font-semibold" style={{ color: "#8A6A2F" }}>
                  Next follow-up
                </p>
                <p className="text-sm font-medium" style={{ color: INK.primary }}>
                  {formatDate(nextFollowUp.followUpAt!)}
                </p>
                {nextFollowUp.followUpNotes ? (
                  <p className="mt-0.5 text-xs" style={{ color: INK.muted }}>
                    {nextFollowUp.followUpNotes}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          <section className="mt-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: BRAND[700] }}
              >
                Partnership journey
              </p>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {completedSteps} of {timeline.length}
              </span>
            </div>
            <div
              className="rounded-2xl border p-4"
              style={{ borderColor: LINE.subtle, background: PAPER.surface }}
            >
              <JourneyTimeline steps={timeline} />
            </div>
          </section>

          {uploadStatus && partner.portalInviteSentAt ? (
            <section className="mt-5">
              <p
                className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: BRAND[700] }}
              >
                <FileStack className="h-3.5 w-3.5" />
                Portal submissions
              </p>
              <div
                className="rounded-xl border px-4 py-3"
                style={{ borderColor: LINE.subtle, background: PAPER.muted }}
              >
                <p className="text-[11px] font-medium text-muted-foreground">
                  Documents
                </p>
                <div className="mt-2 flex gap-1">
                  {uploadStatus.checklist.map((item) => (
                    <div
                      key={item.key}
                      title={item.label}
                      className={cn(
                        "h-1.5 min-w-0 flex-1 rounded-full",
                        item.complete ? "bg-[#2F6B4F]" : "bg-[#E8E6E0]"
                      )}
                    />
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {eventPackages.length > 0 ? (
            <section className="mt-5 space-y-3">
              <p
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: BRAND[700] }}
              >
                Event packages
              </p>
              {eventPackages.map((pkg) => (
                <div
                  key={pkg.eventId}
                  className="rounded-xl border px-4 py-3"
                  style={{ borderColor: LINE.subtle, background: PAPER.muted }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className="text-sm font-semibold"
                        style={{ color: INK.primary }}
                      >
                        {pkg.title}
                      </p>
                      <p className="text-xs" style={{ color: INK.muted }}>
                        {pkg.city} · {pkg.tier}
                      </p>
                    </div>
                    <span
                      className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                      style={{ background: BRAND[50], color: BRAND[700] }}
                    >
                      {pkg.seatsAssigned}/{pkg.slotBudget} seats
                    </span>
                  </div>
                  {pkg.deliverables.length > 0 ? (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {pkg.deliverables.slice(0, 4).map((d) => (
                        <span
                          key={d.id}
                          className="rounded-md px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            background: PAPER.surface,
                            color: INK.secondary,
                            border: `1px solid ${LINE.subtle}`,
                          }}
                        >
                          {d.label}
                        </span>
                      ))}
                      {pkg.deliverables.length > 4 ? (
                        <span
                          className="rounded-md px-2 py-0.5 text-[10px] font-medium"
                          style={{ color: INK.muted }}
                        >
                          +{pkg.deliverables.length - 4} more
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {pkg.seminars.length > 0 ? (
                    <ul className="mt-2 space-y-1 border-t pt-2" style={{ borderColor: LINE.subtle }}>
                      {pkg.seminars.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-center justify-between gap-2 text-xs"
                          style={{ color: INK.secondary }}
                        >
                          <span className="truncate">{s.title}</span>
                          <span
                            className="shrink-0 font-semibold tabular-nums"
                            style={{ color: BRAND[700] }}
                          >
                            {s.slots} seat{s.slots === 1 ? "" : "s"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </section>
          ) : null}

          {partner.notProceedingReason ? (
            <div
              className="mt-5 rounded-xl border px-4 py-3"
              style={{
                borderColor: "rgba(163,59,59,0.25)",
                background: "rgba(163,59,59,0.06)",
              }}
            >
              <p className="text-xs font-semibold" style={{ color: "#A33B3B" }}>
                Not proceeding
              </p>
              <p className="mt-1 text-sm" style={{ color: INK.primary }}>
                {partner.notProceedingReason}
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter
          className="shrink-0 gap-2 border-t px-6 py-4 sm:justify-between"
          style={{ borderColor: LINE.subtle }}
        >
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <div className="flex flex-wrap gap-2">
            {onViewDocs ? (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => onViewDocs(partner)}
              >
                <FileStack className="h-4 w-4" />
                View docs
              </Button>
            ) : null}
            <Button
              asChild
              className="gap-2 text-white"
              style={{ backgroundColor: BRAND[700] }}
            >
              <Link href={`/partners/${partner.id}`}>
                Edit partnership
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
