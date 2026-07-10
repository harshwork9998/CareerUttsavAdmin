/** Career Utsav seminar catalogue — used for registration interest analytics. */
export const CAREER_UTSAV_SEMINARS = [
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

export type CareerUtsavSeminar = (typeof CAREER_UTSAV_SEMINARS)[number];

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
  return CAREER_UTSAV_SEMINARS.map((name) => {
    const weight = SEMINAR_POPULARITY[name] ?? 20;
    return {
      name,
      value: Math.max(12, Math.round((totalRegistrations * weight) / weightSum)),
    };
  }).sort((a, b) => b.value - a.value);
}
