import { BRAND } from "@/constants";

export const DASH_COLORS = {
  primary: BRAND.primary,
  secondary: BRAND.secondary,
  accent: BRAND.accent,
  muted: "#94A3B8",
  soft: "#E2E8F0",
  danger: "#DC2626",
  warning: "#D97706",
  success: BRAND.secondary,
  series: [BRAND.primary, BRAND.secondary, BRAND.accent, "#64748B", "#94A3B8"],
  /** Soft paper wash behind the opening — navy tint, not cream. */
  paper: "rgba(31, 56, 100, 0.035)",
} as const;

export const sectionMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
};

/**
 * Surfaces — soft premium cards on quiet grey (reference craft, CU brand).
 */
export const surface = {
  /** Hero / primary panel */
  opening:
    "relative overflow-hidden rounded-[24px] border border-border/40 bg-card shadow-soft",
  /** Soft inset for secondary bands. */
  band: "rounded-2xl bg-muted/30",
  /** Only when a control cluster needs a hit target. */
  interactive:
    "rounded-xl border border-border/50 bg-card transition-colors hover:bg-muted/30",
  bare: "",
} as const;

export const labelClass =
  "text-[11px] font-medium tracking-[0.04em] text-muted-foreground";

/** Display numerals / section titles — Fraunces when loaded on dashboard. */
export const displayClass = "font-display tracking-tight";
