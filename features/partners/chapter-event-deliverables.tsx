"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mic2, Plus, Trash2 } from "lucide-react";

import {
  PARTNER_DELIVERABLE_DEFINITIONS,
  SPONSORSHIP_TIERS,
} from "@/constants";
import {
  BRAND,
  INK,
  LINE,
  PAPER,
  displayClass,
} from "@/features/dashboard/dashboard-ui";
import { cn, generateId } from "@/lib/utils";
import type { Event, PartnerDeliverable, PartnerEventPartnership } from "@/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

function EventDeliverableList({
  eventId,
  deliverables,
  onChange,
  errors,
}: {
  eventId: string;
  deliverables: PartnerDeliverable[];
  onChange: (deliverables: PartnerDeliverable[]) => void;
  errors: Record<string, string>;
}) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!composerOpen) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 180);
    return () => window.clearTimeout(id);
  }, [composerOpen]);

  const updateItem = (id: string, patch: Partial<PartnerDeliverable>) => {
    onChange(deliverables.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const addCustom = () => {
    const label = customLabel.trim();
    if (!label) return;
    onChange([
      ...deliverables,
      {
        id: generateId(),
        key: "custom",
        label,
        included: true,
        isCustom: true,
      },
    ]);
    setCustomLabel("");
    setComposerOpen(false);
  };

  const standard = deliverables.filter((d) => !d.isCustom);
  const customs = deliverables.filter((d) => d.isCustom);

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {standard.map((item) => {
          const def = PARTNER_DELIVERABLE_DEFINITIONS.find(
            (d) => d.key === item.key
          );
          const options = def?.options;
          return (
            <li
              key={item.id}
              className="flex flex-col gap-2 rounded-xl border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              style={{
                borderColor: LINE.subtle,
                background: item.included ? BRAND[50] : PAPER.muted,
              }}
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                <Checkbox
                  checked={item.included}
                  onCheckedChange={(v) =>
                    updateItem(item.id, { included: v === true })
                  }
                  className="mt-0.5"
                />
                <span
                  className="text-sm font-medium leading-snug"
                  style={{ color: INK.primary }}
                >
                  {item.label}
                </span>
              </label>
              {options ? (
                <div className="w-full sm:w-56 sm:shrink-0">
                  <Select
                    value={item.option || undefined}
                    onValueChange={(v) => updateItem(item.id, { option: v })}
                    disabled={!item.included}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError message={errors[`${eventId}-${item.id}`]} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {customs.length > 0 ? (
        <ul className="space-y-2">
          {customs.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border px-3 py-3"
              style={{ borderColor: LINE.subtle, background: BRAND[50] }}
            >
              <Checkbox
                checked={item.included}
                onCheckedChange={(v) =>
                  updateItem(item.id, { included: v === true })
                }
              />
              <Input
                className="flex-1"
                value={item.label}
                onChange={(e) => updateItem(item.id, { label: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() =>
                  onChange(deliverables.filter((d) => d.id !== item.id))
                }
                aria-label="Remove custom deliverable"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {!composerOpen ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setComposerOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Add custom deliverable
        </Button>
      ) : (
        <div
          className="flex flex-col gap-3 rounded-xl border border-dashed p-3 sm:flex-row sm:items-end"
          style={{ borderColor: LINE.strong }}
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label>Custom deliverable</Label>
            <Input
              ref={inputRef}
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setCustomLabel("");
                setComposerOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="text-white"
              style={{ backgroundColor: BRAND[700] }}
              onClick={addCustom}
              disabled={!customLabel.trim()}
            >
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ChapterEventDeliverables({
  events,
  eventPartnerships,
  setEventPartnerships,
  errors,
}: {
  events: Event[];
  eventPartnerships: PartnerEventPartnership[];
  setEventPartnerships: (
    v:
      | PartnerEventPartnership[]
      | ((p: PartnerEventPartnership[]) => PartnerEventPartnership[])
  ) => void;
  errors: Record<string, string>;
}) {
  const eventBlocks = eventPartnerships
    .map((ep) => ({
      ep,
      event: events.find((e) => e.id === ep.eventId),
    }))
    .filter((x) => x.event);

  const patchEvent = (
    eventId: string,
    patch: Partial<PartnerEventPartnership>
  ) => {
    setEventPartnerships((prev) =>
      prev.map((ep) => (ep.eventId === eventId ? { ...ep, ...patch } : ep))
    );
  };

  if (eventBlocks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Select events in partnership details first.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {eventBlocks.map(({ ep, event }, index) => (
        <motion.section
          key={ep.eventId}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="overflow-hidden rounded-2xl border"
          style={{ borderColor: LINE.subtle, background: PAPER.surface }}
        >
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-5"
            style={{
              borderColor: LINE.subtle,
              background: `linear-gradient(135deg, ${BRAND[50]} 0%, ${PAPER.muted} 100%)`,
            }}
          >
            <div>
              <p
                className="text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: BRAND[700] }}
              >
                {event!.city}
              </p>
              <h3
                className={cn(displayClass, "text-lg font-bold")}
                style={{ color: INK.primary }}
              >
                {event!.title}
              </h3>
            </div>
            <span
              className="rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ background: "rgba(31,56,100,0.12)", color: INK.primary }}
            >
              {ep.sponsorshipTier || "No tier"}
            </span>
          </div>

          <div className="space-y-5 p-4 sm:p-5">
            <div>
              <p
                className="mb-3 text-sm font-semibold"
                style={{ color: INK.primary }}
              >
                Package deliverables
              </p>
              <EventDeliverableList
                eventId={ep.eventId}
                deliverables={ep.deliverables}
                onChange={(deliverables) =>
                  patchEvent(ep.eventId, { deliverables })
                }
                errors={errors}
              />
            </div>

            <div
              className="rounded-xl border p-4"
              style={{ borderColor: LINE.subtle, background: PAPER.muted }}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: BRAND[700], color: "#fff" }}
                  >
                    <Mic2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: INK.primary }}>
                      Seminar panelist slots
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: INK.muted }}>
                      Total seats for this event — you’ll pick which seminars in
                      the next step.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`slots-${ep.eventId}`} className="sr-only">
                    Seminar slots
                  </Label>
                  <Input
                    id={`slots-${ep.eventId}`}
                    type="number"
                    min={0}
                    max={99}
                    className="w-20 text-center tabular-nums"
                    value={ep.seminarSlotCount || ""}
                    onChange={(e) => {
                      const n = Math.max(0, parseInt(e.target.value, 10) || 0);
                      patchEvent(ep.eventId, { seminarSlotCount: n });
                    }}
                  />
                  <span className="text-sm text-muted-foreground">slots</span>
                </div>
              </div>
              <FieldError message={errors[`seminar-slots-${ep.eventId}`]} />
            </div>
          </div>
        </motion.section>
      ))}
    </div>
  );
}

export { SPONSORSHIP_TIERS };
