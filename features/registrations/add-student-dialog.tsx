"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { registrationsService } from "@/services/api";
import { cn } from "@/lib/utils";
import {
  REGISTRATION_BOARD_OPTIONS,
  REGISTRATION_CLASS_OPTIONS,
  REGISTRATION_GENDER_OPTIONS,
  REGISTRATION_STREAM_OPTIONS,
  MAX_SEMINAR_INTERESTS,
  type CreateStudentRegistrationInput,
} from "@/lib/registration-validation";
import type { Event } from "@/types";
import {
  indianMobileFieldError,
  IndianMobileInput,
} from "@/components/forms/indian-mobile-input";
import { normalizeIndianMobileInput } from "@/lib/indian-mobile";
import {
  applyFormErrors,
  FieldError,
  fieldErrorClass,
} from "@/components/shared/form-field-error";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EMPTY_FORM = {
  studentName: "",
  college: "",
  eventId: "",
  classLabel: "",
  interestedStream: "",
  board: "",
  seminarInterests: [] as string[],
  city: "",
  gender: "",
  phone: "",
  email: "",
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function AddStudentDialog({
  open,
  onOpenChange,
  events,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: Event[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const sortedEvents = useMemo(
    () =>
      [...events].sort(
        (a, b) =>
          a.city.localeCompare(b.city) || a.title.localeCompare(b.title)
      ),
    [events]
  );

  const selectedEvent = useMemo(
    () => sortedEvents.find((event) => event.id === form.eventId),
    [sortedEvents, form.eventId]
  );

  const seminarOptions = useMemo(() => {
    return (selectedEvent?.seminars ?? [])
      .map((seminar) => seminar.title?.trim())
      .filter(Boolean) as string[];
  }, [selectedEvent]);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_FORM);
    setErrors({});
  }, [open]);

  const patch = (updates: Partial<typeof EMPTY_FORM>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const toggleSeminar = (title: string) => {
    setForm((prev) => {
      const selected = prev.seminarInterests;
      if (selected.includes(title)) {
        return {
          ...prev,
          seminarInterests: selected.filter((item) => item !== title),
        };
      }
      if (selected.length >= MAX_SEMINAR_INTERESTS) {
        toast.error(
          `Students can choose at most ${MAX_SEMINAR_INTERESTS} seminars`
        );
        return prev;
      }
      return { ...prev, seminarInterests: [...selected, title] };
    });
  };

  const selectedSeminarCount = form.seminarInterests.length;
  const atSeminarLimit = selectedSeminarCount >= MAX_SEMINAR_INTERESTS;

  const validate = (): CreateStudentRegistrationInput | null => {
    const next: Record<string, string> = {};

    if (form.studentName.trim().length < 2) {
      next.studentName = "Student name is required";
    }
    if (form.college.trim().length < 2) {
      next.college = "School/college is required";
    }
    if (!form.eventId) next.eventId = "Select an event";
    if (!form.classLabel) next.classLabel = "Select a class";
    if (!form.interestedStream) next.interestedStream = "Select a stream";
    if (!form.board) next.board = "Select a board";
    if (form.city.trim().length < 2) next.city = "City is required";
    if (!form.gender) next.gender = "Select gender";
    const phoneError = indianMobileFieldError(form.phone, {
      required: true,
      emptyMessage: "Student mobile number is required",
    });
    if (phoneError) next.phone = phoneError;
    if (!isValidEmail(form.email.trim())) {
      next.email = "Enter a valid email address";
    }
    if (form.seminarInterests.length > MAX_SEMINAR_INTERESTS) {
      next.seminarInterests = `Choose at most ${MAX_SEMINAR_INTERESTS} seminars`;
    }

    if (applyFormErrors(setErrors, next)) return null;

    return {
      kind: "student" as const,
      eventId: form.eventId,
      studentName: form.studentName.trim(),
      college: form.college.trim(),
      classLabel: form.classLabel,
      interestedStream: form.interestedStream,
      board: form.board,
      city: form.city.trim(),
      gender: form.gender as CreateStudentRegistrationInput["gender"],
      phone: normalizeIndianMobileInput(form.phone)!,
      email: form.email.trim(),
      seminarInterests:
        form.seminarInterests.length > 0 ? form.seminarInterests : undefined,
    };
  };

  const createMutation = useMutation({
    mutationFn: (payload: CreateStudentRegistrationInput) =>
      registrationsService.create(payload),
    onSuccess: (registration) => {
      void queryClient.invalidateQueries({ queryKey: ["registrations"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success(
        `${
          registration.kind === "student"
            ? registration.studentName
            : "Registration"
        } added successfully`
      );
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not add student");
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = validate();
    if (!payload) return;
    createMutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="border-b px-6 py-5 text-left">
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add student
            </DialogTitle>
            <DialogDescription>
              Enter the same details shown in the registrations table.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div
                className="space-y-2 sm:col-span-2"
                data-field-error={errors.studentName ? "true" : undefined}
              >
                <Label htmlFor="as-student-name">Student Name *</Label>
                <Input
                  id="as-student-name"
                  value={form.studentName}
                  onChange={(e) => patch({ studentName: e.target.value })}
                  className={fieldErrorClass(errors.studentName)}
                  aria-invalid={Boolean(errors.studentName)}
                />
                <FieldError message={errors.studentName} />
              </div>

              <div
                className="space-y-2 sm:col-span-2"
                data-field-error={errors.college ? "true" : undefined}
              >
                <Label htmlFor="as-college">School/College *</Label>
                <Input
                  id="as-college"
                  value={form.college}
                  onChange={(e) => patch({ college: e.target.value })}
                  className={fieldErrorClass(errors.college)}
                  aria-invalid={Boolean(errors.college)}
                />
                <FieldError message={errors.college} />
              </div>

              <div
                className="space-y-2 sm:col-span-2"
                data-field-error={errors.eventId ? "true" : undefined}
              >
                <Label htmlFor="as-event">Event *</Label>
                <Select
                  value={form.eventId || undefined}
                  onValueChange={(value) => {
                    patch({ eventId: value, seminarInterests: [] });
                  }}
                >
                  <SelectTrigger
                    id="as-event"
                    className={fieldErrorClass(errors.eventId)}
                    aria-invalid={Boolean(errors.eventId)}
                  >
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedEvents.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.city} · {event.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={errors.eventId} />
              </div>

              <div
                className="space-y-3 sm:col-span-2"
                data-field-error={errors.seminarInterests ? "true" : undefined}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Seminar</Label>
                  {form.eventId && seminarOptions.length > 0 ? (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {selectedSeminarCount} / {MAX_SEMINAR_INTERESTS} selected
                    </span>
                  ) : null}
                </div>

                {!form.eventId ? (
                  <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                    Select an event first — seminars are loaded from that event.
                  </p>
                ) : seminarOptions.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                    This event has no seminars yet. Add them in Events → edit
                    event.
                  </p>
                ) : (
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-3">
                    {seminarOptions.map((title) => {
                      const checked = form.seminarInterests.includes(title);
                      const disabled = !checked && atSeminarLimit;
                      return (
                        <label
                          key={title}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/60",
                            disabled && "cursor-not-allowed opacity-50",
                            checked && "bg-muted/40"
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={() => toggleSeminar(title)}
                            className="mt-0.5"
                          />
                          <span className="text-sm leading-snug">{title}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Optional — pick up to {MAX_SEMINAR_INTERESTS} seminars for this
                  student.
                </p>
                <FieldError message={errors.seminarInterests} />
              </div>

              <div
                className="space-y-2"
                data-field-error={errors.classLabel ? "true" : undefined}
              >
                <Label htmlFor="as-class">Class *</Label>
                <Select
                  value={form.classLabel || undefined}
                  onValueChange={(value) => patch({ classLabel: value })}
                >
                  <SelectTrigger
                    id="as-class"
                    className={fieldErrorClass(errors.classLabel)}
                    aria-invalid={Boolean(errors.classLabel)}
                  >
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGISTRATION_CLASS_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={errors.classLabel} />
              </div>

              <div
                className="space-y-2"
                data-field-error={errors.interestedStream ? "true" : undefined}
              >
                <Label htmlFor="as-stream">Stream *</Label>
                <Select
                  value={form.interestedStream || undefined}
                  onValueChange={(value) => patch({ interestedStream: value })}
                >
                  <SelectTrigger
                    id="as-stream"
                    className={fieldErrorClass(errors.interestedStream)}
                    aria-invalid={Boolean(errors.interestedStream)}
                  >
                    <SelectValue placeholder="Select stream" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGISTRATION_STREAM_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={errors.interestedStream} />
              </div>

              <div
                className="space-y-2"
                data-field-error={errors.board ? "true" : undefined}
              >
                <Label htmlFor="as-board">Board *</Label>
                <Select
                  value={form.board || undefined}
                  onValueChange={(value) => patch({ board: value })}
                >
                  <SelectTrigger
                    id="as-board"
                    className={fieldErrorClass(errors.board)}
                    aria-invalid={Boolean(errors.board)}
                  >
                    <SelectValue placeholder="Select board" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGISTRATION_BOARD_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={errors.board} />
              </div>

              <div
                className="space-y-2"
                data-field-error={errors.city ? "true" : undefined}
              >
                <Label htmlFor="as-city">City *</Label>
                <Input
                  id="as-city"
                  value={form.city}
                  onChange={(e) => patch({ city: e.target.value })}
                  className={fieldErrorClass(errors.city)}
                  aria-invalid={Boolean(errors.city)}
                />
                <FieldError message={errors.city} />
              </div>

              <div
                className="space-y-2"
                data-field-error={errors.gender ? "true" : undefined}
              >
                <Label htmlFor="as-gender">Gender *</Label>
                <Select
                  value={form.gender || undefined}
                  onValueChange={(value) => patch({ gender: value })}
                >
                  <SelectTrigger
                    id="as-gender"
                    className={fieldErrorClass(errors.gender)}
                    aria-invalid={Boolean(errors.gender)}
                  >
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGISTRATION_GENDER_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={errors.gender} />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <IndianMobileInput
                  id="as-phone"
                  label="Student Mobile Number"
                  required
                  value={form.phone}
                  onChange={(phone) => patch({ phone })}
                  error={errors.phone}
                />
              </div>

              <div
                className="space-y-2 sm:col-span-2"
                data-field-error={errors.email ? "true" : undefined}
              >
                <Label htmlFor="as-email">Email Address *</Label>
                <Input
                  id="as-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => patch({ email: e.target.value })}
                  className={fieldErrorClass(errors.email)}
                  aria-invalid={Boolean(errors.email)}
                />
                <FieldError message={errors.email} />
              </div>
            </div>
          </div>

          <DialogFooter className="border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Add student"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
