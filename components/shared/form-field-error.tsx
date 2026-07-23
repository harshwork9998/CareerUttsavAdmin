"use client";

import { toast } from "sonner";

import { cn } from "@/lib/utils";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-xs font-medium text-destructive" role="alert">
      {message}
    </p>
  );
}

/** Red border / ring for inputs, selects, and triggers when invalid. */
export function fieldErrorClass(
  error?: string | boolean,
  className?: string
) {
  return cn(
    className,
    error &&
      "border-destructive ring-1 ring-destructive/25 focus-visible:ring-destructive/40 aria-invalid:border-destructive"
  );
}

/** Red border for custom wrappers (amount fields, cards, list rows). */
export function fieldErrorSurfaceClass(
  error?: string | boolean,
  className?: string
) {
  return cn(
    className,
    error && "border-destructive ring-1 ring-destructive/20"
  );
}

export function scrollToFirstFormError() {
  const target = document.querySelector('[data-field-error="true"]');
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function applyFormErrors(
  setErrors: (errors: Record<string, string>) => void,
  next: Record<string, string>,
  toastMessage = "Fix the highlighted fields before continuing"
): boolean {
  setErrors(next);
  if (Object.keys(next).length === 0) return false;
  toast.error(toastMessage);
  requestAnimationFrame(() => scrollToFirstFormError());
  return true;
}
