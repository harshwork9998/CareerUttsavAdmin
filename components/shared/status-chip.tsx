import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusVariant =
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "destructive"
  | "muted"
  | "pending";

const STATUS_VARIANT_MAP: Record<string, StatusVariant> = {
  pending: "pending",
  draft: "muted",
  confirmed: "success",
  approved: "success",
  published: "success",
  live: "success",
  active: "success",
  completed: "secondary",
  "checked in": "success",
  "changes requested": "warning",
  rejected: "destructive",
  cancelled: "destructive",
  canceled: "destructive",
  archived: "muted",
  inactive: "muted",
  failed: "destructive",
  error: "destructive",
};

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase();
}

function getVariantForStatus(status: string): StatusVariant {
  return STATUS_VARIANT_MAP[normalizeStatus(status)] ?? "default";
}

export interface StatusChipProps extends Omit<BadgeProps, "variant"> {
  status: string;
  variant?: StatusVariant;
  dot?: boolean;
}

export function StatusChip({
  status,
  variant,
  dot = true,
  className,
  ...props
}: StatusChipProps) {
  const resolvedVariant = variant ?? getVariantForStatus(status);

  return (
    <Badge
      variant={resolvedVariant as BadgeProps["variant"]}
      className={cn("gap-1.5 capitalize", className)}
      {...props}
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80"
          aria-hidden
        />
      )}
      {status}
    </Badge>
  );
}

export { getVariantForStatus, STATUS_VARIANT_MAP };
