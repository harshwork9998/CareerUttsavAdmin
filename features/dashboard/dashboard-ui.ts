/**
 * Career Uttsav color language
 * Deep Navy + White brand, warm stone neutrals, soft brass accent, muted teal secondary.
 */

export const BRAND = {
  50: "#F3F6FA",
  100: "#E8EEF6",
  500: "#3A5F96",
  600: "#2A4A7A",
  700: "#1F3864",
  800: "#1A2F52",
  900: "#12233F",
  950: "#0B1628",
} as const;

export const INK = {
  primary: "#1C2430",
  secondary: "#5A6574",
  muted: "#7A8696",
  disabled: "#A8B0BC",
} as const;

export const PAPER = {
  page: "#F7F6F3",
  surface: "#FFFFFF",
  elevated: "#FFFFFF",
  muted: "#F1F0EC",
} as const;

export const LINE = {
  subtle: "#E6E4DE",
  strong: "#D4D1C8",
} as const;

export const BRASS = {
  100: "#F5EEDC",
  500: "#C4A35A",
  700: "#8A6A2F",
} as const;

export const TEAL = {
  100: "#E4F3F2",
  500: "#0E7C7B",
  700: "#0B5F5E",
} as const;

export const STATUS = {
  success: "#2F6B4F",
  successSoft: "rgba(47, 107, 79, 0.12)",
  warning: "#B07D2A",
  warningSoft: "rgba(176, 125, 42, 0.14)",
  error: "#A33B3B",
  errorSoft: "rgba(163, 59, 59, 0.12)",
  info: "#3D5A80",
  infoSoft: "rgba(61, 90, 128, 0.12)",
  neutral: "#7A8696",
  neutralSoft: "rgba(122, 134, 150, 0.12)",
} as const;

/** City identities — same color everywhere. Future cities can extend this map. */
export const CITY_COLORS: Record<string, string> = {
  Bangalore: BRAND[700],
};

/** Cohesive chart series — navy → teal → brass family. */
export const CHART_SERIES = [
  BRAND[700],
  TEAL[500],
  BRASS[500],
  "#3D5A80",
  "#8B6B5A",
  "#5E7D7A",
  "#A67C7C",
  INK.muted,
] as const;

export const ELEVATION = {
  1: "0 1px 2px rgba(18,35,63,0.04), 0 6px 20px rgba(18,35,63,0.05)",
  2: "0 4px 12px rgba(18,35,63,0.08), 0 16px 40px rgba(18,35,63,0.08)",
  3: "0 12px 40px rgba(11,22,40,0.18)",
  active: "0 12px 36px rgba(18,35,63,0.22)",
} as const;

export const cardBorder = "border border-[rgba(212,209,200,0.85)]";

export const DASH_COLORS = {
  primary: BRAND[700],
  secondary: TEAL[500],
  accent: BRASS[500],
  deep: BRAND[900],
  muted: INK.muted,
  soft: BRAND[100],
  danger: STATUS.error,
  warning: STATUS.warning,
  success: STATUS.success,
  info: STATUS.info,
  series: [...CHART_SERIES],
  paper: PAPER.page,
  gradient: `linear-gradient(145deg, ${BRAND[900]} 0%, ${BRAND[700]} 55%, ${BRAND[600]} 100%)`,
  gradientSoft: `linear-gradient(160deg, ${BRAND[800]} 0%, ${BRAND[700]} 100%)`,
} as const;

/** @deprecated Use CITY_COLORS */
export const CITY_GREEN = CITY_COLORS;

/** @deprecated Use CHART_SERIES */
export const DONUT_COLORS = CHART_SERIES;

/** @deprecated Use BRAND */
export const EMERALD = BRAND;

export const sectionMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
};

/**
 * Surfaces — white cards on warm stone, navy featured heroes.
 */
export const surface = {
  opening:
    "relative overflow-hidden rounded-[24px] border border-[rgba(212,209,200,0.85)] bg-white shadow-[0_1px_2px_rgba(18,35,63,0.04),0_6px_20px_rgba(18,35,63,0.05)]",
  featured:
    "relative overflow-hidden rounded-[24px] border border-[rgba(212,209,200,0.85)] text-white shadow-[0_12px_36px_rgba(18,35,63,0.22)]",
  band: "rounded-2xl border border-[rgba(212,209,200,0.85)] bg-[#F1F0EC]/80",
  interactive:
    "rounded-xl border border-[rgba(212,209,200,0.85)] bg-white transition-colors hover:bg-[#F3F6FA]/80",
  mint: "relative overflow-hidden rounded-[20px] border border-[rgba(212,209,200,0.85)] bg-[#F1F0EC]/90 shadow-[0_1px_2px_rgba(18,35,63,0.04),0_6px_20px_rgba(18,35,63,0.05)]",
  bare: "",
} as const;

export const labelClass =
  "text-[11px] font-medium tracking-[0.04em] text-muted-foreground";

export const displayClass = "font-display tracking-tight";
