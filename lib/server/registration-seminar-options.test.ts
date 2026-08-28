import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/event-service", () => ({
  getEventForApi: vi.fn(),
}));

import { CAREER_UTTSAV_SEMINARS } from "@/features/dashboard/seminars";
import { mockEvents } from "@/lib/mock-data/events";
import { getEventForApi } from "@/lib/server/event-service";
import { getRegistrationSeminarOptions } from "@/lib/server/registration-seminar-options";
import { getWhatsAppSeminarOptions } from "@/lib/server/whatsapp/whatsapp-seminar-context";

const getEventForApiMock = vi.mocked(getEventForApi);

describe("registration seminar options", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the full 20-title registration catalog when the event only has 4 scheduled seminars", async () => {
    getEventForApiMock.mockResolvedValue(mockEvents[0]!);

    const options = await getRegistrationSeminarOptions();

    expect(options).toHaveLength(CAREER_UTTSAV_SEMINARS.length);
    expect(options).toHaveLength(20);
    expect(options.map((option) => option.title)).toEqual([
      ...CAREER_UTTSAV_SEMINARS,
    ]);
  });

  it("reuses event seminar ids when titles match the shared catalog", async () => {
    getEventForApiMock.mockResolvedValue(mockEvents[0]!);

    const options = await getRegistrationSeminarOptions();
    const aiCareers = options.find(
      (option) =>
        option.title === "Real Careers with Artificial Intelligence"
    );

    expect(aiCareers?.id).toBe("sem-001-b");
  });

  it("appends event-only seminars that are not in the shared catalog", async () => {
    getEventForApiMock.mockResolvedValue({
      ...mockEvents[0]!,
      seminars: [
        ...(mockEvents[0]?.seminars ?? []),
        {
          id: "sem-extra",
          title: "Future Skills Workshop",
          date: "2026-08-16",
          startTime: "16:00",
          endTime: "17:00",
          panelistSlots: 2,
          hall: 2,
        },
      ],
    });

    const options = await getRegistrationSeminarOptions();

    expect(options).toHaveLength(CAREER_UTTSAV_SEMINARS.length + 1);
    expect(options.at(-1)).toEqual({
      id: "sem-extra",
      title: "Future Skills Workshop",
    });
  });
});

describe("getWhatsAppSeminarOptions", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses the same canonical registration seminar catalog as the website", async () => {
    getEventForApiMock.mockResolvedValue(mockEvents[0]!);

    const options = await getWhatsAppSeminarOptions();

    expect(options).toHaveLength(20);
    expect(options.map((option) => option.title)).toEqual([
      ...CAREER_UTTSAV_SEMINARS,
    ]);
  });
});
