/**
 * Current Career Uttsav seminar catalogue.
 * Website registration, WhatsApp artwork numbers, admin suggestions,
 * and current dashboard buckets all use this list.
 *
 * Historical registrations may still store LEGACY_CAREER_UTTSAV_SEMINARS.
 * Those titles stay readable and are not rewritten onto this list.
 */
export const CAREER_UTTSAV_SEMINARS = [
  "Do What You Love, Love What You Do",
  "Engineering Next: What’s Ahead?",
  "Design, Architecture & Creative Careers",
  "The Future of Management Careers",
  "Liberal Arts: Careers Without Limits",
  "Careers in Commerce & Finance",
  "Your Journey to Study Abroad",
  "Careers in Medicine & Health Sciences",
  "Building a Successful Career in Law",
  "Startups, Leadership & Entrepreneurship",
  "How to Fund Your Higher Education",
  "Engineering: Careers of the Future",
  "Careers Beyond the Usual",
  "How to Score Better in Board Exams?",
] as const;

export type CareerUttsavSeminar = (typeof CAREER_UTTSAV_SEMINARS)[number];

/**
 * Previous 20-title catalogue. Kept so historical registrations, events,
 * and analytics remain readable. Not a current registration choice list.
 */
export const LEGACY_CAREER_UTTSAV_SEMINARS = [
  "How to select a stream – Art – Science – Commerce?",
  "All about Overseas Education",
  "How to Choose the right Boarding School?",
  "Cracking the codes to ace competitive exams",
  "How sustainable are sustainable careers?",
  "Architecture - A Promising Creative Career",
  "Careers in Management & Entrepreneurship",
  "Careers in Multimedia & Animation",
  "Design in the Digital World",
  "Designing a Career in world of fashion",
  "How to score well in Board Exams?",
  "If Career Plan A fails, remember there are 25 more letters",
  "New age skills to build at 16",
  "Is CA / CS My Cup of Tea?",
  "Liberated careers with liberal arts",
  "Medicine in the 21st century",
  "New-age Engineering Careers",
  "Offbeat Careers",
  "Real Careers with Artificial Intelligence",
  "In the Course of 'Law'",
] as const;

const LEGACY_SEMINAR_TITLES = new Set<string>(LEGACY_CAREER_UTTSAV_SEMINARS);
const CURRENT_SEMINAR_TITLES = new Set<string>(CAREER_UTTSAV_SEMINARS);

export function isLegacyCareerUttsavSeminarTitle(title: string): boolean {
  return LEGACY_SEMINAR_TITLES.has(title.trim());
}

/**
 * Exact membership in the current 14-title catalogue.
 * An event seminar whose title is not in that list is legacy for
 * current registration and current interest charts.
 */
export function isCurrentCareerUttsavSeminar(title: string): boolean {
  return CURRENT_SEMINAR_TITLES.has(title.trim());
}

/** Relative weights for mock seminar registration counts. */
const SEMINAR_POPULARITY_WEIGHTS = [
  44, 100, 76, 72, 56, 68, 80, 92, 52, 60, 48, 64, 40, 88,
] as const;

export const SEMINAR_POPULARITY: Record<string, number> = Object.fromEntries(
  CAREER_UTTSAV_SEMINARS.map((name, index) => [
    name,
    SEMINAR_POPULARITY_WEIGHTS[index] ?? 20,
  ])
);

export function buildSeminarChartData(totalRegistrations: number) {
  const weightSum = Object.values(SEMINAR_POPULARITY).reduce((a, b) => a + b, 0);
  return CAREER_UTTSAV_SEMINARS.map((name) => {
    const weight = SEMINAR_POPULARITY[name] ?? 20;
    return {
      name,
      value: Math.max(12, Math.round((totalRegistrations * weight) / weightSum)),
    };
  }).sort((a, b) => b.value - a.value);
}

/** Mock seminar interest counts for an event's scheduled sessions. */
export function buildEventSeminarRegistrationItems(
  seminarTitles: readonly string[],
  totalRegistrations: number
): Array<{ name: string; value: number }> {
  const uniqueTitles = [...new Set(seminarTitles.map((title) => title.trim()).filter(Boolean))];
  if (uniqueTitles.length === 0) return [];

  if (totalRegistrations <= 0) {
    return uniqueTitles.map((name) => ({ name, value: 0 }));
  }

  const weights = uniqueTitles.map((title) => SEMINAR_POPULARITY[title] ?? 20);
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const counts = uniqueTitles.map((name, index) => ({
    name,
    value: Math.max(
      1,
      Math.round(((weights[index] ?? 20) / weightSum) * totalRegistrations * 0.85)
    ),
  }));

  const allocated = counts.reduce((sum, row) => sum + row.value, 0);
  const remainder = Math.max(0, totalRegistrations - allocated);
  if (remainder > 0 && counts[0]) {
    counts[0] = { ...counts[0], value: counts[0].value + remainder };
  }

  return counts.sort((a, b) => b.value - a.value);
}

/** Current seminar tracks for dashboard career-interest analytics. */
export const CAREER_INTEREST_CATEGORIES = [
  {
    id: "science-tech",
    label: "Science & Technology",
    emoji: "🧪",
    seminars: [
      CAREER_UTTSAV_SEMINARS[1],
      CAREER_UTTSAV_SEMINARS[7],
      CAREER_UTTSAV_SEMINARS[11],
    ],
  },
  {
    id: "commerce-management",
    label: "Commerce & Management",
    emoji: "💼",
    seminars: [
      CAREER_UTTSAV_SEMINARS[3],
      CAREER_UTTSAV_SEMINARS[5],
      CAREER_UTTSAV_SEMINARS[9],
      CAREER_UTTSAV_SEMINARS[10],
    ],
  },
  {
    id: "humanities-arts",
    label: "Humanities, Arts & Creative Careers",
    emoji: "🎨",
    seminars: [
      CAREER_UTTSAV_SEMINARS[2],
      CAREER_UTTSAV_SEMINARS[4],
      CAREER_UTTSAV_SEMINARS[8],
      CAREER_UTTSAV_SEMINARS[12],
    ],
  },
  {
    id: "general-guidance",
    label: "General Career Guidance",
    emoji: "🌍",
    seminars: [
      CAREER_UTTSAV_SEMINARS[0],
      CAREER_UTTSAV_SEMINARS[6],
      CAREER_UTTSAV_SEMINARS[13],
    ],
  },
] as const;

export type CareerInterestCategoryId =
  (typeof CAREER_INTEREST_CATEGORIES)[number]["id"];

export type CareerInterestRow = {
  id: CareerInterestCategoryId;
  label: string;
  emoji: string;
  value: number;
  seminars: Array<{ name: string; value: number }>;
};

/**
 * Loose key so punctuation variants of the same current title match
 * (straight vs curly apostrophes, dashes, extra articles).
 * Legacy catalogue titles are never folded into the current 14.
 */
export function seminarMatchKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[''‘’`´"]/g, "")
    .replace(/[–—−‑-]/g, " ")
    .replace(/[:;,./!?()]/g, " ")
    .replace(/\barts\b/g, "art")
    .replace(/\b(a|an|the|of|in|or|and|to|for|with|my)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map a stored title onto a catalogue title only when it is the same seminar. */
export function canonicalizeSeminarTitle(
  title: string,
  catalog: readonly string[] = CAREER_UTTSAV_SEMINARS
): string {
  const trimmed = title.trim();
  if (!trimmed) return trimmed;

  const exact = catalog.find((entry) => entry === trimmed);
  if (exact) return exact;

  if (isLegacyCareerUttsavSeminarTitle(trimmed)) {
    return trimmed;
  }

  const key = seminarMatchKey(trimmed);
  if (!key) return trimmed;

  const hit = catalog.find((entry) => seminarMatchKey(entry) === key);
  return hit ?? trimmed;
}

export function seminarTitlesMatch(a: string, b: string): boolean {
  const left = seminarMatchKey(a);
  const right = seminarMatchKey(b);
  return Boolean(left) && left === right;
}

/** Sum seminar interest counts into the four career tracks. */
export function aggregateByCareerInterest(
  bySeminar: Array<{ name: string; value: number }>
): CareerInterestRow[] {
  const seminarMap = new Map<string, number>();
  for (const row of bySeminar) {
    const name = canonicalizeSeminarTitle(String(row.name));
    seminarMap.set(name, (seminarMap.get(name) ?? 0) + Number(row.value));
  }

  return CAREER_INTEREST_CATEGORIES.map((category) => {
    const seminars = category.seminars.map((name) => ({
      name,
      value: seminarMap.get(name) ?? 0,
    }));
    return {
      id: category.id,
      label: category.label,
      emoji: category.emoji,
      value: seminars.reduce((sum, row) => sum + row.value, 0),
      seminars,
    };
  }).sort((a, b) => b.value - a.value);
}
