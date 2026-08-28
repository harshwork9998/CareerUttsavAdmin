import { describe, expect, it } from "vitest";

import { mockEvents } from "@/lib/mock-data/events";
import {
  WHATSAPP_SEMINAR_LIST_DESCRIPTION_LIMIT,
  WHATSAPP_SEMINAR_LIST_TITLE_LIMIT,
  buildSeminarListDisplayTitle,
  buildSeminarListRowDescription,
  formatSeminarListRow,
} from "@/lib/server/whatsapp/seminar-list-display";

describe("seminar list display", () => {
  it("keeps short titles unchanged", () => {
    expect(buildSeminarListDisplayTitle("Design Thinking")).toBe("Design Thinking");
  });

  it("derives a readable short title for long seminar names", () => {
    expect(
      buildSeminarListDisplayTitle("Real Careers with Artificial Intelligence")
    ).toBe("Real Careers with");
    expect(
      buildSeminarListDisplayTitle("All about Overseas Education")
    ).toBe("All about Overseas");
    expect(
      buildSeminarListDisplayTitle("Medicine in the 21st century")
    ).toBe("Medicine in the 21st");
  });

  it("falls back to word-boundary truncation when needed", () => {
    const title = buildSeminarListDisplayTitle(
      "Supercalifragilisticexpialidocious Careers"
    );
    expect(title.length).toBeLessThanOrEqual(WHATSAPP_SEMINAR_LIST_TITLE_LIMIT);
    expect(title.endsWith("…")).toBe(true);
  });

  it("keeps selected row titles within the WhatsApp limit", () => {
    const row = formatSeminarListRow(
      "Real Careers with Artificial Intelligence",
      true
    );
    expect(row.title.startsWith("✓ ")).toBe(true);
    expect(row.title.length).toBeLessThanOrEqual(WHATSAPP_SEMINAR_LIST_TITLE_LIMIT);
  });

  it("puts the full seminar title in the row description", () => {
    const fullTitle = "Real Careers with Artificial Intelligence";
    const row = formatSeminarListRow(fullTitle, false);
    expect(row.description).toBe(fullTitle);
  });

  it("truncates descriptions only for display", () => {
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
    expect(currentEvent?.seminars.map((seminar) => seminar.title)).toEqual([
      "How to select a stream – Art – Science – Commerce?",
      "Real Careers with Artificial Intelligence",
      "All about Overseas Education",
      "Medicine in the 21st century",
    ]);
  });
});
