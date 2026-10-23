import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CAREER_INTEREST_CATEGORIES,
  CAREER_UTTSAV_SEMINARS,
  isCurrentCareerUttsavSeminar,
} from "@/features/dashboard/seminars";
import { formatSeminarInterests } from "@/lib/enrich-registration";
import {
  buildCurrentSeminarInterestItems,
  seminarsAvailableForPartnerSlots,
  selectCurrentEventSeminars,
} from "@/lib/current-event-seminars";
import {
  seminarDraftsFromEvent,
  seminarSavePayload,
} from "@/lib/event-seminar-drafts";
import {
  buildRegistrationSeminarFilterOptions,
  registrationMatchesAllSeminars,
} from "@/lib/registration-seminar-filters";
import { registrationMatchesSearch } from "@/features/registrations/registration-table-config";
import { WHATSAPP_ARTWORK_SEMINAR_DEFINITIONS } from "@/lib/server/whatsapp/whatsapp-artwork-seminar-catalog";
import type { EventSeminar, StudentRegistration } from "@/types";

const PRODUCTION_LEGACY: EventSeminar[] = [
  {
    id: "sem-001-a",
    title: "How to select a stream – Art – Science – Commerce?",
    date: "2026-12-19",
    startTime: "10:00",
    endTime: "11:00",
    hall: 1,
    panelistSlots: 4,
  },
  {
    id: "sem-001-b",
    title: "Real Careers with Artificial Intelligence",
    date: "2026-12-19",
    startTime: "11:30",
    endTime: "12:30",
    hall: 2,
    panelistSlots: 2,
  },
  {
    id: "sem-001-c",
    title: "All about Overseas Education",
    date: "2026-12-19",
    startTime: "10:00",
    endTime: "11:00",
    hall: 1,
    panelistSlots: 4,
  },
  {
    id: "sem-001-d",
    title: "Medicine in the 21st century",
    date: "2026-12-19",
    startTime: "14:00",
    endTime: "15:00",
    hall: 2,
    panelistSlots: 3,
  },
  {
    id: "zyhwu550q",
    title: "Architecture - A Promising Creative Career",
    date: "2026-12-20",
    startTime: "10:00",
    endTime: "11:00",
    hall: 1,
    panelistSlots: 2,
  },
];

const CANONICAL_ROW: EventSeminar = {
  id: "sem-2026-02",
  title: CAREER_UTTSAV_SEMINARS[1],
  date: "2026-12-19",
  startTime: "10:30",
  endTime: "11:30",
  hall: 1,
  panelistSlots: 3,
};

function student(
  seminarInterests: string[]
): StudentRegistration {
  return {
    id: "reg-1",
    kind: "student",
    registrationNumber: "CU-BLR-2026-00001",
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
    seminarInterests,
  };
}

describe("current versus legacy seminars", () => {
  it("treats the canonical 14 as current and the production five as legacy", () => {
    expect(CAREER_UTTSAV_SEMINARS).toHaveLength(14);
    for (const title of CAREER_UTTSAV_SEMINARS) {
      expect(isCurrentCareerUttsavSeminar(title)).toBe(true);
    }
    for (const seminar of PRODUCTION_LEGACY) {
      expect(isCurrentCareerUttsavSeminar(seminar.title)).toBe(false);
    }
    expect(
      isCurrentCareerUttsavSeminar("Engineering Next: What's Ahead?")
    ).toBe(false);
  });

  it("offers only canonical seminars for a new manual registration", () => {
    const choices = selectCurrentEventSeminars([
      ...PRODUCTION_LEGACY,
      CANONICAL_ROW,
    ]).map((seminar) => seminar.title);

    expect(choices).toEqual([CAREER_UTTSAV_SEMINARS[1]]);
    for (const seminar of PRODUCTION_LEGACY) {
      expect(choices).not.toContain(seminar.title);
    }
  });

  it("still renders a historical registration that stores a legacy title", () => {
    const registration = student([PRODUCTION_LEGACY[0].title]);
    expect(formatSeminarInterests(registration)).toBe(
      PRODUCTION_LEGACY[0].title
    );
    expect(
      registrationMatchesSearch(registration, "select a stream")
    ).toBe(true);
  });

  it("keeps legacy rows in the event editor and the save payload", () => {
    const drafts = seminarDraftsFromEvent({
      seminars: [...PRODUCTION_LEGACY, CANONICAL_ROW],
    });
    const saved = seminarSavePayload(drafts);

    expect(saved.map((seminar) => seminar.id)).toEqual([
      "sem-001-a",
      "sem-001-b",
      "sem-001-c",
      "sem-001-d",
      "zyhwu550q",
      "sem-2026-02",
    ]);
    expect(saved.map((seminar) => seminar.title)).toEqual([
      ...PRODUCTION_LEGACY.map((seminar) => seminar.title),
      CANONICAL_ROW.title,
    ]);
    expect(saved.find((seminar) => seminar.id === "sem-001-a")).toMatchObject({
      date: "2026-12-19",
      startTime: "10:00",
      hall: 1,
      panelistSlots: 4,
    });
  });

  it("charts current seminars only and does not rewrite legacy interest", () => {
    const currentTitles = selectCurrentEventSeminars([
      ...PRODUCTION_LEGACY,
      CANONICAL_ROW,
    ]).map((seminar) => seminar.title);
    const items = buildCurrentSeminarInterestItems(
      [
        student([
          PRODUCTION_LEGACY[1].title,
          CAREER_UTTSAV_SEMINARS[1],
        ]),
      ],
      currentTitles
    );

    expect(items).toEqual([{ name: CAREER_UTTSAV_SEMINARS[1], value: 1 }]);
    expect(items.map((item) => item.name)).not.toContain(
      PRODUCTION_LEGACY[1].title
    );
    expect(
      CAREER_INTEREST_CATEGORIES.flatMap((category) => [...category.seminars])
    ).not.toContain(PRODUCTION_LEGACY[1].title);
  });

  it("keeps website and WhatsApp on the canonical 14", () => {
    expect(
      WHATSAPP_ARTWORK_SEMINAR_DEFINITIONS.map((definition) => definition.title)
    ).toEqual([...CAREER_UTTSAV_SEMINARS]);
    for (const seminar of PRODUCTION_LEGACY) {
      expect(
        WHATSAPP_ARTWORK_SEMINAR_DEFINITIONS.map((definition) => definition.title)
      ).not.toContain(seminar.title);
    }

    const websitePath = join(process.cwd(), "../CareerUttsav2026/index.html");
    expect(existsSync(websitePath)).toBe(true);
    const html = readFileSync(websitePath, "utf8");
    const titles = [
      ...html.matchAll(/class="reg-seminar-chip" data-value="([^"]+)"/g),
    ].map((match) => match[1]);
    expect(titles).toEqual([...CAREER_UTTSAV_SEMINARS]);
    for (const seminar of PRODUCTION_LEGACY) {
      expect(html).not.toContain(seminar.title);
    }
  });

  it("keeps historical titles searchable while listing current seminars first", () => {
    const options = buildRegistrationSeminarFilterOptions({
      eventTitles: [...PRODUCTION_LEGACY.map((seminar) => seminar.title), CANONICAL_ROW.title],
      registrationTitles: [PRODUCTION_LEGACY[0].title, "Offbeat Careers"],
    });

    expect(options[0]?.value).toBe(CAREER_UTTSAV_SEMINARS[1]);
    expect(options.map((option) => option.value)).toEqual(
      expect.arrayContaining([
        PRODUCTION_LEGACY[0].title,
        "Offbeat Careers",
      ])
    );
    expect(
      registrationMatchesAllSeminars(student([PRODUCTION_LEGACY[0].title]), [
        PRODUCTION_LEGACY[0].title,
      ])
    ).toBe(true);
  });

  it("keeps assigned legacy seminars available for partner seats", () => {
    const visible = seminarsAvailableForPartnerSlots(
      [...PRODUCTION_LEGACY, CANONICAL_ROW],
      new Set(["sem-001-a"])
    );

    expect(visible.map((seminar) => seminar.id)).toEqual([
      "sem-001-a",
      "sem-2026-02",
    ]);
    expect(visible.map((seminar) => seminar.id)).not.toContain("sem-001-b");
  });
});
