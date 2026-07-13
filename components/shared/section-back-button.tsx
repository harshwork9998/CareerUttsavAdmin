"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { NAV_ITEMS } from "@/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * One level up for nested routes (`/events/id/edit` → `/events/id`).
 * Top-level nav pages return null (no back).
 */
export function getSectionBackHref(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length <= 1) return null;
  return `/${segments.slice(0, -1).join("/")}`;
}

export function getSectionBackLabel(pathname: string): string {
  const href = getSectionBackHref(pathname);
  if (!href) return "Back";

  const nav = NAV_ITEMS.find((item) => item.href === href);
  if (nav) return `Back to ${nav.title}`;

  if (href.split("/").filter(Boolean).length === 1) {
    const section = NAV_ITEMS.find((item) => item.href === `/${href.split("/")[1] ?? href.slice(1)}`);
    if (section) return `Back to ${section.title}`;
  }

  return "Back";
}

export interface SectionBackButtonProps {
  /** Override auto path; omit to derive from current pathname. */
  href?: string;
  label?: string;
  className?: string;
  /** Prefer history when available; falls back to href. */
  preferHistory?: boolean;
}

export function SectionBackButton({
  href,
  label,
  className,
  preferHistory = false,
}: SectionBackButtonProps) {
  const pathname = usePathname();
  const router = useRouter();
  const autoHref = getSectionBackHref(pathname);
  const target = href ?? autoHref;

  if (!target) return null;

  const text = label ?? (href ? "Back" : getSectionBackLabel(pathname));

  const handleClick = (e: React.MouseEvent) => {
    if (!preferHistory) return;
    e.preventDefault();
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(target);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      asChild={!preferHistory}
      onClick={preferHistory ? handleClick : undefined}
      className={cn(
        "h-9 gap-1.5 rounded-full border-brand-900/15 bg-white px-3 font-medium text-brand-950 shadow-sm hover:bg-brand-50/80",
        className
      )}
    >
      {preferHistory ? (
        <>
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{text}</span>
          <span className="sm:hidden">Back</span>
        </>
      ) : (
        <Link href={target}>
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{text}</span>
          <span className="sm:hidden">Back</span>
        </Link>
      )}
    </Button>
  );
}
