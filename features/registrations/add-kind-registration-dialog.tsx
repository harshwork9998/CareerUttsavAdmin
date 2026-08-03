"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { registrationsService } from "@/services/api";
import {
  REGISTRATION_CLASS_OPTIONS,
  type CreatePartnerRegistrationInput,
  type CreateRegistrationInput,
  type CreateSchoolRegistrationInput,
  type CreateStudentAmbassadorRegistrationInput,
} from "@/lib/registration-validation";
import { REGISTRATION_KIND_LABELS } from "@/lib/registration-kinds";
import type { Event, RegistrationKind } from "@/types";
import {
  applyFormErrors,
  FieldError,
  fieldErrorClass,
} from "@/components/shared/form-field-error";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type NonStudentKind = Exclude<RegistrationKind, "student">;

type SchoolFormState = {
  eventId: string;
  schoolContactName: string;
  schoolName: string;
  schoolCity: string;
  schoolContactNumber: string;
  schoolContactEmail: string;
};

type PartnerFormState = {
  eventId: string;
  partnerRegContactName: string;
  partnerRegInstitutionName: string;
  partnerRegCity: string;
  partnerRegContactNumber: string;
  partnerRegContactEmail: string;
};

type AmbassadorFormState = {
  eventId: string;
  ambassadorName: string;
  ambassadorClass: string;
  ambassadorSchoolCollege: string;
  ambassadorAge: string;
  ambassadorPhone: string;
  ambassadorEmail: string;
};

type FormState = SchoolFormState | PartnerFormState | AmbassadorFormState;

const EMPTY_BY_KIND: Record<NonStudentKind, FormState> = {
  school: {
    eventId: "",
    schoolContactName: "",
    schoolName: "",
    schoolCity: "",
    schoolContactNumber: "",
    schoolContactEmail: "",
  },
  partner_registration: {
    eventId: "",
    partnerRegContactName: "",
    partnerRegInstitutionName: "",
    partnerRegCity: "",
    partnerRegContactNumber: "",
    partnerRegContactEmail: "",
  },
  student_ambassador: {
    eventId: "",
    ambassadorName: "",
    ambassadorClass: "",
    ambassadorSchoolCollege: "",
    ambassadorAge: "",
    ambassadorPhone: "",
    ambassadorEmail: "",
  },
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function AddKindRegistrationDialog({
  kind,
  open,
  onOpenChange,
  events,
}: {
  kind: NonStudentKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: Event[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY_BY_KIND[kind] });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const sortedEvents = useMemo(
    () =>
      [...events].sort(
        (a, b) =>
          a.city.localeCompare(b.city) || a.title.localeCompare(b.title)
      ),
    [events]
  );

  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY_BY_KIND[kind] });
    setErrors({});
  }, [open, kind]);

  const patch = (updates: Record<string, string>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const validate = (): CreateRegistrationInput | null => {
    const next: Record<string, string> = {};
    if (!form.eventId) next.eventId = "Select an event";

    if (kind === "school") {
      const f = form as SchoolFormState;
      if (f.schoolContactName.trim().length < 2) next.schoolContactName = "Name is required";
      if (f.schoolName.trim().length < 2) next.schoolName = "School name is required";
      if (f.schoolCity.trim().length < 2) next.schoolCity = "City is required";
      if (phoneDigits(f.schoolContactNumber).length < 10) {
        next.schoolContactNumber = "Contact number is required";
      }
      if (!isValidEmail(f.schoolContactEmail.trim())) {
        next.schoolContactEmail = "Valid email is required";
      }
      if (applyFormErrors(setErrors, next)) return null;
      const payload: CreateSchoolRegistrationInput = {
        kind: "school",
        eventId: f.eventId,
        schoolContactName: f.schoolContactName.trim(),
        schoolName: f.schoolName.trim(),
        schoolCity: f.schoolCity.trim(),
        schoolContactNumber: f.schoolContactNumber.trim(),
        schoolContactEmail: f.schoolContactEmail.trim(),
      };
      return payload;
    }

    if (kind === "partner_registration") {
      const f = form as PartnerFormState;
      if (f.partnerRegContactName.trim().length < 2) {
        next.partnerRegContactName = "Name is required";
      }
      if (f.partnerRegInstitutionName.trim().length < 2) {
        next.partnerRegInstitutionName = "Institution name is required";
      }
      if (f.partnerRegCity.trim().length < 2) next.partnerRegCity = "City is required";
      if (phoneDigits(f.partnerRegContactNumber).length < 10) {
        next.partnerRegContactNumber = "Contact number is required";
      }
      if (!isValidEmail(f.partnerRegContactEmail.trim())) {
        next.partnerRegContactEmail = "Valid email is required";
      }
      if (applyFormErrors(setErrors, next)) return null;
      const payload: CreatePartnerRegistrationInput = {
        kind: "partner_registration",
        eventId: f.eventId,
        partnerRegContactName: f.partnerRegContactName.trim(),
        partnerRegInstitutionName: f.partnerRegInstitutionName.trim(),
        partnerRegCity: f.partnerRegCity.trim(),
        partnerRegContactNumber: f.partnerRegContactNumber.trim(),
        partnerRegContactEmail: f.partnerRegContactEmail.trim(),
      };
      return payload;
    }

    const f = form as AmbassadorFormState;
    if (f.ambassadorName.trim().length < 2) next.ambassadorName = "Name is required";
    if (!f.ambassadorClass) next.ambassadorClass = "Select a class";
    if (f.ambassadorSchoolCollege.trim().length < 2) {
      next.ambassadorSchoolCollege = "School/college is required";
    }
    const age = Number(f.ambassadorAge);
    if (!Number.isFinite(age) || age < 10 || age > 25) {
      next.ambassadorAge = "Enter age between 10 and 25";
    }
    if (phoneDigits(f.ambassadorPhone).length < 10) {
      next.ambassadorPhone = "Contact number is required";
    }
    if (!isValidEmail(f.ambassadorEmail.trim())) {
      next.ambassadorEmail = "Valid email is required";
    }
    if (applyFormErrors(setErrors, next)) return null;
    const payload: CreateStudentAmbassadorRegistrationInput = {
      kind: "student_ambassador",
      eventId: f.eventId,
      ambassadorName: f.ambassadorName.trim(),
      ambassadorClass: f.ambassadorClass,
      ambassadorSchoolCollege: f.ambassadorSchoolCollege.trim(),
      ambassadorAge: age,
      ambassadorPhone: f.ambassadorPhone.trim(),
      ambassadorEmail: f.ambassadorEmail.trim(),
    };
    return payload;
  };

  const createMutation = useMutation({
    mutationFn: (payload: CreateRegistrationInput) =>
      registrationsService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["registrations"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Registration added successfully");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not add registration");
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
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="border-b px-6 py-5 text-left">
            <DialogTitle>Add {REGISTRATION_KIND_LABELS[kind]}</DialogTitle>
            <DialogDescription>
              Fields are specific to this registration type only.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div
              className="space-y-2"
              data-field-error={errors.eventId ? "true" : undefined}
            >
              <Label htmlFor={`${kind}-event`}>Event *</Label>
              <Select
                value={form.eventId || undefined}
                onValueChange={(value) => patch({ eventId: value })}
              >
                <SelectTrigger
                  id={`${kind}-event`}
                  className={fieldErrorClass(errors.eventId)}
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

            {kind === "school" && (
              <>
                <Field
                  id="schoolContactName"
                  label="Name *"
                  value={(form as SchoolFormState).schoolContactName}
                  error={errors.schoolContactName}
                  onChange={(v) => patch({ schoolContactName: v })}
                />
                <Field
                  id="schoolName"
                  label="School Name *"
                  value={(form as SchoolFormState).schoolName}
                  error={errors.schoolName}
                  onChange={(v) => patch({ schoolName: v })}
                />
                <Field
                  id="schoolCity"
                  label="City *"
                  value={(form as SchoolFormState).schoolCity}
                  error={errors.schoolCity}
                  onChange={(v) => patch({ schoolCity: v })}
                />
                <Field
                  id="schoolContactNumber"
                  label="Contact Number *"
                  value={(form as SchoolFormState).schoolContactNumber}
                  error={errors.schoolContactNumber}
                  onChange={(v) => patch({ schoolContactNumber: v })}
                />
                <Field
                  id="schoolContactEmail"
                  label="Email *"
                  type="email"
                  value={(form as SchoolFormState).schoolContactEmail}
                  error={errors.schoolContactEmail}
                  onChange={(v) => patch({ schoolContactEmail: v })}
                />
              </>
            )}

            {kind === "partner_registration" && (
              <>
                <Field
                  id="partnerRegContactName"
                  label="Name *"
                  value={
                    (form as PartnerFormState)
                      .partnerRegContactName
                  }
                  error={errors.partnerRegContactName}
                  onChange={(v) => patch({ partnerRegContactName: v })}
                />
                <Field
                  id="partnerRegInstitutionName"
                  label="Institution Name *"
                  value={
                    (form as PartnerFormState)
                      .partnerRegInstitutionName
                  }
                  error={errors.partnerRegInstitutionName}
                  onChange={(v) => patch({ partnerRegInstitutionName: v })}
                />
                <Field
                  id="partnerRegCity"
                  label="City *"
                  value={
                    (form as PartnerFormState)
                      .partnerRegCity
                  }
                  error={errors.partnerRegCity}
                  onChange={(v) => patch({ partnerRegCity: v })}
                />
                <Field
                  id="partnerRegContactNumber"
                  label="Contact Number *"
                  value={
                    (form as PartnerFormState)
                      .partnerRegContactNumber
                  }
                  error={errors.partnerRegContactNumber}
                  onChange={(v) => patch({ partnerRegContactNumber: v })}
                />
                <Field
                  id="partnerRegContactEmail"
                  label="Email *"
                  type="email"
                  value={
                    (form as PartnerFormState)
                      .partnerRegContactEmail
                  }
                  error={errors.partnerRegContactEmail}
                  onChange={(v) => patch({ partnerRegContactEmail: v })}
                />
              </>
            )}

            {kind === "student_ambassador" && (
              <>
                <Field
                  id="ambassadorName"
                  label="Name *"
                  value={
                    (form as AmbassadorFormState)
                      .ambassadorName
                  }
                  error={errors.ambassadorName}
                  onChange={(v) => patch({ ambassadorName: v })}
                />
                <div
                  className="space-y-2"
                  data-field-error={errors.ambassadorClass ? "true" : undefined}
                >
                  <Label htmlFor="ambassadorClass">Class *</Label>
                  <Select
                    value={
                      (form as AmbassadorFormState)
                        .ambassadorClass || undefined
                    }
                    onValueChange={(value) => patch({ ambassadorClass: value })}
                  >
                    <SelectTrigger
                      id="ambassadorClass"
                      className={fieldErrorClass(errors.ambassadorClass)}
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
                  <FieldError message={errors.ambassadorClass} />
                </div>
                <Field
                  id="ambassadorSchoolCollege"
                  label="School/College Name *"
                  value={
                    (form as AmbassadorFormState)
                      .ambassadorSchoolCollege
                  }
                  error={errors.ambassadorSchoolCollege}
                  onChange={(v) => patch({ ambassadorSchoolCollege: v })}
                />
                <Field
                  id="ambassadorAge"
                  label="Age *"
                  type="number"
                  value={
                    (form as AmbassadorFormState)
                      .ambassadorAge
                  }
                  error={errors.ambassadorAge}
                  onChange={(v) => patch({ ambassadorAge: v })}
                />
                <Field
                  id="ambassadorPhone"
                  label="Number *"
                  value={
                    (form as AmbassadorFormState)
                      .ambassadorPhone
                  }
                  error={errors.ambassadorPhone}
                  onChange={(v) => patch({ ambassadorPhone: v })}
                />
                <Field
                  id="ambassadorEmail"
                  label="Email *"
                  type="email"
                  value={
                    (form as AmbassadorFormState)
                      .ambassadorEmail
                  }
                  error={errors.ambassadorEmail}
                  onChange={(v) => patch({ ambassadorEmail: v })}
                />
              </>
            )}
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
                "Add registration"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  value,
  error,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2" data-field-error={error ? "true" : undefined}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={fieldErrorClass(error)}
        aria-invalid={Boolean(error)}
      />
      <FieldError message={error} />
    </div>
  );
}
