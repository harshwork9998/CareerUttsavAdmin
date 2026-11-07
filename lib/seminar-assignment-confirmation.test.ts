import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  SEMINAR_TITLE_CONFIRMATION_MARK,
  normalizePartnerSeminarConfirmations,
  preserveAssignmentConfirmation,
  seminarTitleWithoutConfirmationMarker,
} from "@/lib/seminar-assignment-confirmation";
import { planPartnerSeminarTopicWrite } from "@/lib/seminar-topic-selection";

const eventId = "evt-001";
const stamp = "2026-06-01T00:00:00.000Z";

describe("seminar assignment confirmation", () => {
  it("removes only the word joiner from a seminar title", () => {
    const title = `Caf\u00e9 \u200b${SEMINAR_TITLE_CONFIRMATION_MARK}Design`;
    expect(seminarTitleWithoutConfirmationMarker(title)).toBe("Caf\u00e9 \u200bDesign");
    expect(seminarTitleWithoutConfirmationMarker(title)?.includes(SEMINAR_TITLE_CONFIRMATION_MARK)).toBe(
      false
    );
  });

  it("backfills every legacy confirmed assignment and leaves slots alone", () => {
    const partner = normalizePartnerSeminarConfirmations({
      seminarSlotsConfirmedAt: stamp,
      seminarSlotAssignments: [
        { eventId, seminarId: "sem-a", slots: 2, seminarTitle: "Design" },
        { eventId, seminarId: "sem-b", slots: 1, seminarTitle: "Media" },
      ],
    });
    expect(partner.seminarSlotAssignments).toEqual([
      { eventId, seminarId: "sem-a", slots: 2, seminarTitle: "Design", confirmedAt: stamp },
      { eventId, seminarId: "sem-b", slots: 1, seminarTitle: "Media", confirmedAt: stamp },
    ]);
  });

  it("uses a leftover marker only to tell which development rows were confirmed", () => {
    const partner = normalizePartnerSeminarConfirmations({
      seminarSlotsConfirmedAt: stamp,
      seminarSlotAssignments: [
        {
          eventId,
          seminarId: "sem-a",
          slots: 2,
          seminarTitle: `Design${SEMINAR_TITLE_CONFIRMATION_MARK}`,
        },
        { eventId, seminarId: "sem-b", slots: 1, seminarTitle: "Media" },
      ],
    });
    expect(partner.seminarSlotAssignments).toEqual([
      { eventId, seminarId: "sem-a", slots: 2, seminarTitle: "Design", confirmedAt: stamp },
      { eventId, seminarId: "sem-b", slots: 1, seminarTitle: "Media", confirmedAt: null },
    ]);
  });

  it("does not confirm a new row once another row is already confirmed", () => {
    const partner = normalizePartnerSeminarConfirmations({
      seminarSlotsConfirmedAt: stamp,
      seminarSlotAssignments: [
        { eventId, seminarId: "sem-a", slots: 1, seminarTitle: "Design", confirmedAt: stamp },
        { eventId, seminarId: "sem-c", slots: 1, seminarTitle: "Law", confirmedAt: null },
      ],
    });
    expect(partner.seminarSlotAssignments?.[1]?.confirmedAt).toBeNull();
    expect(partner.seminarSlotAssignments?.[0]?.confirmedAt).toBe(stamp);
  });

  it("keeps an unchanged assignment's confirmation when the save omits it", () => {
    const existing = {
      seminarSlotAssignments: [
        {
          eventId,
          seminarId: "sem-b",
          slots: 1,
          seminarTitle: "Media",
          confirmedAt: "2026-05-01T00:00:00.000Z",
        },
      ],
    };
    const next = preserveAssignmentConfirmation(existing, {
      seminarSlotAssignments: [
        { eventId, seminarId: "sem-c", slots: 1, seminarTitle: "Law" },
        { eventId, seminarId: "sem-b", slots: 1 },
      ],
    });
    expect(next.seminarSlotAssignments).toEqual([
      { eventId, seminarId: "sem-c", slots: 1, seminarTitle: "Law", confirmedAt: null },
      {
        eventId,
        seminarId: "sem-b",
        slots: 1,
        seminarTitle: "Media",
        confirmedAt: "2026-05-01T00:00:00.000Z",
      },
    ]);
  });

  it("keeps a stacked legacy topic locked without rewriting its slots", () => {
    const planned = planPartnerSeminarTopicWrite({
      partner: {
        id: "legacy",
        seminarSlotsConfirmedAt: stamp,
        eventPartnerships: [{ eventId, seminarSlotCount: 1 }],
        seminarSlotAssignments: [
          {
            eventId,
            seminarId: "sem-a",
            slots: 2,
            seminarTitle: `Design${SEMINAR_TITLE_CONFIRMATION_MARK}`,
          },
        ],
      },
      events: [
        {
          id: eventId,
          title: "Bengaluru",
          city: "Bengaluru",
          seminars: [
            {
              id: "sem-a",
              title: "Design",
              date: null,
              startTime: null,
              endTime: null,
              hall: null,
              panelistSlots: 3,
            },
          ],
        },
      ],
      partners: [],
      topics: [{ eventId, seminarId: "sem-a" }],
      confirm: false,
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.assignments).toEqual([
      {
        eventId,
        seminarId: "sem-a",
        slots: 2,
        seminarTitle: "Design",
        confirmedAt: stamp,
      },
    ]);
    expect(planned.seminarSlotsConfirmedAt).toBe(stamp);
  });

  it("describes the same backfill in the migration", () => {
    const sql = readFileSync(
      "prisma/migrations/20261108120000_assignment_confirmed_at/migration.sql",
      "utf8"
    );
    expect(sql).toContain('ADD COLUMN "confirmedAt" TIMESTAMP(3)');
    expect(sql).toContain('partner."seminarSlotsConfirmedAt"');
    expect(sql).toContain("chr(8288)");
    expect(sql).not.toMatch(/\\u[0-9a-fA-F]{4}/);
    expect(sql).not.toContain("regexp_replace");
  });
});
