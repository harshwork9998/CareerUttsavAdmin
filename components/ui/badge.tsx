import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-sm",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground shadow-sm",
        outline: "text-foreground",
        success:
          "border-transparent bg-[rgba(47,107,79,0.12)] text-[#2F6B4F] dark:bg-[rgba(47,107,79,0.22)] dark:text-[#7CB89A]",
        warning:
          "border-transparent bg-[rgba(176,125,42,0.14)] text-[#B07D2A] dark:bg-[rgba(176,125,42,0.22)] dark:text-[#D4B06A]",
        destructive:
          "border-transparent bg-[rgba(163,59,59,0.12)] text-[#A33B3B] dark:bg-[rgba(163,59,59,0.22)] dark:text-[#D48989]",
        muted:
          "border-transparent bg-muted text-muted-foreground",
        pending:
          "border-transparent bg-[rgba(61,90,128,0.12)] text-[#3D5A80] dark:bg-[rgba(61,90,128,0.22)] dark:text-[#8FA6C4]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
