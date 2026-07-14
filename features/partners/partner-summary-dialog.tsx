"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check } from "lucide-react";

import { eventsService } from "@/services/api";
import {
  BRAND,
  INK,
  LINE,
  PAPER,
  displayClass,
} from "@/features/dashboard/dashboard-ui";
import { cn } from "@/lib/utils";
import type { Partner } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

function stageTone(stage: Partner["stage"]) {
  switch (stage) {
    case "Confirmed":
      return { bg: "rgba(47,107,79,0.12)", color: "#2F6B4F" };
    case "Not Proceeding":
      return { bg: "rgba(163,59,59,0.12)", color: "#A33B3B" };
    case "Negotiation":
      return { bg: "rgba(176,125,42,0.14)", color: "#B07D2A" };
    default:
      return { bg: BRAND[50], color: BRAND[700] };
  }
}

export function PartnerSummaryDialog({
  partner,
  open,
  onOpenChange,
}: {
  partner: Partner | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const eventsQuery = useQuery({
    queryKey: ["events"],
    queryFn: () => eventsService.getAll(),
    enabled: open,
  });

  const events = eventsQuery.data ?? [];

  const timeline = useMemo(() => {
    if (!partner) return [];
    const items: Array<{ label: string; detail: string; done: boolean }> = [
      {
        label: "University details",
        detail: [partner.city, partner.state].filter(Boolean).join(", "),
        done: true,
      },
      {
        label: "First contact",
        detail: partner.contactedAt
          ? formatDate(partner.contactedAt) || "—"
          : "Pending",
        done: Boolean(partner.contactedAt),
      },
      {
        label: "Meeting",
        detail: partner.meetingAt
          ? formatDate(partner.meetingAt) || "—"
          : "Pending",
        done: Boolean(partner.meetingAt),
      },
      {
        label: "Partnership",
        detail: partner.sponsorshipTier
          ? `${partner.sponsorshipTier}${
              partner.relationshipOwner?.managerName
                ? ` · ${partner.relationshipOwner.organization}`
                : ""
            }`
          : "Pending",
        done: Boolean(partner.sponsorshipTier),
      },
      {
        label: "Deliverables",
        detail: partner.deliverablesConfirmedAt
          ? `${(partner.deliverables ?? []).filter((d) => d.included).length} included`
          : "Pending",
        done: Boolean(partner.deliverablesConfirmedAt),
      },
      {
        label: "Seminar slots",
        detail: partner.seminarSlotsConfirmedAt
          ? `${(partner.seminarSlotAssignments ?? []).reduce((s, a) => s + a.slots, 0)} seats`
          : "Pending",
        done: Boolean(partner.seminarSlotsConfirmedAt),
      },
      {
        label: "Commercials",
        detail: partner.commercialsConfirmedAt
          ? formatInr(partner.netAmount) || "Saved"
          : "Pending",
        done: Boolean(partner.commercialsConfirmedAt),
      },
      {
        label: "Partner access",
        detail: partner.portalInviteSentAt
          ? `Sent · ${partner.portalLogin || "—"}`
          : "Pending",
        done: Boolean(partner.portalInviteSentAt),
      },
    ];
    return items;
  }, [partner]);

  const includedDeliverables = useMemo(
    () => (partner?.deliverables ?? []).filter((d) => d.included),
    [partner]
  );

  const slotRows = useMemo(() => {
    if (!partner) return [];
    return (partner.seminarSlotAssignments ?? [])
      .filter((a) => a.slots > 0)
      .map((a) => {
        const event = events.find((e) => e.id === a.eventId);
        const seminar = event?.seminars.find((s) => s.id === a.seminarId);
        return {
          id: `${a.eventId}-${a.seminarId}`,
          seminar: seminar?.title ?? a.seminarId,
          event: event?.title ?? a.eventId,
          slots: a.slots,
        };
      });
  }, [partner, events]);

  if (!partner) return null;

  const tone = stageTone(partner.stage);
  const eventNames = partner.eventIds
    .map((id) => events.find((e) => e.id === id)?.title ?? id)
    .join(", ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="space-y-3 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ background: tone.bg, color: tone.color }}
            >
              {partner.stage}
            </span>
            {partner.sponsorshipTier ? (
              <span
                className="rounded-full px-2.5 py-1 text-xs font-medium"
                style={{
                  background: PAPER.muted,
                  color: INK.secondary,
                  border: `1px solid ${LINE.subtle}`,
                }}
              >
                {partner.sponsorshipTier}
              </span>
            ) : null}
          </div>
          <DialogTitle className={cn(displayClass, "text-2xl leading-tight")}>
            {partner.name}
          </DialogTitle>
          <p className="text-sm" style={{ color: INK.secondary }}>
            {[partner.city, partner.state].filter(Boolean).join(" · ")}
            {partner.primaryContact.name
              ? ` · ${partner.primaryContact.name}`
              : ""}
          </p>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <section>
            <p
              className="mb-3 text-[11px] font-semibold tracking-[0.14em] uppercase"
              style={{ color: BRAND[700] }}
            >
              Timeline
            </p>
            <ol className="space-y-2.5">
              {timeline.map((item) => (
                <li key={item.label} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: item.done ? BRAND[700] : PAPER.muted,
                      color: item.done ? "#fff" : INK.muted,
                      border: item.done ? undefined : `1px solid ${LINE.strong}`,
                    }}
                  >
                    {item.done ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium" style={{ color: INK.primary }}>
                      {item.label}
                    </p>
                    <p className="text-xs" style={{ color: INK.muted }}>
                      {item.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {includedDeliverables.length > 0 ? (
            <section className="border-t pt-4" style={{ borderColor: LINE.subtle }}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <p
                  className="text-[11px] font-semibold tracking-[0.14em] uppercase"
                  style={{ color: BRAND[700] }}
                >
                  Deliverables
                </p>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
                  style={{ background: BRAND[50], color: BRAND[700] }}
                >
                  {includedDeliverables.length}
                </span>
              </div>
              <div className="grid gap-2">
                {includedDeliverables.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-start gap-2.5 rounded-xl border px-3 py-2.5"
                    style={{
                      borderColor: LINE.subtle,
                      background: PAPER.muted,
                    }}
                  >
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                      style={{ background: BRAND[700], color: "#fff" }}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm font-medium leading-snug"
                        style={{ color: INK.primary }}
                      >
                        {d.label}
                      </p>
                      {d.option ? (
                        <span
                          className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{
                            background: PAPER.surface,
                            color: BRAND[700],
                            border: `1px solid ${LINE.subtle}`,
                          }}
                        >
                          {d.option}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {slotRows.length > 0 ? (
            <section className="border-t pt-4" style={{ borderColor: LINE.subtle }}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <p
                  className="text-[11px] font-semibold tracking-[0.14em] uppercase"
                  style={{ color: BRAND[700] }}
                >
                  Seminar slots
                </p>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
                  style={{ background: BRAND[50], color: BRAND[700] }}
                >
                  {slotRows.reduce((s, r) => s + r.slots, 0)} seats
                </span>
              </div>
              <div className="space-y-2">
                {slotRows.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-xl border px-3 py-3"
                    style={{
                      borderColor: LINE.subtle,
                      background: PAPER.muted,
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className="text-sm font-semibold leading-snug"
                          style={{ color: INK.primary }}
                        >
                          {row.seminar}
                        </p>
                        <p className="mt-0.5 text-xs" style={{ color: INK.muted }}>
                          {row.event}
                        </p>
                      </div>
                      <span
                        className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg px-2 text-sm font-bold tabular-nums text-white"
                        style={{ background: BRAND[700] }}
                      >
                        {row.slots}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {(partner.commercialsConfirmedAt || partner.eventIds.length > 0) && (
            <section className="border-t pt-4" style={{ borderColor: LINE.subtle }}>
              <p
                className="mb-2 text-[11px] font-semibold tracking-[0.14em] uppercase"
                style={{ color: BRAND[700] }}
              >
                Other details
              </p>
              <dl className="space-y-1.5 text-sm" style={{ color: INK.secondary }}>
                {partner.eventIds.length > 0 ? (
                  <div className="flex justify-between gap-3">
                    <dt style={{ color: INK.muted }}>Events</dt>
                    <dd className="text-right">{eventNames || "—"}</dd>
                  </div>
                ) : null}
                {partner.relationshipOwner?.managerName ? (
                  <div className="flex justify-between gap-3">
                    <dt style={{ color: INK.muted }}>SPOC</dt>
                    <dd className="text-right">
                      {partner.relationshipOwner.managerName}
                    </dd>
                  </div>
                ) : null}
                {partner.totalAmount != null ? (
                  <div className="flex justify-between gap-3">
                    <dt style={{ color: INK.muted }}>Total</dt>
                    <dd className="tabular-nums">{formatInr(partner.totalAmount)}</dd>
                  </div>
                ) : null}
                {partner.discountAmount != null && partner.discountAmount > 0 ? (
                  <div className="flex justify-between gap-3">
                    <dt style={{ color: INK.muted }}>Discount</dt>
                    <dd className="tabular-nums">
                      {formatInr(partner.discountAmount)}
                    </dd>
                  </div>
                ) : null}
                {partner.netAmount != null ? (
                  <div className="flex justify-between gap-3 font-semibold" style={{ color: INK.primary }}>
                    <dt>Net</dt>
                    <dd className="tabular-nums">{formatInr(partner.netAmount)}</dd>
                  </div>
                ) : null}
                {partner.portalInviteSentAt ? (
                  <div className="flex justify-between gap-3">
                    <dt style={{ color: INK.muted }}>Invite</dt>
                    <dd className="text-right">
                      {formatDate(partner.portalInviteSentAt)}
                    </dd>
                  </div>
                ) : null}
                {partner.notProceedingReason ? (
                  <div className="pt-1">
                    <dt className="text-xs" style={{ color: INK.muted }}>
                      Not proceeding reason
                    </dt>
                    <dd className="mt-0.5">{partner.notProceedingReason}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
