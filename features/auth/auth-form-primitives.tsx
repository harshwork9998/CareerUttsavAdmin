"use client";

import { type LucideIcon, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const AUTH_INPUT_CLASS = cn(
  "h-[46px] rounded-[11px] border-[#E2E5EB] bg-white pl-10 pr-10 text-sm shadow-none",
  "transition-[border-color,box-shadow] duration-200 ease-out",
  "focus-visible:border-[#1F3864] focus-visible:ring-0 focus-visible:outline-none",
  "focus-visible:shadow-[0_0_0_3px_rgba(31,56,100,0.1)]"
);

export const AUTH_CARD_CLASS = cn(
  "w-full rounded-[18px] border border-[#E8EAED] bg-white",
  "px-7 py-7 sm:px-9 sm:py-8",
  "shadow-[0_1px_2px_rgba(16,24,40,0.04),0_6px_20px_rgba(16,24,40,0.05)]"
);

export const AUTH_PRIMARY_BUTTON_CLASS = cn(
  "h-[46px] w-full rounded-[11px] text-sm font-medium text-white",
  "bg-[#1F3864] shadow-none transition-colors duration-200",
  "hover:bg-[#182E52] hover:shadow-[0_4px_12px_rgba(31,56,100,0.18)]"
);

export const AUTH_SECONDARY_BUTTON_CLASS = cn(
  "h-[46px] w-full rounded-[11px] border-[#E2E5EB] bg-white text-sm font-semibold text-[#1F3864]",
  "shadow-none transition-colors duration-200 hover:bg-[#F7F8FA]"
);

export const AUTH_LINK_CLASS =
  "text-sm font-semibold text-[#1F3864] transition-colors hover:text-[#1F3864]/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F3864]/25 focus-visible:ring-offset-2 rounded-sm";

export function AuthFieldShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative transition-transform duration-200 ease-out focus-within:scale-[1.008]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function AuthFormField({
  id,
  label,
  error,
  icon: Icon,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <AuthFieldShell>
        {Icon ? (
          <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground/55" />
        ) : null}
        {children}
      </AuthFieldShell>
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function AuthPrimaryButton({
  children,
  loading,
  loadingLabel,
  className,
  ...props
}: React.ComponentProps<typeof Button> & {
  loading?: boolean;
  loadingLabel?: string;
}) {
  return (
    <Button
      type="submit"
      disabled={loading || props.disabled}
      className={cn(AUTH_PRIMARY_BUTTON_CLASS, className)}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {loadingLabel ?? "Please wait..."}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

export function AuthTextInput({
  className,
  invalid,
  ...props
}: React.ComponentProps<typeof Input> & { invalid?: boolean }) {
  return (
    <Input
      className={cn(AUTH_INPUT_CLASS, invalid && "border-destructive", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function AuthFormAlert({
  variant,
  message,
}: {
  variant: "success" | "error";
  message: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-[11px] border px-4 py-3 text-sm leading-relaxed",
        variant === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-red-200 bg-red-50 text-red-900"
      )}
    >
      {message}
    </div>
  );
}
