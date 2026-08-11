"use client";

import { useState } from "react";

import {
  constrainIndianMobileTyping,
  INDIAN_MOBILE_ERROR,
  isValidIndianMobile,
  normalizeIndianMobileInput,
  resolveIndianMobilePaste,
} from "@/lib/indian-mobile";
import { FieldError, fieldErrorClass } from "@/components/shared/form-field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type IndianMobileInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  /** When editing legacy values, show as-is until the user edits. */
  className?: string;
  placeholder?: string;
};

/**
 * Shared Indian mobile field: tel keyboard, 10-digit typing cap, paste normalize.
 * Does not rewrite historical display values until onChange/onPaste fires.
 */
export function IndianMobileInput({
  id,
  label,
  value,
  onChange,
  error,
  required,
  className,
  placeholder = "10-digit mobile number",
}: IndianMobileInputProps) {
  const [pasteError, setPasteError] = useState<string | undefined>();
  const displayError = error ?? pasteError;

  return (
    <div
      className={cn("space-y-2", className)}
      data-field-error={displayError ? "true" : undefined}
    >
      <Label htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        maxLength={10}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          setPasteError(undefined);
          onChange(constrainIndianMobileTyping(e.target.value));
        }}
        onPaste={(e) => {
          e.preventDefault();
          const clipboard = e.clipboardData.getData("text");
          const mobile = resolveIndianMobilePaste(clipboard);
          if (mobile) {
            setPasteError(undefined);
            onChange(mobile);
            return;
          }
          // Do not truncate invalid paste into a fabricated number.
          setPasteError(INDIAN_MOBILE_ERROR);
        }}
        onBlur={() => {
          const canonical = normalizeIndianMobileInput(value);
          if (canonical && canonical !== value) onChange(canonical);
        }}
        className={fieldErrorClass(displayError)}
        aria-invalid={Boolean(displayError)}
      />
      <FieldError message={displayError} />
    </div>
  );
}

export function indianMobileFieldError(
  value: string,
  options?: { required?: boolean; emptyMessage?: string }
): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    if (options?.required) {
      return options.emptyMessage ?? "Mobile number is required";
    }
    return undefined;
  }
  if (!isValidIndianMobile(trimmed)) return INDIAN_MOBILE_ERROR;
  return undefined;
}
