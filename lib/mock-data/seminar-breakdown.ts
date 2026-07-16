import type { ChartDataPoint, OperatingCity } from "@/types";
import { OPERATING_CITIES } from "@/lib/mock-data/dashboard-city-slices";

const CLASS_LABELS = [
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
  "Class 11",
  "Class 12",
] as const;

const STREAM_LABELS = ["Science", "Commerce", "Arts", "Undeclared"] as const;
const BOARD_LABELS = ["CBSE", "ICSE", "State", "IB", "Other"] as const;
const GENDER_LABELS = ["Female", "Male"] as const;

const CITY_SHARE: Record<OperatingCity, number> = {
  Bangalore: 0.52,
  Mysore: 0.28,
  Hubli: 0.2,
};

/** Stable 0–1 hash from a string (for deterministic mock variation). */
function hash01(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return (h % 1000) / 1000;
}

function splitByWeights(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (w / sum) * total);
  const floored = raw.map((v) => Math.floor(v));
  let remainder = total - floored.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < remainder; k++) {
    floored[order[k % order.length].i] += 1;
  }
  return floored;
}

function weightedSeries(
  seed: string,
  labels: readonly string[],
  total: number,
  weightFn: (label: string, index: number) => number
): ChartDataPoint[] {
  const weights = labels.map((label, index) =>
    Math.max(
      0.05,
      weightFn(label, index) * (0.75 + hash01(`${seed}:${label}`) * 0.5)
    )
  );
  const counts = splitByWeights(total, weights);
  return labels
    .map((name, i) => ({ name, value: counts[i] }))
    .filter((row) => row.value > 0);
}

export interface SeminarCityBreakdown {
  city: OperatingCity;
  total: number;
  byClass: ChartDataPoint[];
}

export interface SeminarBreakdown {
  name: string;
  total: number;
  byCity: SeminarCityBreakdown[];
}

/** City-scoped seminar profile for individual-city dashboard popups. */
export interface SeminarCityProfile {
  name: string;
  city: OperatingCity;
  total: number;
  byGender: ChartDataPoint[];
  byClass: ChartDataPoint[];
  byBoard: ChartDataPoint[];
  byStream: ChartDataPoint[];
}

/**
 * Build city × class registration breakdown for a seminar.
 * Totals reconcile to the seminar's overall count.
 */
export function buildSeminarBreakdown(
  name: string,
  total: number
): SeminarBreakdown {
  const cityWeights = OPERATING_CITIES.map(
    (city) => CITY_SHARE[city] * (0.85 + hash01(`${name}:${city}`) * 0.3)
  );
  const cityTotals = splitByWeights(total, cityWeights);

  const byCity: SeminarCityBreakdown[] = OPERATING_CITIES.map((city, i) => {
    const cityTotal = cityTotals[i];
    const classWeights = CLASS_LABELS.map((label, idx) => {
      const isCore = idx >= 5;
      const base = isCore ? 1.6 + (idx - 5) * 0.25 : 0.55 + idx * 0.08;
      return base * (0.7 + hash01(`${name}:${city}:${label}`) * 0.6);
    });
    const classCounts = splitByWeights(cityTotal, classWeights);
    return {
      city,
      total: cityTotal,
      byClass: CLASS_LABELS.map((label, idx) => ({
        name: label,
        value: classCounts[idx],
        segment: idx >= 5 ? "core" : "lower",
      })),
    };
  });

  return { name, total, byCity };
}

/**
 * Build gender / class / board / stream mix for one seminar in one city.
 */
export function buildSeminarCityProfile(
  name: string,
  total: number,
  city: OperatingCity
): SeminarCityProfile {
  const seed = `${name}:${city}`;

  return {
    name,
    city,
    total,
    byGender: weightedSeries(seed, GENDER_LABELS, total, (label) =>
      label === "Female" ? 1.08 : 1
    ),
    byClass: weightedSeries(seed, CLASS_LABELS, total, (_label, idx) => {
      const isCore = idx >= 5;
      return isCore ? 1.6 + (idx - 5) * 0.25 : 0.55 + idx * 0.08;
    }),
    byBoard: weightedSeries(seed, BOARD_LABELS, total, (label) => {
      if (label === "CBSE") return 1.4;
      if (label === "State") return 1.15;
      if (label === "ICSE") return 0.95;
      if (label === "IB") return 0.35;
      return 0.45;
    }),
    byStream: weightedSeries(seed, STREAM_LABELS, total, (label) => {
      if (label === "Science") return 1.45;
      if (label === "Commerce") return 1.1;
      if (label === "Arts") return 0.75;
      return 0.4;
    }),
  };
}
