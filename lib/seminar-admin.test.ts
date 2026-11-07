import { describe, expect, it } from "vitest";

import {
  decideSeminarClaims,
  occupancyBySeminar,
  occupiedSeatCount,
  portalSpeakerRowsError,
  SEMINAR_FULL,
  SEMINAR_SLOTS_MUST_BE_ONE,
  seminarSelectionSummary,
} from "@/lib/seminar-allocation";
import { buildPartnerSeatBlocks } from "@/lib/seminar-partner-seats";
import {
  adminJourneyChapterAfterDeliverables,
  adminListsSeminar,
  assignmentConfirmationLabel,
  chapter6Continuation,
  eligibleReassignmentDestinations,
  LEGACY_STACKED_ASSIGNMENT_MOVE,
  planAdminSeminarMove,
  planAdminSeminarRemoval,
  rosterWithoutPartnerSeats,
  seminarAssignmentCanBeReassigned,
  seminarChapterStatus,
} from "@/lib/seminar-admin";
import {
  SEMINAR_TOPICS_LOCKED,
  planPartnerSeminarTopicWrite,
} from "@/lib/seminar-topic-selection";
import type { Partner, SeminarSessionRoster } from "@/types";

const eventId = "evt-001";
const now = "2026-11-08T03:00:00.000Z";
const earlier = "2026-06-01T00:00:00.000Z";

function seminar(
  id: string,
  panelistSlots: number | null,
  title = id
) {
  return {
    id,
    title,
    date: "2026-08-15",
    startTime: "10:00",
    endTime: "11:00",
    hall: 2,
    panelistSlots,
  };
}

const events = [
  {
    id: eventId,
    title: "Bengaluru",
    seminars: [
      seminar("sem-a", 2, "Design"),
      seminar("sem-b", 2, "Media"),
      seminar("sem-c", 0, "Closed"),
      seminar("sem-d", null, "Undecided"),
      seminar("sem-full", 1, "Full"),
    ],
  },
  {
    id: "evt-002",
    title: "Mumbai",
    seminars: [seminar("sem-x", 2, "Elsewhere")],
  },
];

function partner<T extends Record<string, unknown>>(overrides: T = {} as T) {
  return {
    id: "partner-a",
    eventPartnerships: [{ eventId, seminarSlotCount: 3 }],
    seminarSlotAssignments: [] as Array<{
      eventId: string;
      seminarId: string;
      slots: number;
      seminarTitle?: string;
      confirmedAt?: string | null;
    }>,
    ...overrides,
  };
}

describe("admin seminar chapter", () => {
  it("lets the journey continue after deliverables without a seminar confirmation", () => {
    expect(
      adminJourneyChapterAfterDeliverables({
        seminarSlotsConfirmedAt: undefined,
        commercialsConfirmedAt: undefined,
      })
    ).toBe(7);
    expect(
      adminJourneyChapterAfterDeliverables({
        commercialsConfirmedAt: "2026-07-01T00:00:00.000Z",
      })
    ).toBe(8);
  });

  it("continues chapter 6 without filling topics or confirming them", () => {
    const current = partner({
      seminarSlotsConfirmedAt: earlier,
      seminarSlotAssignments: [
        {
          eventId,
          seminarId: "sem-a",
          slots: 2,
          seminarTitle: "Design",
          confirmedAt: earlier,
        },
      ],
    });
    const saved = chapter6Continuation(current);
    expect(saved.canContinue).toBe(true);
    expect(saved.seminarSlotsConfirmedAt).toBe(earlier);
    expect(saved.seminarSlotAssignments).toEqual(current.seminarSlotAssignments);

    const empty = chapter6Continuation(
      partner({ seminarSlotCount: 3, seminarSlotAssignments: [] })
    );
    expect(empty.canContinue).toBe(true);
    expect(empty.seminarSlotsConfirmedAt).toBeUndefined();
    expect(empty.seminarSlotAssignments).toEqual([]);
  });

  it("shows allocated, selected, remaining, and per-topic confirmation", () => {
    const status = seminarChapterStatus(
      partner({
        eventPartnerships: [{ eventId, seminarSlotCount: 3 }],
        seminarSlotAssignments: [
          {
            eventId,
            seminarId: "sem-a",
            slots: 2,
            seminarTitle: "Design",
            confirmedAt: earlier,
          },
          {
            eventId,
            seminarId: "sem-b",
            slots: 1,
            seminarTitle: "Media",
            confirmedAt: null,
          },
        ],
      }),
      events
    );
    expect(status[0]).toMatchObject({
      allocated: 3,
      selected: 2,
      remaining: 1,
    });
    expect(status[0]?.topics).toEqual([
      expect.objectContaining({
        title: "Design",
        date: "2026-08-15",
        startTime: "10:00",
        endTime: "11:00",
        hall: 2,
        slots: 2,
        status: "Confirmed",
      }),
      expect.objectContaining({
        title: "Media",
        status: "Pending Partner Confirmation",
      }),
    ]);
  });
});

describe("admin seminar visibility", () => {
  it("lists null, zero, and full seminars", () => {
    expect(adminListsSeminar({ panelistSlots: null })).toBe(true);
    expect(adminListsSeminar({ panelistSlots: 0 })).toBe(true);
    expect(adminListsSeminar({ panelistSlots: 1 })).toBe(true);
  });

  it("shows an unconfirmed assignment immediately and keeps confirmed ones", () => {
    const blocks = buildPartnerSeatBlocks(
      [
        partner({
          id: "pending",
          name: "Pending College",
          seminarSlotsConfirmedAt: undefined,
          seminarSlotAssignments: [
            { eventId, seminarId: "sem-a", slots: 1, confirmedAt: null },
          ],
        }) as unknown as Partner,
        partner({
          id: "locked",
          name: "Locked College",
          seminarSlotsConfirmedAt: earlier,
          seminarSlotAssignments: [
            { eventId, seminarId: "sem-a", slots: 1, confirmedAt: earlier },
          ],
        }) as unknown as Partner,
      ],
      eventId,
      "sem-a",
      2
    );
    expect(blocks.map((block) => [block.partner.id, block.confirmed])).toEqual([
      ["locked", true],
      ["pending", false],
    ]);
    expect(assignmentConfirmationLabel(earlier)).toBe("Confirmed");
    expect(assignmentConfirmationLabel(null)).toBe("Pending Confirmation");
  });
});

describe("admin seminar move", () => {
  const base = partner({
    seminarSlotAssignments: [
      {
        eventId,
        seminarId: "sem-a",
        slots: 1,
        seminarTitle: "Design",
        confirmedAt: earlier,
      },
    ],
    seminarSlotsConfirmedAt: earlier,
    portalSeminarSpeakers: [
      {
        eventId,
        seminarId: "sem-a",
        speakers: [{ name: "Ada" }],
        updatedAt: earlier,
      },
    ],
  });

  it("moves a confirmed topic inside the event and locks the destination", () => {
    const moved = planAdminSeminarMove({
      partner: base,
      events,
      partners: [],
      eventId,
      seminarId: "sem-a",
      destinationSeminarId: "sem-b",
      now,
    });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.assignments).toEqual([
      {
        eventId,
        seminarId: "sem-b",
        slots: 1,
        seminarTitle: "Media",
        confirmedAt: now,
      },
    ]);
    expect(moved.seminarSlotsConfirmedAt).toBe(now);
    expect(base.portalSeminarSpeakers).toEqual([
      expect.objectContaining({ seminarId: "sem-a" }),
    ]);

    const locked = planPartnerSeminarTopicWrite({
      partner: {
        ...base,
        seminarSlotsConfirmedAt: moved.seminarSlotsConfirmedAt,
        seminarSlotAssignments: moved.assignments,
      },
      events,
      partners: [],
      topics: [{ eventId, seminarId: "sem-a" }],
      confirm: false,
    });
    expect(locked).toMatchObject({ ok: false, error: SEMINAR_TOPICS_LOCKED });
    expect(
      portalSpeakerRowsError({
        existingSpeakers: base.portalSeminarSpeakers,
        nextSpeakers: [
          ...base.portalSeminarSpeakers,
          {
            eventId,
            seminarId: "sem-b",
            speakers: [{ name: "Bo" }],
          },
        ],
        assignments: moved.assignments,
        eventIds: [eventId],
        partnershipEventIds: [eventId],
        seminars: events.flatMap((event) =>
          (event.seminars ?? []).map((row) => ({ id: row.id, eventId: event.id }))
        ),
      })
    ).toBeNull();
  });

  it("keeps an unconfirmed move editable and rejects invalid destinations", () => {
    const open = planAdminSeminarMove({
      partner: partner({
        seminarSlotsConfirmedAt: earlier,
        seminarSlotAssignments: [
          { eventId, seminarId: "sem-a", slots: 1, confirmedAt: null },
        ],
      }),
      events,
      partners: [],
      eventId,
      seminarId: "sem-a",
      destinationSeminarId: "sem-b",
      now,
    });
    expect(open.ok).toBe(true);
    if (!open.ok) return;
    expect(open.assignments[0]?.confirmedAt).toBeNull();
    expect(open.seminarSlotsConfirmedAt).toBe(earlier);

    expect(
      planAdminSeminarMove({
        partner: base,
        events,
        partners: [],
        eventId,
        seminarId: "sem-a",
        destinationSeminarId: "sem-x",
        now,
      })
    ).toMatchObject({ ok: false, error: "That seminar does not belong to this event." });
    expect(
      planAdminSeminarMove({
        partner: base,
        events,
        partners: [],
        eventId,
        seminarId: "sem-a",
        destinationSeminarId: "sem-d",
        now,
      })
    ).toMatchObject({ ok: false });
    expect(
      planAdminSeminarMove({
        partner: base,
        events,
        partners: [],
        eventId,
        seminarId: "sem-a",
        destinationSeminarId: "sem-c",
        now,
      }).ok
    ).toBe(false);
    expect(
      planAdminSeminarMove({
        partner: base,
        events,
        partners: [
          {
            id: "other",
            seminarSlotAssignments: [{ eventId, seminarId: "sem-full", slots: 1 }],
          },
        ],
        eventId,
        seminarId: "sem-a",
        destinationSeminarId: "sem-full",
        now,
      })
    ).toMatchObject({ ok: false, status: 409, error: SEMINAR_FULL });
    expect(
      planAdminSeminarMove({
        partner: partner({
          seminarSlotAssignments: [
            { eventId, seminarId: "sem-a", slots: 1, confirmedAt: earlier },
            { eventId, seminarId: "sem-b", slots: 1, confirmedAt: null },
          ],
        }),
        events,
        partners: [],
        eventId,
        seminarId: "sem-a",
        destinationSeminarId: "sem-b",
        now,
      })
    ).toMatchObject({ ok: false });

    const failed = planAdminSeminarMove({
      partner: base,
      events,
      partners: [
        {
          id: "other",
          seminarSlotAssignments: [{ seminarId: "sem-b", slots: 2 }],
        },
      ],
      eventId,
      seminarId: "sem-a",
      destinationSeminarId: "sem-b",
      now,
    });
    expect(failed.ok).toBe(false);
    expect(base.seminarSlotAssignments).toEqual([
      expect.objectContaining({ seminarId: "sem-a", slots: 1 }),
    ]);
  });

  it("offers only destinations that can take the partner", () => {
    expect(
      eligibleReassignmentDestinations({
        partner: partner({
          seminarSlotAssignments: [
            { eventId, seminarId: "sem-a", slots: 1 },
          ],
        }),
        events,
        partners: [
          {
            id: "other",
            seminarSlotAssignments: [{ seminarId: "sem-full", slots: 1 }],
          },
        ],
        eventId,
        seminarId: "sem-a",
      }).map((row) => row.seminarId)
    ).toEqual(["sem-b"]);
  });
});

describe("legacy stacked assignments", () => {
  const stacked = partner({
    eventPartnerships: [{ eventId, seminarSlotCount: 2 }],
    seminarSlotAssignments: [
      {
        eventId,
        seminarId: "sem-a",
        slots: 2,
        seminarTitle: "Design",
        confirmedAt: earlier,
      },
    ],
  });

  it("keeps an unchanged slots = 2 row and counts two seats", () => {
    const kept = chapter6Continuation(stacked);
    expect(kept.seminarSlotAssignments).toEqual(stacked.seminarSlotAssignments);
    expect(occupiedSeatCount(2)).toBe(2);
    expect(
      occupancyBySeminar([stacked], "someone-else").get("sem-a")
    ).toBe(2);
    expect(seminarAssignmentCanBeReassigned(2)).toBe(false);
    expect(seminarAssignmentCanBeReassigned(1)).toBe(true);
  });

  it("rejects a move of slots = 2 and leaves the source assignment in place", () => {
    const before = stacked.seminarSlotAssignments.map((row) => ({ ...row }));
    const moved = planAdminSeminarMove({
      partner: stacked,
      events,
      partners: [],
      eventId,
      seminarId: "sem-a",
      destinationSeminarId: "sem-b",
      now,
    });
    expect(moved).toMatchObject({
      ok: false,
      status: 400,
      error: LEGACY_STACKED_ASSIGNMENT_MOVE,
    });
    expect(stacked.seminarSlotAssignments).toEqual(before);
    expect(
      stacked.seminarSlotAssignments.some((row) => row.seminarId === "sem-b")
    ).toBe(false);
  });

  it("removes a slots = 2 row and frees both seats without a replacement", () => {
    const removed = planAdminSeminarRemoval({
      partner: stacked,
      eventId,
      seminarId: "sem-a",
    });
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.assignments).toEqual([]);
    expect(
      seminarSelectionSummary({
        seminarSlotCount: 2,
        assignments: removed.assignments,
        eventId,
      })
    ).toEqual({ allocated: 2, selected: 0, remaining: 2 });
    expect(
      occupancyBySeminar(
        [{ id: "partner-a", seminarSlotAssignments: removed.assignments }],
        "someone-else"
      ).get("sem-a") ?? 0
    ).toBe(0);
  });

  it("still rejects a new write with slots greater than 1", () => {
    expect(
      decideSeminarClaims({
        existingAssignments: [],
        nextAssignments: [{ eventId, seminarId: "sem-a", slots: 2 }],
        previousPartnerships: [{ eventId, seminarSlotCount: 2 }],
        nextPartnerships: [{ eventId, seminarSlotCount: 2 }],
        seminars: [{ id: "sem-a", eventId, panelistSlots: 3 }],
        otherOccupancy: new Map(),
      })
    ).toMatchObject({ ok: false, error: SEMINAR_SLOTS_MUST_BE_ONE });
  });
});

describe("admin seminar removal and roster", () => {
  it("removes one assignment and leaves historical speakers and other panelists", () => {
    const current = partner({
      seminarSlotsConfirmedAt: earlier,
      seminarSlotAssignments: [
        { eventId, seminarId: "sem-a", slots: 2, confirmedAt: earlier, seminarTitle: "Design" },
      ],
      portalSeminarSpeakers: [
        { eventId, seminarId: "sem-a", speakers: [{ name: "Ada" }], updatedAt: earlier },
      ],
    });
    const removed = planAdminSeminarRemoval({
      partner: current,
      eventId,
      seminarId: "sem-a",
    });
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.assignments).toEqual([]);
    expect(removed.seminarSlotsConfirmedAt).toBe(earlier);
    expect(current.portalSeminarSpeakers?.[0]?.seminarId).toBe("sem-a");

    const roster: SeminarSessionRoster = {
      eventId,
      seminarId: "sem-a",
      moderator: {
        id: "mod-1",
        name: "Host",
        organization: "Career Uttsav",
        status: "Confirmed",
      },
      panelists: [
        {
          id: "partner-seat-partner-a-0",
          name: "Ada",
          organization: "College",
          partnerId: "partner-a",
          status: "Invited",
        },
        {
          id: "manual-1",
          name: "Ada",
          organization: "College",
          status: "Invited",
        },
      ],
      updatedAt: earlier,
    };
    expect(rosterWithoutPartnerSeats(roster, "partner-a").panelists.map((row) => row.id)).toEqual([
      "manual-1",
    ]);
    expect(rosterWithoutPartnerSeats(roster, "partner-a").moderator?.id).toBe("mod-1");
  });
});
