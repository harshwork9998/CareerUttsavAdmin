import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/event-service", () => ({
  getEventForApi: vi.fn(),
}));

import { CURRENT_EVENT_ID } from "@/lib/current-events";
import { getEventForApi } from "@/lib/server/event-service";
import { getWhatsAppSeminarOptions } from "@/lib/server/whatsapp/whatsapp-seminar-context";

const getEventForApiMock = vi.mocked(getEventForApi);

describe("getWhatsAppSeminarOptions", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns all configured seminars for the current event", async () => {
    getEventForApiMock.mockResolvedValue({
      id: CURRENT_EVENT_ID,
      seminars: Array.from({ length: 8 }, (_, index) => ({
        id: `sem-${String(index + 1).padStart(3, "0")}`,
        title: `Seminar ${index + 1}`,
        date: "2026-08-15",
        startTime: "10:00",
        endTime: "11:00",
        panelistSlots: 2,
        hall: 1,
      })),
    } as Awaited<ReturnType<typeof getEventForApi>>);

    const options = await getWhatsAppSeminarOptions();

    expect(getEventForApiMock).toHaveBeenCalledWith(CURRENT_EVENT_ID);
    expect(options).toHaveLength(8);
    expect(options.map((option) => option.id)).toEqual([
      "sem-001",
      "sem-002",
      "sem-003",
      "sem-004",
      "sem-005",
      "sem-006",
      "sem-007",
      "sem-008",
    ]);
  });

  it("filters out seminars without ids or titles", async () => {
    getEventForApiMock.mockResolvedValue({
      id: CURRENT_EVENT_ID,
      seminars: [
        {
          id: "sem-001",
          title: "  Valid Seminar  ",
          date: "2026-08-15",
          startTime: "10:00",
          endTime: "11:00",
          panelistSlots: 2,
          hall: 1,
        },
        {
          id: "",
          title: "Missing ID",
          date: "2026-08-15",
          startTime: "10:00",
          endTime: "11:00",
          panelistSlots: 2,
          hall: 1,
        },
        {
          id: "sem-003",
          title: "   ",
          date: "2026-08-15",
          startTime: "10:00",
          endTime: "11:00",
          panelistSlots: 2,
          hall: 1,
        },
      ],
    } as Awaited<ReturnType<typeof getEventForApi>>);

    await expect(getWhatsAppSeminarOptions()).resolves.toEqual([
      { id: "sem-001", title: "Valid Seminar" },
    ]);
  });
});
