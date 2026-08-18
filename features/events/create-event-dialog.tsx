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

type SeminarDraft = {
  key: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  panelistSlots: number;
  hall: number;
};

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

function emptySeminar(date: string, hall = 1): SeminarDraft {
  return {
    key: generateId(),
    title: "",
    date,
    startTime: "10:00",
    endTime: "11:00",
    panelistSlots: 2,
    hall,
  };
}

function toDateOnly(value: string): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return value.slice(0, 10);
}

function seminarDraftsFromEvent(event: Event): SeminarDraft[] {
  return (event.seminars ?? []).map((s) => ({
    key: s.id || generateId(),
    title: s.title,
    date: toDateOnly(s.date),
    startTime: s.startTime,
    endTime: s.endTime,
    panelistSlots: s.panelistSlots,
    hall: s.hall || 1,
  }));
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
  const queryClient = useQueryClient();
  const isEditing = Boolean(event);
  const eventsQuery = useQuery({
    queryKey: ["events"],
    queryFn: () => eventsService.getAll(),
    enabled: open,
  });
  const cityPlaceholder = useMemo(() => {
    const cities = getEventCities(eventsQuery.data ?? []);
    return cities.length > 0
      ? `e.g. ${formatEventCitiesDescription(cities)}`
      : "e.g. Bangalore";
  }, [eventsQuery.data]);

  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [venue, setVenue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dayCount, setDayCount] = useState(2);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [hallCount, setHallCount] = useState(1);
  const [seminarCount, setSeminarCount] = useState(0);
  const [seminars, setSeminars] = useState<SeminarDraft[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (event) {
      const drafts = seminarDraftsFromEvent(event);
      const eventStart = toDateOnly(event.startDate);
      const eventEnd = toDateOnly(event.endDate);
      setTitle(event.title);
      setCity(event.city ?? "");
      setVenue(event.venue ?? "");
      setStartDate(eventStart);
      setDayCount(inclusiveDayCount(eventStart, eventEnd));
      setStartTime(event.startTime || "09:00");
      setEndTime(event.endTime || "18:00");
      setHallCount(Math.min(3, Math.max(1, event.hallCount || 1)));
      setSeminarCount(drafts.length);
      setSeminars(drafts);
      return;
    }
    setTitle("");
    setCity("");
    setVenue("");
    setStartDate(defaultFairStart());
    setDayCount(2);
    setStartTime("09:00");
    setEndTime("18:00");
    setHallCount(1);
    setSeminarCount(0);
    setSeminars([]);
  }, [open, event]);

  useEffect(() => {
    if (!dayOptions.length) return;
    setSeminars((prev) =>
      prev.map((row) =>
        dayOptions.includes(row.date)
          ? row
          : { ...row, date: dayOptions[0] }
      )
    );
  }, [dayOptions]);

  useEffect(() => {
    setSeminars((prev) =>
      prev.map((row) =>
        row.hall > hallCount ? { ...row, hall: hallCount } : row
      )
    );
  }, [hallCount]);

  const setCount = (next: number) => {
    const n = Math.max(0, Math.min(20, next));
    setSeminarCount(n);
    setSeminars((prev) => {
      if (n === prev.length) return prev;
      if (n < prev.length) return prev.slice(0, n);
      const defaultDay = dayOptions[0] || startDate || "";
      const added = Array.from({ length: n - prev.length }, () =>
        emptySeminar(defaultDay, 1)
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
      if (!row.date || !dayOptions.includes(row.date)) {
        next[`sem-${i}-date`] = "Select a day";
      }
      if (!row.hall || row.hall < 1 || row.hall > hallCount) {
        next[`sem-${i}-hall`] = "Select an audi";
      }
      if (!row.startTime) next[`sem-${i}-start`] = "Required";
      if (!row.endTime) next[`sem-${i}-end`] = "Required";
      if (row.startTime && row.endTime && row.endTime <= row.startTime) {
        next[`sem-${i}-end`] = "Must be after start";
      }
      if (!row.panelistSlots || row.panelistSlots < 1) {
        next[`sem-${i}-slots`] = "At least 1 slot";
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
      const seminarPayload: EventSeminar[] = seminars.map((row) => ({
        id: row.key,
        title: row.title,
        date: row.date,
        startTime: row.startTime,
        endTime: row.endTime,
        panelistSlots: row.panelistSlots,
        hall: row.hall,
      }));

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
    onError: () =>
      toast.error(isEditing ? "Failed to update event" : "Failed to create event"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                    onChange={setHallCount}
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
                      onClick={() => setCount(seminarCount - 1)}
                      disabled={seminarCount <= 0}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span
                      className="inline-flex h-8 min-w-8 items-center justify-center px-2 text-sm font-medium tabular-nums"
                      style={{ color: INK.primary }}
                      aria-live="polite"
                    >
                      {seminarCount}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCount(seminarCount + 1)}
                      disabled={seminarCount >= 20}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              {seminarCount === 0 ? null : (
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
                      <p
                        className="mb-3 text-xs font-medium"
                        style={{ color: INK.secondary }}
                      >
                        Seminar {index + 1}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                          <Label>Seminar title</Label>
                          <SeminarTitleCombobox
                            value={row.title}
                            onChange={(v) =>
                              updateSeminar(index, { title: v })
                            }
                          />
                          {errors[`sem-${index}-title`] && (
                            <FieldError message={errors[`sem-${index}-title`]} />
                          )}
                        </div>

                        {!isSingleDay && (
                          <div className="space-y-2">
                            <Label>Day</Label>
                            <Select
                              value={row.date || undefined}
                              onValueChange={(v) =>
                                updateSeminar(index, { date: v })
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
                            value={String(row.hall)}
                            onValueChange={(v) =>
                              updateSeminar(index, { hall: Number(v) })
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
                            value={row.panelistSlots || ""}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/\D/g, "");
                              if (raw === "") {
                                updateSeminar(index, { panelistSlots: 0 });
                                return;
                              }
                              const n = Math.min(20, Number(raw));
                              updateSeminar(index, { panelistSlots: n });
                            }}
                            onBlur={() => {
                              if (row.panelistSlots < 1) {
                                updateSeminar(index, { panelistSlots: 1 });
                              }
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
    </Dialog>
  );
}
