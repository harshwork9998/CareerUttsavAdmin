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

function splitByWeights(
  total: number,
  weights: number[]
): number[] {
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
    // Core classes (9–12) get more weight; slight per-seminar variation
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
