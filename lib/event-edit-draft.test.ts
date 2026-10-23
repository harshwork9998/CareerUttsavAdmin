import { describe, expect, it } from "vitest";

import {
  CAREER_UTTSAV_SEMINARS,
  LEGACY_CAREER_UTTSAV_SEMINARS,
} from "@/features/dashboard/seminars";
import { buildCurrentCatalogueSeminarRows } from "@/lib/current-event-seminars";
import {
  eventSaveErrorMessage,
  newSeminarTitleSuggestions,
  seminarDraftsFromEvent,
  seminarEditorLegacyLabel,
  seminarSavePayload,
} from "@/lib/event-seminar-drafts";
import type { EventSeminar } from "@/types";

/** evt-001 as stored in production: five legacy rows, no canonical rows. */
const PRODUCTION_EVT_001_SEMINARS: EventSeminar[] = [
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

describe("edit event drafts for persisted seminars", () => {
  it("loads all five production legacy seminars with ids, titles, and schedules", () => {
    const drafts = seminarDraftsFromEvent({
      seminars: PRODUCTION_EVT_001_SEMINARS,
    });

    expect(drafts).toHaveLength(5);
    expect(drafts.map((row) => row.key)).toEqual([
      "sem-001-a",
      "sem-001-b",
      "sem-001-c",
      "sem-001-d",
      "zyhwu550q",
    ]);
    expect(drafts.map((row) => row.title)).toEqual(
      PRODUCTION_EVT_001_SEMINARS.map((seminar) => seminar.title)
    );
    expect(drafts.map((row) => row.title)).toEqual([
      LEGACY_CAREER_UTTSAV_SEMINARS[0],
      "Real Careers with Artificial Intelligence",
      "All about Overseas Education",
      "Medicine in the 21st century",
      "Architecture - A Promising Creative Career",
    ]);
    expect(
      drafts.map((row) => ({
        date: row.date,
        startTime: row.startTime,
        endTime: row.endTime,
        hall: row.hall,
        panelistSlots: row.panelistSlots,
      }))
    ).toEqual(
      PRODUCTION_EVT_001_SEMINARS.map((seminar) => ({
        date: seminar.date,
        startTime: seminar.startTime,
        endTime: seminar.endTime,
        hall: seminar.hall,
        panelistSlots: seminar.panelistSlots,
      }))
    );
  });

  it("marks legacy rows and does not inject the canonical catalogue", () => {
    const drafts = seminarDraftsFromEvent({
      seminars: PRODUCTION_EVT_001_SEMINARS,
    });

    for (const row of drafts) {
      expect(seminarEditorLegacyLabel(row.title)).toBe("Legacy seminar");
    }
    expect(seminarEditorLegacyLabel(CAREER_UTTSAV_SEMINARS[0])).toBeNull();
    expect(seminarEditorLegacyLabel("")).toBeNull();

    const titles = drafts.map((row) => row.title);
    for (const canonicalTitle of CAREER_UTTSAV_SEMINARS) {
      expect(titles).not.toContain(canonicalTitle);
    }
    expect(titles).not.toContain("Do What You Love, Love What You Do");
  });

  it("keeps the canonical 14 available only as suggestions for a new seminar", () => {
    expect(newSeminarTitleSuggestions()).toHaveLength(14);
    expect([...newSeminarTitleSuggestions()]).toEqual([
      ...CAREER_UTTSAV_SEMINARS,
    ]);
    for (const legacyTitle of LEGACY_CAREER_UTTSAV_SEMINARS) {
      expect(newSeminarTitleSuggestions()).not.toContain(legacyTitle);
    }
  });

  it("preserves all five seminars in the PATCH payload for an unrelated edit", () => {
    const drafts = seminarDraftsFromEvent({
      seminars: PRODUCTION_EVT_001_SEMINARS,
    });
    const payload = seminarSavePayload(drafts);

    expect(payload).toEqual(PRODUCTION_EVT_001_SEMINARS);
    expect(payload.map((seminar) => seminar.id)).toEqual([
      "sem-001-a",
      "sem-001-b",
      "sem-001-c",
      "sem-001-d",
      "zyhwu550q",
    ]);
  });

  it("round-trips nullable schedule fields without inventing a timetable", () => {
    const undecided: EventSeminar = {
      id: "sem-2026-01",
      title: CAREER_UTTSAV_SEMINARS[0],
      date: null,
      startTime: null,
      endTime: null,
      hall: null,
      panelistSlots: null,
    };
    const [draft] = seminarDraftsFromEvent({ seminars: [undecided] });

    expect(draft).toMatchObject({
      key: "sem-2026-01",
      title: CAREER_UTTSAV_SEMINARS[0],
      date: "",
      startTime: "",
      endTime: "",
      hall: null,
      panelistSlots: null,
    });
    expect(seminarSavePayload([draft!])).toEqual([undecided]);
    expect(seminarEditorLegacyLabel(undecided.title)).toBeNull();
  });

  it("surfaces the partner-assignment 409 text", () => {
    expect(
      eventSaveErrorMessage(
        new Error("Cannot remove seminar with active partner slot assignments"),
        "Failed to update event"
      )
    ).toBe("Cannot remove seminar with active partner slot assignments");
    expect(eventSaveErrorMessage(new Error("  "), "Failed to update event")).toBe(
      "Failed to update event"
    );
  });

  it("keeps the current dashboard catalogue at 14", () => {
    const rows = buildCurrentCatalogueSeminarRows(
      LEGACY_CAREER_UTTSAV_SEMINARS.map((name) => ({ name, value: 1 }))
    );
    expect(rows).toHaveLength(14);
    expect(new Set(rows.map((row) => row.name))).toEqual(
      new Set(CAREER_UTTSAV_SEMINARS)
    );
  });
});
