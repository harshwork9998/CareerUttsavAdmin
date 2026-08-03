/** Career Uttsav seminar catalogue — used for registration interest analytics. */
export const CAREER_UTTSAV_SEMINARS = [
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

export type CareerUttsavSeminar = (typeof CAREER_UTTSAV_SEMINARS)[number];

/** Popularity weights for mock seminar registration counts (relative). */
export const SEMINAR_POPULARITY: Record<string, number> = {
  "Real Careers with Artificial Intelligence": 100,
  "How to select a stream – Art – Science – Commerce?": 92,
  "Cracking the codes to ace competitive exams": 88,
  "Medicine in the 21st century": 84,
  "New-age Engineering Careers": 80,
  "All about Overseas Education": 76,
  "Careers in Management & Entrepreneurship": 72,
  "Is CA / CS My Cup of Tea?": 68,
  "Design in the Digital World": 64,
  "How to score well in Board Exams?": 60,
  "In the Course of 'Law'": 56,
  "Architecture - A Promising Creative Career": 52,
  "Careers in Multimedia & Animation": 48,
  "Liberated careers with liberal arts": 44,
  "Designing a Career in world of fashion": 40,
  "New age skills to build at 16": 38,
  "How to Choose the right Boarding School?": 34,
  "Offbeat Careers": 30,
  "How sustainable are sustainable careers?": 28,
  "If Career Plan A fails, remember there are 25 more letters": 26,
};

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

/** Seminar tracks — registration interest grouped for dashboard analytics. */
export const CAREER_INTEREST_CATEGORIES = [
  {
    id: "science-tech",
    label: "Science & Technology",
    emoji: "🧪",
    seminars: [
      "Real Careers with Artificial Intelligence",
      "New-age Engineering Careers",
      "Medicine in the 21st century",
      "Architecture - A Promising Creative Career",
      "How sustainable are sustainable careers?",
      "Cracking the codes to ace competitive exams",
    ],
  },
  {
    id: "commerce-management",
    label: "Commerce & Management",
    emoji: "💼",
    seminars: [
      "Careers in Management & Entrepreneurship",
      "Is CA / CS My Cup of Tea?",
    ],
  },
  {
    id: "humanities-arts",
    label: "Humanities, Arts & Creative Careers",
    emoji: "🎨",
    seminars: [
      "Liberated careers with liberal arts",
      "In the Course of 'Law'",
      "Careers in Multimedia & Animation",
      "Design in the Digital World",
      "Designing a Career in world of fashion",
      "Offbeat Careers",
    ],
  },
  {
    id: "general-guidance",
    label: "General Career Guidance",
    emoji: "🌍",
    seminars: [
      "How to select a stream – Art – Science – Commerce?",
      "All about Overseas Education",
      "How to Choose the right Boarding School?",
      "How to score well in Board Exams?",
      "If Career Plan A fails, remember there are 25 more letters",
      "New age skills to build at 16",
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

/** Sum seminar interest counts into the four career tracks. */
export function aggregateByCareerInterest(
  bySeminar: Array<{ name: string; value: number }>
): CareerInterestRow[] {
  const seminarMap = new Map(
    bySeminar.map((row) => [String(row.name), Number(row.value)])
  );

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
