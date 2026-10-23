import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CAREER_INTEREST_CATEGORIES,
  CAREER_UTTSAV_SEMINARS,
  LEGACY_CAREER_UTTSAV_SEMINARS,
  aggregateByCareerInterest,
  canonicalizeSeminarTitle,
  isLegacyCareerUttsavSeminarTitle,
  seminarMatchKey,
  seminarTitlesMatch,
} from "@/features/dashboard/seminars";
import { buildStudentRegistrationAnalytics } from "@/lib/build-dashboard-student-analytics";
import { mockEvents } from "@/lib/mock-data/events";
import { getRegistrationSeminarInterests } from "@/lib/registration-seminar-filters";
import { normalizeSeminarInterests } from "@/lib/registration-validation";
import { CAREER_UTTSAV_2026_ARTWORK_EVENT_SEMINARS } from "@/lib/server/career-uttsav-2026-artwork-event-seminars";
import type { StudentRegistration } from "@/types";

const CANONICAL_TITLES = [
  "Do What You Love, Love What You Do",
  "Engineering Next: What\u2019s Ahead?",
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

describe("canonical Career Uttsav seminars", () => {
  it("exposes exactly the approved 14 titles", () => {
    expect(CAREER_UTTSAV_SEMINARS).toHaveLength(14);
    expect([...CAREER_UTTSAV_SEMINARS]).toEqual([...CANONICAL_TITLES]);
    expect(new Set(CAREER_UTTSAV_SEMINARS).size).toBe(14);
  });

  it("keeps the previous 20 titles as legacy data, not current choices", () => {
    expect(LEGACY_CAREER_UTTSAV_SEMINARS).toHaveLength(20);
    for (const title of LEGACY_CAREER_UTTSAV_SEMINARS) {
      expect(CAREER_UTTSAV_SEMINARS).not.toContain(title);
      expect(isLegacyCareerUttsavSeminarTitle(title)).toBe(true);
    }
  });

  it("does not fuzzy-map a legacy title onto a current title", () => {
    const currentKeys = CAREER_UTTSAV_SEMINARS.map(seminarMatchKey);
    for (const legacyTitle of LEGACY_CAREER_UTTSAV_SEMINARS) {
      expect(currentKeys).not.toContain(seminarMatchKey(legacyTitle));
      expect(canonicalizeSeminarTitle(legacyTitle)).toBe(legacyTitle);
      for (const currentTitle of CAREER_UTTSAV_SEMINARS) {
        expect(seminarTitlesMatch(legacyTitle, currentTitle)).toBe(false);
      }
    }
  });

  it("keeps a custom event title editable and unchanged", () => {
    expect(canonicalizeSeminarTitle("Future Skills Workshop")).toBe(
      "Future Skills Workshop"
    );
    expect(isLegacyCareerUttsavSeminarTitle("Future Skills Workshop")).toBe(
      false
    );
  });

  it("persists a selected canonical title without rewriting it", () => {
    expect(normalizeSeminarInterests([CANONICAL_TITLES[1]])).toEqual([
      CANONICAL_TITLES[1],
    ]);
    expect(normalizeSeminarInterests([LEGACY_CAREER_UTTSAV_SEMINARS[0]])).toEqual([
      LEGACY_CAREER_UTTSAV_SEMINARS[0],
    ]);
  });
});

describe("current event seminar fixture", () => {
  it("uses the canonical titles and leaves schedule fields undecided", () => {
    expect(
      CAREER_UTTSAV_2026_ARTWORK_EVENT_SEMINARS.map((seminar) => seminar.title)
    ).toEqual([...CAREER_UTTSAV_SEMINARS]);
    expect(
      CAREER_UTTSAV_2026_ARTWORK_EVENT_SEMINARS.map((seminar) => ({
        id: seminar.id,
        date: seminar.date,
        startTime: seminar.startTime,
        endTime: seminar.endTime,
        hall: seminar.hall,
        panelistSlots: seminar.panelistSlots,
      }))
    ).toEqual(
      CAREER_UTTSAV_SEMINARS.map((_, index) => ({
        id: `sem-2026-${String(index + 1).padStart(2, "0")}`,
        date: null,
        startTime: null,
        endTime: null,
        hall: null,
        panelistSlots: null,
      }))
    );
    expect(new Set(CAREER_UTTSAV_2026_ARTWORK_EVENT_SEMINARS.map((seminar) => seminar.id)).size).toBe(14);
  });

  it("gives manual registration the current event seminars", () => {
    const current = mockEvents.find((event) => event.id === "evt-001");
    expect(current?.seminars.map((seminar) => seminar.title)).toEqual([
      ...CAREER_UTTSAV_SEMINARS,
    ]);
  });
});

describe("dashboard and historical seminar analytics", () => {
  it("builds current interest tracks from the 14 titles only", () => {
    const tracked = CAREER_INTEREST_CATEGORIES.flatMap((category) => [
      ...category.seminars,
    ]);
    expect(new Set(tracked)).toEqual(new Set(CAREER_UTTSAV_SEMINARS));
    for (const legacyTitle of LEGACY_CAREER_UTTSAV_SEMINARS) {
      expect(tracked).not.toContain(legacyTitle);
    }
  });

  it("does not crash or fold a historical title into a current bucket", () => {
    const legacyTitle = LEGACY_CAREER_UTTSAV_SEMINARS[0];
    const rows = aggregateByCareerInterest([
      { name: legacyTitle, value: 4 },
      { name: CAREER_UTTSAV_SEMINARS[1], value: 2 },
    ]);
    const tracked = rows.flatMap((row) => row.seminars);
    expect(tracked.map((seminar) => seminar.name)).not.toContain(legacyTitle);
    expect(tracked.find((seminar) => seminar.name === CAREER_UTTSAV_SEMINARS[1])?.value).toBe(2);
    expect(rows.reduce((sum, row) => sum + row.value, 0)).toBe(2);

    const registration: StudentRegistration = {
      id: "reg-legacy",
      kind: "student",
      registrationNumber: "CU-BLR-2026-00099",
      eventId: "evt-001",
      eventTitle: "Career Uttsav Bengaluru 2026",
      status: "Confirmed",
      paymentStatus: "Waived",
      amount: 0,
      registeredAt: "2026-08-23T10:00:00.000Z",
      updatedAt: "2026-08-23T10:00:00.000Z",
      studentName: "Historical Student",
      email: "historical@example.com",
      phone: "9876543210",
      college: "School",
      classLabel: "Class 10",
      interestedStream: "Science",
      board: "CBSE",
      gender: "Female",
      city: "Bangalore",
      state: "Karnataka",
      seminarInterests: [legacyTitle, CAREER_UTTSAV_SEMINARS[8]],
    };

    const analytics = buildStudentRegistrationAnalytics(
      [registration],
      mockEvents,
      "all"
    );
    expect(analytics.bySeminar.map((row) => row.name)).toEqual(
      expect.arrayContaining([legacyTitle, CAREER_UTTSAV_SEMINARS[8]])
    );
    expect(getRegistrationSeminarInterests(registration)).toEqual([
      legacyTitle,
      CAREER_UTTSAV_SEMINARS[8],
    ]);
  });
});

describe("website registration seminar chips", () => {
  const websitePath = join(process.cwd(), "../CareerUttsav2026/index.html");

  it("shows the canonical 14 and not the legacy 20", () => {
    expect(existsSync(websitePath)).toBe(true);
    const html = readFileSync(websitePath, "utf8");
    const titles = [
      ...html.matchAll(/class="reg-seminar-chip" data-value="([^"]+)"/g),
    ].map((match) => match[1]);
    expect(titles).toEqual([...CANONICAL_TITLES]);
    for (const legacyTitle of LEGACY_CAREER_UTTSAV_SEMINARS) {
      expect(html).not.toContain(legacyTitle);
    }
  });
});

describe("partner demo seminar identity", () => {
  const partnerSeedPath = join(process.cwd(), "../CareerUttsavPartner/lib/seed-data.ts");

  it("keeps seminar ids and shows current titles on the demo event", () => {
    expect(existsSync(partnerSeedPath)).toBe(true);
    const source = readFileSync(partnerSeedPath, "utf8");
    expect(source).toContain('id: "sem-001-a"');
    expect(source).toContain('seminarId: "sem-001-a"');
    expect(source).toContain("2026-08-15");
    expect(source).toContain(CANONICAL_TITLES[0]);
    expect(source).toContain(CANONICAL_TITLES[1]);
    expect(source).not.toContain(LEGACY_CAREER_UTTSAV_SEMINARS[0]);
    expect(source).not.toContain("Real Careers with Artificial Intelligence");
  });
});
