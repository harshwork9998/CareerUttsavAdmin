import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CAREER_UTTSAV_SEMINARS } from "@/features/dashboard/seminars";
import {
  seminarDraftsFromEvent,
  seminarSavePayload,
} from "@/lib/event-seminar-drafts";
import {
  compareScheduledSeminars,
  isSeminarCapacityDecided,
  seminarAllocationIncreaseError,
  seminarCapacityLabel,
  seminarDayLabel,
  seminarDraftScheduleErrors,
  seminarHallLabel,
  seminarTimeLabel,
  SEMINAR_SCHEDULE_UNSET_LABEL,
} from "@/lib/seminar-schedule";
import { mapPrismaSeminarToApi } from "@/lib/server/event-prisma-map";
import { getRegistrationSeminarOptions } from "@/lib/server/registration-seminar-options";
import { CAREER_UTTSAV_2026_ARTWORK_EVENT_SEMINARS } from "@/lib/server/career-uttsav-2026-artwork-event-seminars";
import { canonicalSeminarNumber } from "@/lib/server/whatsapp/event-pass";
import { resolveArtworkSeminarSelection } from "@/lib/server/whatsapp/whatsapp-artwork-seminar-catalog";
import type { EventSeminar } from "@/types";

const undecided: EventSeminar = {
  id: "sem-2026-02",
  title: CAREER_UTTSAV_SEMINARS[1],
  date: null,
  startTime: null,
  endTime: null,
  hall: null,
  panelistSlots: null,
};

describe("nullable seminar schedule", () => {
  it("keeps a seminar identity when every schedule field is null", () => {
    expect(undecided.date).toBeNull();
    expect(undecided.startTime).toBeNull();
    expect(undecided.endTime).toBeNull();
    expect(undecided.hall).toBeNull();
    expect(undecided.panelistSlots).toBeNull();
    expect(isSeminarCapacityDecided(undecided.panelistSlots)).toBe(false);
  });

  it("preserves nulls through the API mapper", () => {
    const mapped = mapPrismaSeminarToApi({
      id: undecided.id,
      eventId: "evt-001",
      title: undecided.title,
      date: null,
      startTime: null,
      endTime: null,
      hall: null,
      panelistSlots: null,
    });
    expect(mapped).toMatchObject(undecided);
  });

  it("renders TBD instead of an empty schedule", () => {
    expect(seminarDayLabel(null)).toBe(SEMINAR_SCHEDULE_UNSET_LABEL);
    expect(seminarTimeLabel(undefined)).toBe(SEMINAR_SCHEDULE_UNSET_LABEL);
    expect(seminarHallLabel(null)).toBe(SEMINAR_SCHEDULE_UNSET_LABEL);
    expect(seminarCapacityLabel(null)).toBe(SEMINAR_SCHEDULE_UNSET_LABEL);
    expect(seminarTimeLabel("10:00")).not.toBe(SEMINAR_SCHEDULE_UNSET_LABEL);
    expect(seminarHallLabel(2)).toBe("Audi 2");
  });

  it("saves a schedule-less seminar and can add the schedule later", () => {
    const [draft] = seminarDraftsFromEvent({ seminars: [undecided] });
    expect(seminarDraftScheduleErrors({ ...draft, hallCount: 3 })).toEqual({});
    expect(seminarSavePayload([draft!])[0]).toMatchObject({
      id: "sem-2026-02",
      title: undecided.title,
      date: null,
      startTime: null,
      endTime: null,
      hall: null,
      panelistSlots: null,
    });

    const scheduled = seminarSavePayload([
      {
        ...draft!,
        date: "2026-12-19",
        startTime: "11:00",
        endTime: "12:00",
        hall: 2,
        panelistSlots: 4,
      },
    ])[0];
    expect(scheduled).toMatchObject({
      id: "sem-2026-02",
      date: "2026-12-19",
      startTime: "11:00",
      endTime: "12:00",
      hall: 2,
      panelistSlots: 4,
    });
  });

  it("rejects a malformed time and accepts an empty one", () => {
    expect(
      seminarDraftScheduleErrors({
        date: "",
        startTime: "25:00",
        endTime: "",
        hall: null,
        panelistSlots: null,
      }).startTime
    ).toBeTruthy();
    expect(
      seminarDraftScheduleErrors({
        date: "",
        startTime: "",
        endTime: "",
        hall: null,
        panelistSlots: null,
      })
    ).toEqual({});
  });

  it("blocks a new partner allocation when capacity is null and keeps an existing one", () => {
    const seminars = [{ id: "sem-2026-02", panelistSlots: null as number | null }];
    expect(
      seminarAllocationIncreaseError({
        existing: [],
        next: [{ eventId: "evt-001", seminarId: "sem-2026-02", slots: 1 }],
        seminars,
      })
    ).toMatch(/capacity is not decided/i);
    expect(
      seminarAllocationIncreaseError({
        existing: [{ eventId: "evt-001", seminarId: "sem-2026-02", slots: 1 }],
        next: [{ eventId: "evt-001", seminarId: "sem-2026-02", slots: 1 }],
        seminars,
      })
    ).toBeNull();
    expect(
      seminarAllocationIncreaseError({
        existing: [],
        next: [{ eventId: "evt-001", seminarId: "sem-001-a", slots: 1 }],
        seminars: [{ id: "sem-001-a", panelistSlots: 4 }],
      })
    ).toBeNull();
  });

  it("sorts scheduled seminars before unscheduled ones", () => {
    const sorted = [
      { title: "Later", date: null, startTime: null, hall: null },
      { title: "Morning", date: "2026-12-19", startTime: "10:00", hall: 1 },
      { title: "Afternoon", date: "2026-12-19", startTime: "14:00", hall: 2 },
    ].sort(compareScheduledSeminars);
    expect(sorted.map((seminar) => seminar.title)).toEqual([
      "Morning",
      "Afternoon",
      "Later",
    ]);
  });

  it("keeps website and WhatsApp selection working without a timetable", async () => {
    expect(CAREER_UTTSAV_2026_ARTWORK_EVENT_SEMINARS).toHaveLength(14);
    expect(
      CAREER_UTTSAV_2026_ARTWORK_EVENT_SEMINARS.every(
        (seminar) =>
          seminar.date === null &&
          seminar.startTime === null &&
          seminar.panelistSlots === null
      )
    ).toBe(true);

    const options = await getRegistrationSeminarOptions();
    expect(options.map((option) => option.title)).toEqual([
      ...CAREER_UTTSAV_SEMINARS,
    ]);

    const resolution = resolveArtworkSeminarSelection(
      CAREER_UTTSAV_2026_ARTWORK_EVENT_SEMINARS.map((seminar) => ({
        id: seminar.id,
        title: seminar.title,
      }))
    );
    expect(resolution.numberToId.get(2)).toBe("sem-2026-02");
    expect(resolution.numberToId.get(8)).toBe("sem-2026-08");
    expect(resolution.numberToId.get(14)).toBe("sem-2026-14");
    expect(canonicalSeminarNumber(CAREER_UTTSAV_SEMINARS[1])).toBe(2);
  });

  it("keeps the production insert script null-safe and guarded", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "production-evt-001-canonical-seminars.sql"
      ),
      "utf8"
    );
    expect(sql).not.toContain("Approved schedule metadata is missing");
    expect(sql).toContain("expected a count of 19");
    expect(sql).toContain("Superseded");
    expect(sql).toContain("production-evt-001-replace-legacy-seminars.sql");
    expect(sql).toContain("0 legacy rows");
    expect(sql).toContain("evt-001 seminar count is not 5");
    expect(sql).toContain("Legacy rows changed during insert");
    expect(sql).toContain("sem-2026-01");
    expect(sql).toContain("sem-2026-14");
    expect(sql).toContain("sem-001-a");
    expect(sql).toContain("Canonical seminar schedule fields must stay null");
    expect(sql).toContain("A registration, partner, roster, or WhatsApp reference changed");

    const replacement = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "production-evt-001-replace-legacy-seminars.sql"
      ),
      "utf8"
    );
    expect(replacement).toContain("MIGRATE_TO_CANONICAL");
    expect(replacement).toContain("DELETE_ASSIGNMENT");
    expect(replacement).toContain("DELETE_ROSTER");
    expect(replacement).toContain("Do not invent canonical_seminar_id");
    expect(replacement).toContain('SET "seminarId" = NULL');
    expect(replacement).toContain("evt-001 final seminar state is not the 14 canonical rows");
    expect(replacement).toContain("('997eo0v5r', 'DELETE_ROW')");
    expect(replacement).toContain(
      "('pssa-partner-001-sem-001-a', 'DELETE_ASSIGNMENT', NULL)"
    );
    expect(replacement).toContain(
      "('pssa-partner-001-sem-001-b', 'DELETE_ASSIGNMENT', NULL)"
    );
    expect(replacement).toContain(
      "('evt-001', 'sem-001-a', 'DELETE_ROSTER', NULL)"
    );
    expect(replacement).toContain("('partner-001', 'STRIP_LEGACY_SEMINAR_IDS')");
    expect(replacement).toContain(
      "Expected 7 historical registration-interest rows still pointing at sem-001-a or sem-001-b"
    );
    expect(replacement).toContain(
      "sem-001-c, sem-001-d, and zyhwu550q must already be absent."
    );
    expect(replacement).toContain(
      "Detached historical registrations for sem-001-c/sem-001-d were not found"
    );
    expect(replacement).toContain(
      "Approved partner actions are DELETE_ASSIGNMENT for the two Christ University rows only."
    );
    expect(replacement).toContain(
      "The only approved roster action is DELETE_ROSTER for evt-001 / sem-001-a."
    );
    expect(replacement).not.toContain("sem-2026-XX");
  });
});
