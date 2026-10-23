"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { addDays, nextSaturday } from "date-fns";

import { eventsService } from "@/services/api";
import {
  formatEventCitiesDescription,
  getEventCities,
} from "@/lib/event-cities";
import { BRAND, INK, LINE, PAPER } from "@/features/dashboard/dashboard-ui";
import {
  DateField,
  TimeField,
  toISODate,
} from "@/features/events/event-datetime-fields";
import { SeminarTitleCombobox } from "@/features/events/seminar-title-combobox";
import {
  eventSaveErrorMessage,
  seminarDraftsFromEvent,
  seminarEditorLegacyLabel,
  seminarSavePayload,
  type SeminarDraft,
} from "@/lib/event-seminar-drafts";
import {
  SEMINAR_SCHEDULE_UNSET_LABEL,
  seminarDraftScheduleErrors,
} from "@/lib/seminar-schedule";
import type { Event, EventSeminar } from "@/types";
import { generateId } from "@/lib/utils";
import {
  FieldError,
  fieldErrorClass,
  fieldErrorSurfaceClass,
  applyFormErrors,
} from "@/components/shared/form-field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function defaultFairStart(): string {
  return toISODate(nextSaturday(new Date()));
}

const AUDI_OPTIONS = [1, 2, 3] as const;
const DAY_OPTIONS = [1, 2, 3] as const;

function endFromStart(start: string, days: number): string {
  if (!start) return "";
  return toISODate(addDays(new Date(`${start}T12:00:00`), Math.max(0, days - 1)));
}

function inclusiveDayCount(start: string, end: string): number {
  const days = eachDayInclusive(start, end || start);
  return Math.min(3, Math.max(1, days.length || 1));
}

function OptionPills({
  options,
  value,
  onChange,
}: {
  options: readonly number[];
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((n) => {
        const selected = value === n;
        return (
          <motion.button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="inline-flex h-9 min-w-9 items-center justify-center rounded-full px-4 text-sm font-medium"
            initial={false}
            animate={{
              backgroundColor: selected ? BRAND[700] : PAPER.muted,
              color: selected ? "#ffffff" : INK.secondary,
              borderColor: selected ? BRAND[700] : LINE.subtle,
              scale: selected ? 1.04 : 1,
            }}
            transition={{
              type: "spring",
              stiffness: 380,
              damping: 28,
            }}
            style={{ borderWidth: 1, borderStyle: "solid" }}
          >
            {n}
          </motion.button>
        );
      })}
    </div>
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

function eachDayInclusive(start: string, end: string): string[] {
  if (!start || !end || end < start) return start ? [start] : [];
  const days: string[] = [];
  const cur = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (cur <= last) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    days.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function emptySeminar(): SeminarDraft {
  return {
    key: generateId(),
    title: "",
    date: "",
    startTime: "",
    endTime: "",
    panelistSlots: null,
    hall: null,
  };
}

function toDateOnly(value: string): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return value.slice(0, 10);
}

export interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, dialog edits this event instead of creating. */
  event?: Event | null;
}

export function CreateEventDialog({
  open,
  onOpenChange,
  event = null,
}: CreateEventDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <EventEditor
          key={
          event
            ? `${event.id}:${event.updatedAt}:${(event.seminars ?? [])
                .map((seminar) => seminar.id)
                .join(",")}`
            : "create"
        }
          open={open}
          onOpenChange={onOpenChange}
          event={event}
        />
      ) : null}
    </Dialog>
  );
}

function EventEditor({
  onOpenChange,
  event = null,
}: CreateEventDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(event);
  const initialDrafts = event ? seminarDraftsFromEvent(event) : [];
  const initialStart = event ? toDateOnly(event.startDate) : defaultFairStart();
  const persistedSeminarIds = new Set(
    (event?.seminars ?? []).map((seminar) => seminar.id).filter(Boolean)
  );
  const eventsQuery = useQuery({
    queryKey: ["events"],
    queryFn: () => eventsService.getAll(),
    enabled: true,
  });
  const cityPlaceholder = useMemo(() => {
    const cities = getEventCities(eventsQuery.data ?? []);
    return cities.length > 0
      ? `e.g. ${formatEventCitiesDescription(cities)}`
      : "e.g. Bangalore";
  }, [eventsQuery.data]);

  const [title, setTitle] = useState(event?.title ?? "");
  const [city, setCity] = useState(event?.city ?? "");
  const [venue, setVenue] = useState(event?.venue ?? "");
  const [startDate, setStartDate] = useState(initialStart);
  const [dayCount, setDayCount] = useState(
    event ? inclusiveDayCount(initialStart, toDateOnly(event.endDate)) : 2
  );
  const [startTime, setStartTime] = useState(event?.startTime || "09:00");
  const [endTime, setEndTime] = useState(event?.endTime || "18:00");
  const [hallCount, setHallCount] = useState(
    event ? Math.min(3, Math.max(1, event.hallCount || 1)) : 1
  );
  const [seminars, setSeminars] = useState<SeminarDraft[]>(initialDrafts);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const persistedSeminarSignature = (event?.seminars ?? [])
    .map((seminar) =>
      [
        seminar.id,
        seminar.title,
        seminar.date ?? "",
        seminar.startTime ?? "",
        seminar.endTime ?? "",
        seminar.hall ?? "",
        seminar.panelistSlots ?? "",
      ].join("\u001f")
    )
    .join("\n");

  useEffect(() => {
    if (!event) return;
    setSeminars(seminarDraftsFromEvent(event));
  }, [persistedSeminarSignature]);

  const endDate = useMemo(
    () => endFromStart(startDate, dayCount),
    [startDate, dayCount]
  );
  const dayOptions = useMemo(
    () => eachDayInclusive(startDate, endDate || startDate),
    [startDate, endDate]
  );
  const isSingleDay = dayOptions.length <= 1;
  const hallOptions = useMemo(
    () => Array.from({ length: Math.max(1, hallCount) }, (_, i) => i + 1),
    [hallCount]
  );

  const setHallCountAndClamp = (next: number) => {
    setHallCount(next);
    setSeminars((prev) =>
      prev.map((row) =>
        row.hall != null && row.hall > next ? { ...row, hall: next } : row
      )
    );
  };

  const setCount = (next: number) => {
    const n = Math.max(0, Math.min(20, next));
    setSeminars((prev) => {
      if (n === prev.length) return prev;
      if (n < prev.length) return prev.slice(0, n);
      const added = Array.from({ length: n - prev.length }, () =>
        emptySeminar()
      );
      return [...prev, ...added];
    });
  };

  const updateSeminar = (index: number, patch: Partial<SeminarDraft>) => {
    setSeminars((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "Event name is required";
    if (!city.trim()) next.city = "City is required";
    else if (city.trim().length < 2) next.city = "Enter at least 2 characters";
    if (!startDate) next.startDate = "Date of event is required";
    if (!DAY_OPTIONS.includes(dayCount as (typeof DAY_OPTIONS)[number])) {
      next.dayCount = "Select 1, 2, or 3 days";
    }
    if (!startTime) next.startTime = "Start time is required";
    if (!endTime) next.endTime = "End time is required";
    if (startTime && endTime && endTime <= startTime) {
      next.endTime = "End time must be after start time";
    }
    if (!AUDI_OPTIONS.includes(hallCount as (typeof AUDI_OPTIONS)[number])) {
      next.hallCount = "Select 1, 2, or 3 audis";
    }

    seminars.forEach((row, i) => {
      if (!row.title) next[`sem-${i}-title`] = "Select a seminar";
      const scheduleErrors = seminarDraftScheduleErrors({
        ...row,
        allowedDates: dayOptions,
        hallCount,
      });
      if (scheduleErrors.date) next[`sem-${i}-date`] = scheduleErrors.date;
      if (scheduleErrors.hall) next[`sem-${i}-hall`] = scheduleErrors.hall;
      if (scheduleErrors.startTime) next[`sem-${i}-start`] = scheduleErrors.startTime;
      if (scheduleErrors.endTime) next[`sem-${i}-end`] = scheduleErrors.endTime;
      if (scheduleErrors.panelistSlots) {
        next[`sem-${i}-slots`] = scheduleErrors.panelistSlots;
      }
    });

    if (applyFormErrors(setErrors, next)) return false;
    return true;
  };

  function seminarHasError(index: number) {
    return Object.keys(errors).some((key) => key.startsWith(`sem-${index}-`));
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const seminarPayload: EventSeminar[] = seminarSavePayload(seminars);

      if (event) {
        const cityValue = city.trim();
        return eventsService.update(event.id, {
          title: title.trim(),
          slug: slugify(title.trim()),
          shortDescription: `${title.trim()} — ${cityValue}`,
          description: event.description || `${title.trim()} career fair in ${cityValue}.`,
          venue: venue.trim(),
          city: cityValue,
          startDate,
          endDate,
          startTime,
          endTime,
          hallCount,
          seminars: seminarPayload,
          registrationDeadline: startDate,
        });
      }

      const cityValue = city.trim();
      const payload: Omit<Event, "id" | "createdAt" | "updatedAt"> = {
        title: title.trim(),
        slug: slugify(title.trim()),
        description: `${title.trim()} career fair in ${cityValue}.`,
        shortDescription: `${title.trim()} — ${cityValue}`,
        status: "Draft",
        venue: venue.trim(),
        address: "",
        city: cityValue,
        state: "Karnataka",
        pincode: "",
        startDate,
        endDate,
        startTime,
        endTime,
        hallCount,
        seminars: seminarPayload,
        registrationDeadline: startDate,
        maxCapacity: 10000,
        registrationCount: 0,
        checkInCount: 0,
        isFeatured: false,
        tags: [],
        createdBy: "usr-001",
      };

      return eventsService.create(payload);
    },
    onSuccess: (saved) => {
      if (!saved) {
        toast.error(isEditing ? "Failed to update event" : "Failed to create event");
        return;
      }
      queryClient.setQueryData<Event[]>(["events"], (old) => {
        if (!old) return [saved];
        if (isEditing) {
          return old.map((e) => (e.id === saved.id ? saved : e));
        }
        return [saved, ...old];
      });
      queryClient.setQueryData(["events", saved.id], saved);
      void queryClient.invalidateQueries({ queryKey: ["events"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["registrations"] });
      void queryClient.invalidateQueries({ queryKey: ["partners"] });
      void queryClient.invalidateQueries({ queryKey: ["seminar-rosters"] });
      toast.success(isEditing ? "Event updated" : "Event created");
      onOpenChange(false);
    },
    onError: (error: unknown) =>
      toast.error(
        eventSaveErrorMessage(
          error,
          isEditing ? "Failed to update event" : "Failed to create event"
        )
      ),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    saveMutation.mutate();
  };

  return (
      <DialogContent
        hideClose
        className="flex max-h-[75vh] w-[75vw] max-w-[75vw] flex-col gap-0 overflow-hidden rounded-2xl border p-0 shadow-2xl"
        style={{
          background: `linear-gradient(165deg, ${PAPER.surface} 0%, ${PAPER.muted} 100%)`,
          borderColor: LINE.subtle,
        }}
      >
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader
            className="shrink-0 border-b px-6 py-5 text-left"
            style={{ borderColor: LINE.subtle }}
          >
            <DialogTitle style={{ color: INK.primary }}>
              {isEditing ? "Edit event" : "Create event"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {isEditing ? "Edit Career Uttsav event" : "Create a Career Uttsav event"}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-6 py-5">
            {/* Section A — Event details */}
            <section className="space-y-4">
              <h3
                className="text-sm font-semibold tracking-wide uppercase"
                style={{ color: BRAND[700] }}
              >
                Event details
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2" data-field-error={errors.title ? "true" : undefined}>
                  <Label htmlFor="ce-title">Event name</Label>
                  <Input
                    id="ce-title"
                    className={fieldErrorClass(errors.title)}
                    aria-invalid={Boolean(errors.title)}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  <FieldError message={errors.title} />
                </div>

                <div className="space-y-2" data-field-error={errors.city ? "true" : undefined}>
                  <Label htmlFor="ce-city">City of conduction</Label>
                  <Input
                    id="ce-city"
                    className={fieldErrorClass(errors.city)}
                    aria-invalid={Boolean(errors.city)}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder={cityPlaceholder}
                  />
                  <FieldError message={errors.city} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ce-venue">
                    Venue{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="ce-venue"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                  />
                </div>

                <div className="space-y-2" data-field-error={errors.startDate ? "true" : undefined}>
                  <Label htmlFor="ce-event-date">Date of event</Label>
                  <DateField
                    id="ce-event-date"
                    value={startDate}
                    onChange={setStartDate}
                    error={errors.startDate}
                  />
                  <FieldError message={errors.startDate} />
                </div>

                <div className="space-y-2">
                  <Label>Number of days</Label>
                  <OptionPills
                    options={DAY_OPTIONS}
                    value={dayCount}
                    onChange={setDayCount}
                  />
                  <FieldError message={errors.dayCount} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ce-start-time">Start time</Label>
                  <TimeField
                    id="ce-start-time"
                    value={startTime}
                    onChange={setStartTime}
                  />
                  <FieldError message={errors.startTime} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ce-end-time">End time</Label>
                  <TimeField
                    id="ce-end-time"
                    value={endTime}
                    min={startTime || undefined}
                    onChange={setEndTime}
                  />
                  <FieldError message={errors.endTime} />
                </div>

                <div className="space-y-2">
                  <Label>Number of audis</Label>
                  <OptionPills
                    options={AUDI_OPTIONS}
                    value={hallCount}
                    onChange={setHallCountAndClamp}
                  />
                  <FieldError message={errors.hallCount} />
                </div>
              </div>
            </section>

            {/* Section B — Seminars */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h3
                  className="text-sm font-semibold tracking-wide uppercase"
                  style={{ color: BRAND[700] }}
                >
                  Seminar details
                </h3>
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">
                    Number of seminars
                  </Label>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCount(seminars.length - 1)}
                      disabled={seminars.length <= 0}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span
                      className="inline-flex h-8 min-w-8 items-center justify-center px-2 text-sm font-medium tabular-nums"
                      style={{ color: INK.primary }}
                      aria-live="polite"
                    >
                      {seminars.length}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCount(seminars.length + 1)}
                      disabled={seminars.length >= 20}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              {seminars.length === 0 ? null : (
                <div className="space-y-4">
                  {seminars.map((row, index) => (
                    <div
                      key={row.key}
                      className={fieldErrorSurfaceClass(
                        seminarHasError(index),
                        "rounded-xl border p-4"
                      )}
                      style={
                        seminarHasError(index)
                          ? undefined
                          : { borderColor: LINE.subtle, background: PAPER.surface }
                      }
                      data-field-error={seminarHasError(index) ? "true" : undefined}
                    >
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <p
                          className="text-xs font-medium"
                          style={{ color: INK.secondary }}
                        >
                          Seminar {index + 1}
                        </p>
                        {(() => {
                          const legacyLabel = seminarEditorLegacyLabel(row.title);
                          return legacyLabel ? (
                            <span
                              className="rounded-md border px-2 py-0.5 text-[11px] font-medium"
                              style={{
                                borderColor: LINE.subtle,
                                color: INK.secondary,
                              }}
                            >
                              {legacyLabel}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                          <Label>Seminar title</Label>
                          {persistedSeminarIds.has(row.key) ? (
                            <Input
                              value={row.title}
                              onChange={(e) =>
                                updateSeminar(index, { title: e.target.value })
                              }
                            />
                          ) : (
                            <SeminarTitleCombobox
                              value={row.title}
                              onChange={(v) =>
                                updateSeminar(index, { title: v })
                              }
                            />
                          )}
                          {errors[`sem-${index}-title`] && (
                            <FieldError message={errors[`sem-${index}-title`]} />
                          )}
                        </div>

                        {!isSingleDay && (
                          <div className="space-y-2">
                            <Label>Day</Label>
                            <Select
                              value={row.date || "__unset__"}
                            onValueChange={(v) =>
                              updateSeminar(index, {
                                date: v === "__unset__" ? "" : v,
                              })
                            }
                              disabled={!dayOptions.length}
                            >
                              <SelectTrigger
                                className={fieldErrorClass(
                                  errors[`sem-${index}-date`]
                                )}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__unset__">
                                  {SEMINAR_SCHEDULE_UNSET_LABEL}
                                </SelectItem>
                                {dayOptions.map((d, dayIndex) => (
                                  <SelectItem key={d} value={d}>
                                    Day {dayIndex + 1}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FieldError message={errors[`sem-${index}-date`]} />
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label>Audi</Label>
                          <Select
                            value={row.hall == null ? "__unset__" : String(row.hall)}
                            onValueChange={(v) =>
                              updateSeminar(index, {
                                hall: v === "__unset__" ? null : Number(v),
                              })
                            }
                          >
                            <SelectTrigger
                              className={fieldErrorClass(
                                errors[`sem-${index}-hall`]
                              )}
                            >
                              <SelectValue />
                            </SelectTrigger>
                              <SelectContent>
                              <SelectItem value="__unset__">
                                {SEMINAR_SCHEDULE_UNSET_LABEL}
                              </SelectItem>
                              {hallOptions.map((h) => (
                                <SelectItem key={h} value={String(h)}>
                                  Audi {h}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FieldError message={errors[`sem-${index}-hall`]} />
                        </div>

                        <div className="space-y-2">
                          <Label>Start time</Label>
                          <TimeField
                            value={row.startTime}
                            placeholder={SEMINAR_SCHEDULE_UNSET_LABEL}
                            onChange={(v) => {
                              const [h, m] = v.split(":").map(Number);
                              const endH = Math.min(22, h + 1);
                              const nextEnd = `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                              updateSeminar(index, {
                                startTime: v,
                                endTime:
                                  !row.endTime || row.endTime <= v
                                    ? nextEnd
                                    : row.endTime,
                              });
                            }}
                          />
                          <FieldError message={errors[`sem-${index}-start`]} />
                        </div>

                        <div className="space-y-2">
                          <Label>End time</Label>
                          <TimeField
                            value={row.endTime}
                            placeholder={SEMINAR_SCHEDULE_UNSET_LABEL}
                            min={row.startTime || undefined}
                            onChange={(v) =>
                              updateSeminar(index, { endTime: v })
                            }
                          />
                          <FieldError message={errors[`sem-${index}-end`]} />
                        </div>

                        <div className="space-y-2">
                          <Label>Panelist slots</Label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className={fieldErrorClass(
                              errors[`sem-${index}-slots`],
                              "h-10 w-14 text-center tabular-nums"
                            )}
                            aria-invalid={Boolean(errors[`sem-${index}-slots`])}
                            value={row.panelistSlots ?? ""}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/\D/g, "");
                              if (raw === "") {
                                updateSeminar(index, { panelistSlots: null });
                                return;
                              }
                              const n = Math.min(20, Number(raw));
                              updateSeminar(index, { panelistSlots: n });
                            }}
                          />
                          <FieldError message={errors[`sem-${index}-slots`]} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <DialogFooter
            className="shrink-0 gap-2 border-t px-6 py-4 sm:space-x-0"
            style={{ borderColor: LINE.subtle, background: PAPER.surface }}
          >
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saveMutation.isPending}
              style={{ backgroundColor: BRAND[700] }}
              className="text-white hover:opacity-90"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? "Saving…" : "Creating…"}
                </>
              ) : isEditing ? (
                "Save changes"
              ) : (
                "Create event"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
  );
}
