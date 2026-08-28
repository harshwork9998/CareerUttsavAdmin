import { describe, expect, it } from "vitest";

import { CAREER_UTTSAV_SEMINARS } from "@/features/dashboard/seminars";
import { mockEvents } from "@/lib/mock-data/events";
import {
  WHATSAPP_SEMINAR_LIST_DESCRIPTION_LIMIT,
  buildSeminarListRowDescription,
  formatNumberedSeminarListRow,
} from "@/lib/server/whatsapp/seminar-list-display";

describe("numbered seminar list display", () => {
  it("uses Seminar N as the row title", () => {
    const row = formatNumberedSeminarListRow({
      displayNumber: 2,
      fullTitle: "Real Careers with Artificial Intelligence",
      selected: false,
    });

    expect(row.title).toBe("Seminar 2");
    expect(row.description).toBe("Real Careers with Artificial Intelligence");
  });

  it("keeps the numbered title when selected and marks selection in description", () => {
    const row = formatNumberedSeminarListRow({
      displayNumber: 2,
      fullTitle: "Real Careers with Artificial Intelligence",
      selected: true,
    });

    expect(row.title).toBe("Seminar 2");
    expect(row.description).toBe(
      "✓ Selected · Real Careers with Artificial Intelligence"
    );
  });

  it("truncates long descriptions for display only", () => {
    const fullTitle = "A".repeat(WHATSAPP_SEMINAR_LIST_DESCRIPTION_LIMIT + 10);
    const description = buildSeminarListRowDescription(fullTitle);
    expect(description.length).toBeLessThanOrEqual(
      WHATSAPP_SEMINAR_LIST_DESCRIPTION_LIMIT
    );
    expect(description.endsWith("…")).toBe(true);
  });
});

describe("current event seminar fixture", () => {
  it("documents the JSON seed seminar count used when event reads stay on JSON", () => {
    const currentEvent = mockEvents.find((event) => event.id === "evt-001");
    expect(currentEvent?.seminars).toHaveLength(4);
    expect(CAREER_UTTSAV_SEMINARS).toHaveLength(20);
  });
});
