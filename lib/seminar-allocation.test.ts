import { describe, expect, it } from "vitest";

import { clampSeminarSlotAssignmentsToBudget } from "@/lib/partner-event-config";
import {
  SEMINAR_ALLOCATION_EXCEEDED,
  SEMINAR_CAPACITY_NOT_DECIDED,
  SEMINAR_CAPACITY_ZERO,
  SEMINAR_DUPLICATE_TOPIC,
  SEMINAR_FULL,
  SEMINAR_PARTNERSHIP_REQUIRED,
  SEMINAR_SLOTS_MUST_BE_ONE,
  SEMINAR_WRONG_EVENT,
  SPEAKER_SEMINAR_NOT_ASSIGNED,
  decideSeminarClaims,
  occupancyBySeminar,
  portalSpeakerRowsError,
  preserveSeminarConfirmation,
  seminarSelectionSummary,
  seminarSlotReductionMessage,
  type SeminarAssignmentRef,
  type SeminarCapacityRef,
} from "@/lib/seminar-allocation";

const eventId = "evt-001";

function seminar(
  id: string,
  panelistSlots: number | null,
  seminarEventId = eventId
): SeminarCapacityRef {
  return { id, eventId: seminarEventId, panelistSlots };
}

function claim(
  seminarId: string,
  slots = 1,
  assignmentEventId = eventId
): SeminarAssignmentRef {
  return { eventId: assignmentEventId, seminarId, slots };
}

function decide(input: {
  existing?: SeminarAssignmentRef[];
  next?: SeminarAssignmentRef[];
  previousAllocated?: number;
  nextAllocated?: number;
  seminars: SeminarCapacityRef[];
  others?: Record<string, number>;
}) {
  return decideSeminarClaims({
    existingAssignments: input.existing ?? [],
    nextAssignments: input.next ?? [],
    previousPartnerships: [
      { eventId, seminarSlotCount: input.previousAllocated ?? input.nextAllocated ?? 1 },
    ],
    nextPartnerships: [{ eventId, seminarSlotCount: input.nextAllocated ?? 1 }],
    seminars: input.seminars,
    otherOccupancy: new Map(Object.entries(input.others ?? {})),
  });
}

describe("seminar topic allocation", () => {
  it("derives allocated, selected, and remaining from topic rows", () => {
    expect(
      seminarSelectionSummary({
        seminarSlotCount: 3,
        eventId,
        assignments: [claim("sem-a"), claim("sem-b"), claim("sem-a", 2, "evt-002")],
      })
    ).toEqual({ allocated: 3, selected: 2, remaining: 1 });
  });

  it("accepts one topic with a single slot", () => {
    expect(
      decide({
        next: [claim("sem-a")],
        nextAllocated: 1,
        seminars: [seminar("sem-a", 2)],
      }).ok
    ).toBe(true);
  });

  it("counts a legacy stack as seats and the partner as one topic", () => {
    const legacy = [claim("sem-a", 2)];
    expect(
      seminarSelectionSummary({
        seminarSlotCount: 1,
        eventId,
        assignments: legacy,
      })
    ).toEqual({ allocated: 1, selected: 1, remaining: 0 });
    expect(
      occupancyBySeminar(
        [{ id: "legacy", seminarSlotAssignments: legacy }],
        "someone-else"
      ).get("sem-a")
    ).toBe(2);
    expect(
      occupancyBySeminar(
        [{ id: "new-partner", seminarSlotAssignments: [claim("sem-a")] }],
        "someone-else"
      ).get("sem-a")
    ).toBe(1);
  });

  it("lets one new seat fill the remainder after a legacy stack and rejects the next", () => {
    expect(
      decide({
        next: [claim("sem-a")],
        nextAllocated: 1,
        seminars: [seminar("sem-a", 3)],
        others: { "sem-a": 2 },
      }).ok
    ).toBe(true);
    expect(
      decide({
        next: [claim("sem-a")],
        nextAllocated: 1,
        seminars: [seminar("sem-a", 3)],
        others: { "sem-a": 3 },
      })
    ).toMatchObject({ ok: false, status: 409, error: SEMINAR_FULL });
  });

  it("rejects a duplicate topic and a new stacked slot", () => {
    expect(
      decide({
        next: [claim("sem-a"), claim("sem-a")],
        nextAllocated: 2,
        seminars: [seminar("sem-a", 2)],
      })
    ).toMatchObject({ ok: false, error: SEMINAR_DUPLICATE_TOPIC });
    expect(
      decide({
        next: [claim("sem-a", 2)],
        nextAllocated: 2,
        seminars: [seminar("sem-a", 2)],
      })
    ).toMatchObject({ ok: false, error: SEMINAR_SLOTS_MUST_BE_ONE });
  });

  it("keeps an unchanged legacy stack and does not rewrite it", () => {
    const existing = [claim("sem-a", 2)];
    const next = existing.map((row) => ({ ...row }));
    const decision = decide({
      existing,
      next,
      previousAllocated: 2,
      nextAllocated: 2,
      seminars: [seminar("sem-a", 2)],
    });
    expect(decision.ok).toBe(true);
    expect(existing[0]?.slots).toBe(2);
    expect(next[0]?.slots).toBe(2);
  });

  it("rejects a seminar from another event and a missing partnership", () => {
    expect(
      decide({
        next: [claim("sem-other")],
        seminars: [seminar("sem-other", 2, "evt-002")],
      })
    ).toMatchObject({ ok: false, error: SEMINAR_WRONG_EVENT });
    expect(
      decideSeminarClaims({
        existingAssignments: [],
        nextAssignments: [claim("sem-a")],
        previousPartnerships: [],
        nextPartnerships: [],
        seminars: [seminar("sem-a", 2)],
        otherOccupancy: new Map(),
      })
    ).toMatchObject({ ok: false, error: SEMINAR_PARTNERSHIP_REQUIRED });
  });

  it("rejects selecting more topics than seminarSlotCount", () => {
    expect(
      decide({
        next: [claim("sem-a"), claim("sem-b")],
        previousAllocated: 1,
        nextAllocated: 1,
        seminars: [seminar("sem-a", 2), seminar("sem-b", 2)],
      })
    ).toMatchObject({ ok: false, error: SEMINAR_ALLOCATION_EXCEEDED });
  });

  it("rejects a reduction below the selected topic count without changing assignments", () => {
    const existing = [claim("sem-a"), claim("sem-b"), claim("sem-c")];
    const next = existing.map((row) => ({ ...row }));
    const decision = decide({
      existing,
      next,
      previousAllocated: 3,
      nextAllocated: 2,
      seminars: [seminar("sem-a", 3), seminar("sem-b", 3), seminar("sem-c", 3)],
    });
    expect(decision).toMatchObject({
      ok: false,
      error: seminarSlotReductionMessage(1, 2),
    });
    expect(next).toEqual(existing);
  });

  it("allows a larger allocation to keep the current topics", () => {
    const existing = [claim("sem-a"), claim("sem-b")];
    expect(
      decide({
        existing,
        next: existing,
        previousAllocated: 2,
        nextAllocated: 4,
        seminars: [seminar("sem-a", 3), seminar("sem-b", 3)],
      }).ok
    ).toBe(true);
  });

  it("rejects new seats on 0, null, and full seminars, and accepts an open one", () => {
    expect(
      decide({
        next: [claim("sem-zero")],
        seminars: [seminar("sem-zero", 0)],
      })
    ).toMatchObject({ ok: false, error: SEMINAR_CAPACITY_ZERO });
    expect(
      decide({
        next: [claim("sem-null")],
        seminars: [seminar("sem-null", null)],
      })
    ).toMatchObject({ ok: false, error: SEMINAR_CAPACITY_NOT_DECIDED });
    expect(
      decide({
        next: [claim("sem-full")],
        seminars: [seminar("sem-full", 1)],
        others: { "sem-full": 1 },
      })
    ).toMatchObject({ ok: false, status: 409, error: SEMINAR_FULL });
    expect(
      decide({
        next: [claim("sem-open")],
        seminars: [seminar("sem-open", 2)],
        others: { "sem-open": 1 },
      }).ok
    ).toBe(true);
  });

  it("frees a seat when the assignment is released", () => {
    const released = decide({
      existing: [claim("sem-a")],
      next: [],
      previousAllocated: 1,
      nextAllocated: 1,
      seminars: [seminar("sem-a", 1)],
    });
    expect(released.ok).toBe(true);
    expect(
      decide({
        next: [claim("sem-a")],
        seminars: [seminar("sem-a", 1)],
        others: {},
      }).ok
    ).toBe(true);
  });

  it("does not drop assignments when the budget is smaller", () => {
    const assignments = [claim("sem-a"), claim("sem-b"), claim("sem-c", 2)];
    expect(clampSeminarSlotAssignmentsToBudget(assignments, { [eventId]: 1 })).toEqual(
      assignments
    );
  });

  it("keeps confirmation when allocation grows and does not invent it for a partial save", () => {
    const kept = preserveSeminarConfirmation(
      {
        seminarSlotsConfirmedAt: "2026-06-01T00:00:00.000Z",
        seminarSlotAssignments: [claim("sem-a"), claim("sem-b")],
      },
      {
        seminarSlotsConfirmedAt: undefined,
        seminarSlotAssignments: [claim("sem-a"), claim("sem-b")],
      }
    );
    expect(kept.seminarSlotsConfirmedAt).toBe("2026-06-01T00:00:00.000Z");

    const partial = preserveSeminarConfirmation(
      { seminarSlotsConfirmedAt: undefined, seminarSlotAssignments: [] },
      { seminarSlotsConfirmedAt: undefined, seminarSlotAssignments: [claim("sem-a")] }
    );
    expect(partial.seminarSlotsConfirmedAt).toBeUndefined();
  });
});

describe("portal speaker assignment guard", () => {
  const seminars = [
    { id: "sem-a", eventId },
    { id: "sem-b", eventId: "evt-002" },
  ];
  const base = {
    assignments: [claim("sem-a")],
    eventIds: [eventId],
    partnershipEventIds: [eventId],
    seminars,
  };

  it("allows speaker details for the assigned seminar", () => {
    expect(
      portalSpeakerRowsError({
        ...base,
        nextSpeakers: [{ eventId, seminarId: "sem-a", speakers: [{ name: "Asha" }] }],
      })
    ).toBeNull();
  });

  it("rejects an unassigned seminar and a seminar on another event", () => {
    expect(
      portalSpeakerRowsError({
        ...base,
        nextSpeakers: [{ eventId, seminarId: "sem-missing", speakers: [{ name: "Asha" }] }],
      })
    ).toBe(SEMINAR_WRONG_EVENT);
    expect(
      portalSpeakerRowsError({
        ...base,
        nextSpeakers: [{ eventId, seminarId: "sem-b", speakers: [{ name: "Asha" }] }],
      })
    ).toBe(SEMINAR_WRONG_EVENT);
    expect(
      portalSpeakerRowsError({
        ...base,
        nextSpeakers: [
          {
            eventId,
            seminarId: "sem-open",
            speakers: [{ name: "Asha" }],
          },
        ],
        seminars: [...seminars, { id: "sem-open", eventId }],
      })
    ).toBe(SPEAKER_SEMINAR_NOT_ASSIGNED);
  });

  it("leaves a stored speaker row for a previous topic unchanged", () => {
    const historical = {
      eventId,
      seminarId: "sem-old",
      speakers: [{ name: "Historical" }],
    };
    expect(
      portalSpeakerRowsError({
        ...base,
        existingSpeakers: [historical],
        nextSpeakers: [
          historical,
          { eventId, seminarId: "sem-a", speakers: [{ name: "Asha" }] },
        ],
        seminars: [...seminars, { id: "sem-old", eventId }],
      })
    ).toBeNull();
  });
});
