import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/event-service", () => ({
  getEventForApi: vi.fn(),
}));

import {
  CAREER_UTTSAV_SEMINARS,
  LEGACY_CAREER_UTTSAV_SEMINARS,
} from "@/features/dashboard/seminars";
import { mockEvents } from "@/lib/mock-data/events";
import { getEventForApi } from "@/lib/server/event-service";
import { getRegistrationSeminarOptions } from "@/lib/server/registration-seminar-options";
import {
  getWhatsAppEventArtworkSeminarOptions,
  getWhatsAppSeminarOptions,
} from "@/lib/server/whatsapp/whatsapp-seminar-context";

const getEventForApiMock = vi.mocked(getEventForApi);

describe("registration seminar options", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns exactly the canonical 14 titles with real event seminar ids", async () => {
    getEventForApiMock.mockResolvedValue(mockEvents[0]!);

    const options = await getRegistrationSeminarOptions();

    expect(options.map((option) => option.title)).toEqual([
      ...CAREER_UTTSAV_SEMINARS,
    ]);
    expect(options.map((option) => option.id)).toEqual(
      CAREER_UTTSAV_SEMINARS.map(
        (_, index) => `sem-2026-${String(index + 1).padStart(2, "0")}`
      )
    );
    for (const legacyTitle of LEGACY_CAREER_UTTSAV_SEMINARS) {
      expect(options.map((option) => option.title)).not.toContain(legacyTitle);
    }
  });

  it("reuses the event seminar id for a newly selected canonical title", async () => {
    getEventForApiMock.mockResolvedValue(mockEvents[0]!);

    const options = await getRegistrationSeminarOptions();
    const boardExams = options.find(
      (option) => option.title === CAREER_UTTSAV_SEMINARS[13]
    );

    expect(boardExams).toEqual({
      id: "sem-2026-14",
      title: CAREER_UTTSAV_SEMINARS[13],
    });
  });

  it("does not expose legacy event seminars as current registration choices", async () => {
    getEventForApiMock.mockResolvedValue({
      ...mockEvents[0]!,
      seminars: LEGACY_CAREER_UTTSAV_SEMINARS.map((title, index) => ({
        id: `sem-legacy-${index + 1}`,
        title,
        date: "2025-08-15",
        startTime: "10:00",
        endTime: "11:00",
        panelistSlots: 2,
        hall: 1,
      })),
    });

    const options = await getRegistrationSeminarOptions();

    expect(options.map((option) => option.title)).toEqual([
      ...CAREER_UTTSAV_SEMINARS,
    ]);
    expect(options.every((option) => option.id.startsWith("cat-"))).toBe(true);
  });

  it("appends event-only seminars that are not in the shared catalog", async () => {
    getEventForApiMock.mockResolvedValue({
      ...mockEvents[0]!,
      seminars: [
        ...(mockEvents[0]?.seminars ?? []),
        {
          id: "sem-extra",
          title: "Future Skills Workshop",
          date: "2026-12-20",
          startTime: "16:00",
          endTime: "17:00",
          panelistSlots: 2,
          hall: 2,
        },
      ],
    });

    const options = await getRegistrationSeminarOptions();

    expect(options.at(-1)).toEqual({
      id: "sem-extra",
      title: "Future Skills Workshop",
      date: "2026-12-20",
      startTime: "16:00",
    });
  });
});

describe("getWhatsAppSeminarOptions", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses the canonical 14 registration seminar titles", async () => {
    getEventForApiMock.mockResolvedValue(mockEvents[0]!);

    const options = await getWhatsAppSeminarOptions();

    expect(options.map((option) => option.title)).toEqual([
      ...CAREER_UTTSAV_SEMINARS,
    ]);
    expect(options).toHaveLength(14);
  });
});

describe("getWhatsAppEventArtworkSeminarOptions", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns only current-event seminars for artwork resolution", async () => {
    getEventForApiMock.mockResolvedValue(mockEvents[0]!);

    const options = await getWhatsAppEventArtworkSeminarOptions();

    expect(options).toHaveLength(14);
    expect(new Set(options.map((option) => option.id)).size).toBe(14);
  });
});
