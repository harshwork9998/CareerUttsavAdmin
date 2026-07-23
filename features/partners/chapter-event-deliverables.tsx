"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mic2, Plus, Trash2 } from "lucide-react";

import {
  PARTNER_DELIVERABLE_DEFINITIONS,
  SPONSORSHIP_TIERS,
  type PartnerDeliverableKey,
} from "@/constants";
import {
  BRAND,
  INK,
  LINE,
  PAPER,
  displayClass,
} from "@/features/dashboard/dashboard-ui";
import { cn, generateId } from "@/lib/utils";
import { getPartnershipTierLabel, isCustomPartnership } from "@/lib/partner-tier";
import type {
  Event,
  PartnerDeliverable,
  PartnerEventPartnership,
} from "@/types";
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
import {
  FieldError,
  fieldErrorClass,
  fieldErrorSurfaceClass,
} from "@/components/shared/form-field-error";

const CUSTOM_DELIVERABLE_OPTION = "__custom_deliverable__";

function EventDeliverableList({
  eventId,
  deliverables,
  onChange,
  errors,
  customPackage = false,
}: {
  eventId: string;
  deliverables: PartnerDeliverable[];
  onChange: (deliverables: PartnerDeliverable[]) => void;
  errors: Record<string, string>;
  /** Custom tiers have no preset checklist — build the package manually */
  customPackage?: boolean;
}) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedPresetKey, setSelectedPresetKey] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!composerOpen) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 180);
    return () => window.clearTimeout(id);
  }, [composerOpen, selectedPresetKey]);

  const resetComposer = () => {
    setComposerOpen(false);
    setSelectedPresetKey("");
    setSelectedOption("");
    setCustomLabel("");
  };

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
    resetComposer();
  };

  const addPreset = () => {
    const def = PARTNER_DELIVERABLE_DEFINITIONS.find(
      (d) => d.key === selectedPresetKey
    );
    if (!def) return;
    onChange([
      ...deliverables,
      {
        id: generateId(),
        key: def.key,
        label: def.label,
        included: true,
        option: def.options ? selectedOption || def.options[0] : undefined,
        isCustom: false,
      },
    ]);
    resetComposer();
  };

  const handlePresetPick = (value: string) => {
    setSelectedPresetKey(value);
    setCustomLabel("");
    if (value === CUSTOM_DELIVERABLE_OPTION) {
      setSelectedOption("");
      return;
    }
    const def = PARTNER_DELIVERABLE_DEFINITIONS.find((d) => d.key === value);
    setSelectedOption(def?.options?.[0] ?? "");
  };

  const usedPresetKeys = new Set(
    deliverables
      .filter((d) => !d.isCustom && d.key !== "custom")
      .map((d) => d.key as PartnerDeliverableKey)
  );
  const availableDefinitions = PARTNER_DELIVERABLE_DEFINITIONS.filter(
    (d) => !usedPresetKeys.has(d.key)
  );
  const selectedDefinition = PARTNER_DELIVERABLE_DEFINITIONS.find(
    (d) => d.key === selectedPresetKey
  );
  const isCustomPick = selectedPresetKey === CUSTOM_DELIVERABLE_OPTION;
  const canAddPreset =
    Boolean(selectedDefinition) &&
    (!selectedDefinition?.options || Boolean(selectedOption));
  const canAddCustom = isCustomPick && Boolean(customLabel.trim());

  const standard = customPackage ? [] : deliverables.filter((d) => !d.isCustom);
  const customs = customPackage
    ? deliverables
    : deliverables.filter((d) => d.isCustom);

  if (customPackage) {
    const packageError = errors[`custom-package-${eventId}`];
    return (
      <div
        className={fieldErrorSurfaceClass(
          packageError,
          "space-y-4 rounded-xl border border-transparent p-1"
        )}
        data-field-error={packageError ? "true" : undefined}
      >
        <p className="text-sm leading-relaxed" style={{ color: INK.secondary }}>
          This is a custom partnership tier — pick deliverables from the standard
          catalog or add bespoke items. Use seminar slots below if panel seats
          are part of the package.
        </p>
        {customs.length === 0 && !composerOpen ? (
          <div
            className="rounded-xl border border-dashed px-4 py-8 text-center"
            style={{ borderColor: LINE.strong, background: PAPER.muted }}
          >
            <p className="text-sm font-medium" style={{ color: INK.primary }}>
              No deliverables yet
            </p>
            <p className="mt-1 text-sm" style={{ color: INK.muted }}>
              Choose from the standard list or add a custom deliverable.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4 gap-1.5 rounded-full"
              onClick={() => setComposerOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Add deliverable
            </Button>
          </div>
        ) : null}
        {customs.length > 0 ? (
          <ul className="space-y-2">
            {customs.map((item) => {
              const def = PARTNER_DELIVERABLE_DEFINITIONS.find(
                (d) => d.key === item.key
              );
              const options = def?.options;
              const itemError = errors[`${eventId}-${item.id}`];

              return (
                <li
                  key={item.id}
                  className={fieldErrorSurfaceClass(
                    itemError,
                    "flex flex-col gap-2 rounded-xl border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  )}
                  style={
                    itemError
                      ? undefined
                      : { borderColor: LINE.subtle, background: BRAND[50] }
                  }
                  data-field-error={itemError ? "true" : undefined}
                >
                  {item.isCustom ? (
                    <Input
                      value={item.label}
                      onChange={(e) =>
                        updateItem(item.id, { label: e.target.value })
                      }
                      placeholder="Deliverable name"
                      className="min-w-0 flex-1"
                    />
                  ) : (
                    <span
                      className="min-w-0 flex-1 text-sm font-medium leading-snug"
                      style={{ color: INK.primary }}
                    >
                      {item.label}
                    </span>
                  )}
                  {options ? (
                    <div className="w-full sm:w-56 sm:shrink-0">
                      <Select
                        value={item.option || undefined}
                        onValueChange={(v) => updateItem(item.id, { option: v })}
                      >
                        <SelectTrigger className={fieldErrorClass(itemError)}>
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
                      <FieldError message={itemError} />
                    </div>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive"
                    onClick={() =>
                      onChange(deliverables.filter((d) => d.id !== item.id))
                    }
                    aria-label="Remove deliverable"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : null}
        {composerOpen || customs.length > 0 ? (
          <div
            className="flex flex-col gap-3 rounded-xl border border-dashed p-3"
            style={{ borderColor: LINE.strong }}
          >
            <div className="space-y-1.5">
              <Label>Add deliverable</Label>
              <Select value={selectedPresetKey || undefined} onValueChange={handlePresetPick}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose from catalog or custom…" />
                </SelectTrigger>
                <SelectContent>
                  {availableDefinitions.map((def) => (
                    <SelectItem key={def.key} value={def.key}>
                      {def.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_DELIVERABLE_OPTION}>
                    Custom deliverable
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isCustomPick ? (
              <div className="space-y-1.5">
                <Label>Custom deliverable</Label>
                <Input
                  ref={inputRef}
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="e.g. Logo on main stage backdrop"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustom();
                    }
                  }}
                />
              </div>
            ) : selectedDefinition?.options ? (
              <div className="space-y-1.5">
                <Label>Option</Label>
                <Select value={selectedOption} onValueChange={setSelectedOption}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedDefinition.options.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {isCustomPick ? (
                <Button
                  type="button"
                  onClick={addCustom}
                  disabled={!canAddCustom}
                  className="rounded-full"
                >
                  Add
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={addPreset}
                  disabled={!canAddPreset}
                  className="rounded-full"
                >
                  Add
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={resetComposer}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
        {customs.length > 0 && !composerOpen ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setComposerOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add deliverable
          </Button>
        ) : null}
        <FieldError message={packageError} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {standard.map((item) => {
          const def = PARTNER_DELIVERABLE_DEFINITIONS.find(
            (d) => d.key === item.key
          );
          const options = def?.options;
          const itemError = errors[`${eventId}-${item.id}`];
          return (
            <li
              key={item.id}
              className={fieldErrorSurfaceClass(
                itemError,
                "flex flex-col gap-2 rounded-xl border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              )}
              style={{
                borderColor: itemError ? undefined : LINE.subtle,
                background: item.included ? BRAND[50] : PAPER.muted,
              }}
              data-field-error={itemError ? "true" : undefined}
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                <Checkbox
                  checked={item.included}
                  onCheckedChange={(v) => {
                    const included = v === true;
                    const patch: Partial<PartnerDeliverable> = { included };
                    if (included && options?.length && !item.option) {
                      patch.option = options[0];
                    }
                    updateItem(item.id, patch);
                  }}
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
                    <SelectTrigger className={fieldErrorClass(itemError)}>
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
                  <FieldError message={itemError} />
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
              {getPartnershipTierLabel(ep) || "No tier"}
            </span>
          </div>

          <div className="space-y-5 p-4 sm:p-5">
            {isCustomPartnership(ep) ? (
              <div
                className="rounded-xl border px-3 py-2 text-xs font-medium"
                style={{
                  borderColor: "rgba(176,125,42,0.28)",
                  background: "rgba(176,125,42,0.08)",
                  color: "#8A6A2F",
                }}
              >
                Custom tier — build the deliverable list for this package
              </div>
            ) : null}
            <div>
              <p
                className="mb-3 text-sm font-semibold"
                style={{ color: INK.primary }}
              >
                {isCustomPartnership(ep)
                  ? "Custom deliverables"
                  : "Package deliverables"}
              </p>
              <EventDeliverableList
                eventId={ep.eventId}
                deliverables={ep.deliverables}
                onChange={(deliverables) =>
                  patchEvent(ep.eventId, { deliverables })
                }
                errors={errors}
                customPackage={isCustomPartnership(ep)}
              />
            </div>

            <div
              className={fieldErrorSurfaceClass(
                errors[`seminar-slots-${ep.eventId}`],
                "rounded-xl border p-4"
              )}
              style={
                errors[`seminar-slots-${ep.eventId}`]
                  ? undefined
                  : { borderColor: LINE.subtle, background: isCustomPartnership(ep)
                      ? `linear-gradient(135deg, ${BRAND[50]} 0%, ${PAPER.muted} 100%)`
                      : PAPER.muted }
              }
              data-field-error={
                errors[`seminar-slots-${ep.eventId}`] ? "true" : undefined
              }
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
                      {isCustomPartnership(ep)
                        ? "Include panel seats in this custom package if applicable — pick seminars in the next step."
                        : "Total seats for this event — you'll pick which seminars in the next step."}
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
                    className={fieldErrorClass(
                      errors[`seminar-slots-${ep.eventId}`],
                      "w-20 text-center tabular-nums"
                    )}
                    aria-invalid={Boolean(errors[`seminar-slots-${ep.eventId}`])}
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
