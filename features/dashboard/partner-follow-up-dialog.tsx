"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  MapPin,
  Phone,
  Sparkles,
} from "lucide-react";

import {
  BRAND,
  INK,
  LINE,
  PAPER,
  displayClass,
  surface,
} from "@/features/dashboard/dashboard-ui";
import {
  formatFollowUpDateTime,
  getFollowUpsDueOnDate,
  hasSeenFollowUpDialogToday,
  markFollowUpDialogSeen,
} from "@/lib/partner-meetings";
import { partnersService } from "@/services/api";
import { cn } from "@/lib/utils";
import type { PartnerFollowUpItem } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function FollowUpCard({ item }: { item: PartnerFollowUpItem }) {
  const { partner, meeting } = item;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(surface.opening, "overflow-hidden p-0")}
    >
      <div
        className="border-b px-4 py-3 sm:px-5"
        style={{
          borderColor: LINE.subtle,
          background: `linear-gradient(135deg, ${BRAND[50]} 0%, ${PAPER.surface} 100%)`,
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p
              className={cn(displayClass, "text-lg font-semibold leading-snug")}
              style={{ color: INK.primary }}
            >
              {partner.name}
            </p>
            <p
              className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
              style={{ color: INK.secondary }}
            >
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {partner.city}
                {partner.state ? `, ${partner.state}` : ""}
              </span>
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                {partner.stage}
              </span>
            </p>
          </div>
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{
              background:
                meeting.outcome === "lost"
                  ? "rgba(163,59,59,0.14)"
                  : "rgba(176,125,42,0.16)",
              color: meeting.outcome === "lost" ? "#A33B3B" : "#8A6A2F",
            }}
          >
            {meeting.outcome === "lost" ? "Re-engage" : "Follow-up due"}
          </span>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4 sm:px-5">
        <div
          className="flex items-start gap-2 rounded-xl px-3 py-2.5"
          style={{ background: PAPER.muted, border: `1px solid ${LINE.subtle}` }}
        >
          <CalendarClock
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{ color: BRAND[700] }}
          />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Scheduled for
            </p>
            <p className="text-sm font-semibold" style={{ color: INK.primary }}>
              {formatFollowUpDateTime(meeting.followUpAt!)}
            </p>
          </div>
        </div>

        {meeting.followUpNotes ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Follow-up notes
            </p>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: INK.secondary }}>
              {meeting.followUpNotes}
            </p>
          </div>
        ) : null}

        {meeting.notes ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Last meeting notes
            </p>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: INK.secondary }}>
              {meeting.notes}
            </p>
          </div>
        ) : null}

        {meeting.lostReason ? (
          <div
            className="rounded-xl px-3 py-2.5 text-sm"
            style={{
              background: "rgba(163,59,59,0.06)",
              color: INK.secondary,
            }}
          >
            <span className="font-semibold text-destructive">Deal lost: </span>
            {meeting.lostReason}
          </div>
        ) : null}

        <div
          className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs"
          style={{ borderColor: LINE.subtle, color: INK.muted }}
        >
          <span>{partner.primaryContact.name}</span>
          <span className="inline-flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {partner.primaryContact.phone}
          </span>
          <span>{partner.primaryContact.email}</span>
        </div>

        <Link
          href={`/partners/${partner.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ color: BRAND[700] }}
        >
          Open partnership journey
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </motion.li>
  );
}

export function PartnerFollowUpDialog() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const today = useMemo(() => new Date(), []);

  const { data: partners } = useQuery({
    queryKey: ["partners"],
    queryFn: () => partnersService.getAll(),
  });

  const dueToday = useMemo(
    () => getFollowUpsDueOnDate(partners ?? [], today),
    [partners, today]
  );

  useEffect(() => {
    if (pathname !== "/dashboard") return;
    if (!partners?.length) return;
    if (dueToday.length === 0) return;
    if (hasSeenFollowUpDialogToday(today)) return;
    setOpen(true);
  }, [pathname, partners, dueToday.length, today]);

  const dismiss = () => {
    markFollowUpDialogSeen(today);
    setOpen(false);
  };

  if (dueToday.length === 0) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
        else setOpen(true);
      }}
    >
      <DialogContent className="flex max-h-[min(90vh,820px)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <div
          className="border-b px-6 py-5 sm:px-8"
          style={{
            borderColor: LINE.subtle,
            background: `linear-gradient(135deg, ${BRAND[700]} 0%, #2A4F8C 100%)`,
          }}
        >
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle
              className={cn(displayClass, "flex items-center gap-2 text-2xl text-white")}
            >
              <Sparkles className="h-6 w-6" />
              Follow-ups due today
            </DialogTitle>
            <DialogDescription className="text-sm text-white/85">
              {dueToday.length} university follow-up
              {dueToday.length === 1 ? "" : "s"} scheduled for today. Review
              details before you reach out.
            </DialogDescription>
          </DialogHeader>
        </div>

        <ul className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {dueToday.map((item) => (
            <FollowUpCard key={`${item.partner.id}-${item.meeting.id}`} item={item} />
          ))}
        </ul>

        <DialogFooter
          className="border-t px-6 py-4 sm:px-8"
          style={{ borderColor: LINE.subtle, background: PAPER.muted }}
        >
          <Button
            type="button"
            variant="outline"
            onClick={dismiss}
            className="rounded-full"
          >
            Remind me later today
          </Button>
          <Button
            type="button"
            onClick={dismiss}
            className="rounded-full text-white"
            style={{ backgroundColor: BRAND[700] }}
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
