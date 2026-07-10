/** Emerald + white dashboard system (Donezo-inspired). Donuts stay colorful. */

export const EMERALD = {
  50: "#ECFDF5",
  100: "#D1FAE5",
  200: "#A7F3D0",
  300: "#6EE7B7",
  400: "#34D399",
  500: "#10B981",
  600: "#059669",
  700: "#047857",
  800: "#065F46",
  900: "#064E3B",
} as const;

export const DASH_COLORS = {
  primary: EMERALD[600],
  secondary: EMERALD[500],
  accent: EMERALD[400],
  deep: EMERALD[800],
  muted: "#94A3B8",
  soft: EMERALD[100],
  danger: "#EF4444",
  warning: "#F59E0B",
  success: EMERALD[600],
  series: [
    EMERALD[800],
    EMERALD[600],
    EMERALD[500],
    EMERALD[400],
    EMERALD[300],
  ],
  /** Soft mint page wash */
  paper: EMERALD[50],
  /** Hero / featured card gradient */
  gradient: `linear-gradient(145deg, ${EMERALD[900]} 0%, ${EMERALD[700]} 55%, ${EMERALD[600]} 100%)`,
  gradientSoft: `linear-gradient(160deg, ${EMERALD[800]} 0%, ${EMERALD[600]} 100%)`,
} as const;

/** City columns — deeper emerald (not bright mint). */
export const CITY_GREEN: Record<string, string> = {
  Bangalore: EMERALD[900],
  Mysore: EMERALD[700],
  Hubli: EMERALD[600],
};

/** Colorful donut palette only — exception to green/white scheme. */
export const DONUT_COLORS = [
  "#059669",
  "#2563EB",
  "#E11D48",
  "#EAB308",
  "#8B5CF6",
  "#F97316",
  "#06B6D4",
  "#EC4899",
  "#64748B",
] as const;

export const sectionMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
};

/** Shared card border — visible on every dashboard card. */
export const cardBorder = "border border-emerald-900/15";

/**
 * Surfaces — white cards on mint ground, plus filled emerald heroes.
 */
export const surface = {
  opening: `relative overflow-hidden rounded-[24px] ${cardBorder} bg-white shadow-[0_8px_30px_rgba(6,78,59,0.06)]`,
  /** Solid emerald gradient panel (primary KPI style) */
  featured: `relative overflow-hidden rounded-[24px] ${cardBorder} text-white shadow-[0_12px_40px_rgba(5,150,105,0.28)]`,
  band: `rounded-2xl ${cardBorder} bg-emerald-50/80`,
  interactive: `rounded-xl ${cardBorder} bg-white transition-colors hover:bg-emerald-50/60`,
  mint: `relative overflow-hidden rounded-[20px] ${cardBorder} bg-emerald-50/90 shadow-[0_4px_20px_rgba(6,78,59,0.04)]`,
  bare: "",
} as const;

export const labelClass =
  "text-[11px] font-medium tracking-[0.04em] text-muted-foreground";

export const displayClass = "font-display tracking-tight";
