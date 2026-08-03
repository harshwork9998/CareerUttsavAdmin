"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Mail, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";

import {
  BROADCAST_PLACEHOLDERS,
  filterRegistrantsForSeminar,
  renderBroadcastMessage,
} from "@/lib/messaging/seminar-registrants";
import { cn, formatNumber } from "@/lib/utils";
import { messagingService, registrationsService } from "@/services/api";
import type { BroadcastChannel, EventSeminar } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const DEFAULT_EMAIL_SUBJECT = "Reminder: {{seminarTitle}} — {{eventTitle}}";

const DEFAULT_EMAIL_BODY = `Hi {{studentName}},

Thank you for registering for Career Uttsav. This is a reminder about your selected seminar:

{{seminarTitle}}
Time: {{seminarTime}} · Audi {{seminarHall}}

Please arrive 10 minutes early. See you at {{eventTitle}}!

— Career Uttsav Team`;

const DEFAULT_WHATSAPP_BODY = `Hi {{studentName}}! Reminder for {{seminarTitle}} at {{eventTitle}} — {{seminarTime}}, Audi {{seminarHall}}. Please arrive 10 mins early. — Career Uttsav`;

function formatSeminarSlot(seminar?: EventSeminar): {
  seminarTime?: string;
  seminarHall?: string;
} {
  if (!seminar) return {};
  const [h, m] = seminar.startTime.split(":").map(Number);
  const time =
    Number.isFinite(h) && Number.isFinite(m)
      ? new Date(2000, 0, 1, h, m).toLocaleTimeString("en-IN", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      : seminar.startTime;
  return {
    seminarTime: time,
    seminarHall: String(seminar.hall),
  };
}

export function SeminarBroadcastDialog({
  open,
  onOpenChange,
  eventId,
  eventTitle,
  seminarTitle,
  seminarSlot,
  eventSeminarTitles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventTitle: string;
  seminarTitle: string;
  seminarSlot?: EventSeminar;
  eventSeminarTitles: readonly string[];
}) {
  const [channel, setChannel] = useState<BroadcastChannel>("email");
  const [subject, setSubject] = useState(DEFAULT_EMAIL_SUBJECT);
  const [message, setMessage] = useState(DEFAULT_EMAIL_BODY);

  const registrationsQuery = useQuery({
    queryKey: ["registrations", "event", eventId, "broadcast"],
    queryFn: () => registrationsService.getByEvent(eventId),
    enabled: open && Boolean(eventId),
  });

  const recipients = useMemo(() => {
    const rows = registrationsQuery.data ?? [];
    return filterRegistrantsForSeminar(rows, seminarTitle, eventSeminarTitles);
  }, [registrationsQuery.data, seminarTitle, eventSeminarTitles]);

  const slotMeta = useMemo(() => formatSeminarSlot(seminarSlot), [seminarSlot]);

  const preview = useMemo(() => {
    const sample = recipients[0];
    if (!sample) return null;
    const ctx = {
      studentName: sample.studentName,
      seminarTitle,
      eventTitle,
      ...slotMeta,
    };
    return {
      subject: renderBroadcastMessage(subject, ctx),
      body: renderBroadcastMessage(message, ctx),
    };
  }, [recipients, subject, message, seminarTitle, eventTitle, slotMeta]);

  const sendMutation = useMutation({
    mutationFn: () =>
      messagingService.sendSeminarBroadcast({
        eventId,
        seminarTitle,
        channel,
        subject: channel === "email" ? subject : undefined,
        message,
        recipientIds: recipients.map((r) => r.id),
      }),
    onSuccess: (result) => {
      toast.success(
        `${result.channel === "email" ? "Email" : "WhatsApp"} sent to ${formatNumber(result.sent)} registrants`
      );
      onOpenChange(false);
    },
    onError: () => toast.error("Could not send messages. Try again."),
  });

  const switchChannel = (next: BroadcastChannel) => {
    setChannel(next);
    if (next === "whatsapp" && message === DEFAULT_EMAIL_BODY) {
      setMessage(DEFAULT_WHATSAPP_BODY);
    }
    if (next === "email" && message === DEFAULT_WHATSAPP_BODY) {
      setMessage(DEFAULT_EMAIL_BODY);
    }
  };

  const insertPlaceholder = (token: string) => {
    setMessage((prev) => (prev ? `${prev}${prev.endsWith(" ") ? "" : " "}${token}` : token));
  };

  const emailCount = recipients.filter((r) => r.email?.trim()).length;
  const phoneCount = recipients.filter((r) => r.phone?.trim()).length;
  const reachable =
    channel === "email" ? emailCount : phoneCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="border-b border-border/50 px-4 py-3.5 pr-11 text-left">
          <DialogTitle className="text-[16px] leading-snug tracking-tight">
            Message registrants
          </DialogTitle>
          <DialogDescription className="text-[12px] leading-snug">
            Bulk {channel === "email" ? "email" : "WhatsApp"} for students who
            selected this seminar
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
          <p className="rounded-lg border border-brand-900/10 bg-brand-50/60 px-3 py-2 text-[12px] leading-snug text-brand-900/80">
            <span className="font-semibold text-brand-950">{seminarTitle}</span>
            {" · "}
            <span className="tabular-nums">
              {formatNumber(recipients.length)} registrants
            </span>
            {registrationsQuery.isLoading ? " · loading…" : null}
          </p>

          <div
            role="tablist"
            aria-label="Channel"
            className="inline-flex rounded-lg border border-brand-900/12 bg-brand-50/70 p-0.5"
          >
            {(
              [
                { id: "email" as const, label: "Email", icon: Mail },
                { id: "whatsapp" as const, label: "WhatsApp", icon: MessageCircle },
              ] as const
            ).map((opt) => {
              const active = channel === opt.id;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => switchChannel(opt.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors",
                    active
                      ? "bg-white text-brand-950 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                  {opt.label}
                </button>
              );
            })}
          </div>

          {channel === "email" ? (
            <div className="space-y-1.5">
              <Label htmlFor="broadcast-subject" className="text-[12px]">
                Subject
              </Label>
              <Input
                id="broadcast-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-9 text-[13px]"
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="broadcast-message" className="text-[12px]">
              Message
            </Label>
            <Textarea
              id="broadcast-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={channel === "whatsapp" ? 5 : 8}
              className="min-h-[120px] resize-y text-[13px] leading-relaxed"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {BROADCAST_PLACEHOLDERS.map((ph) => (
                <button
                  key={ph.key}
                  type="button"
                  onClick={() => insertPlaceholder(ph.key)}
                  className="rounded-md border border-brand-900/12 bg-white px-2 py-0.5 text-[10px] font-medium text-brand-800 hover:bg-brand-50"
                >
                  {ph.label}
                </button>
              ))}
            </div>
          </div>

          {preview ? (
            <div className="rounded-lg border border-brand-900/10 bg-[#F7F6F3] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-900/45">
                Preview (first recipient)
              </p>
              {channel === "email" ? (
                <p className="mt-2 text-[12px] font-semibold text-foreground">
                  {preview.subject}
                </p>
              ) : null}
              <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-muted-foreground">
                {preview.body}
              </p>
            </div>
          ) : null}

          <p className="text-[11px] leading-snug text-muted-foreground">
            Will send to{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {formatNumber(reachable)}
            </span>{" "}
            {channel === "email" ? "email addresses" : "mobile numbers"}
            {reachable < recipients.length
              ? ` (${formatNumber(recipients.length - reachable)} missing contact)`
              : null}
            . Each student gets a personalised message (name and seminar details
            filled in automatically).
          </p>
        </div>

        <DialogFooter className="border-t border-border/50 px-4 py-3 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="text-[13px]"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="gap-1.5 text-[13px]"
            disabled={
              sendMutation.isPending ||
              registrationsQuery.isLoading ||
              reachable === 0 ||
              !message.trim() ||
              (channel === "email" && !subject.trim())
            }
            onClick={() => sendMutation.mutate()}
          >
            <Send className="size-3.5" />
            {sendMutation.isPending
              ? "Sending…"
              : `Send ${channel === "email" ? "email" : "WhatsApp"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
