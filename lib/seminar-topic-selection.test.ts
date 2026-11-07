import { describe, expect, it } from "vitest";

import {
  SEMINAR_ALLOCATION_EXCEEDED,
  SEMINAR_DUPLICATE_TOPIC,
  SEMINAR_FULL,
  SEMINAR_SLOTS_MUST_BE_ONE,
  SEMINAR_WRONG_EVENT,
} from "@/lib/seminar-allocation";
import {
  SEMINAR_TOPICS_ALREADY_CONFIRMED,
  SEMINAR_TOPICS_CONFIRM_INCOMPLETE,
  SEMINAR_TOPICS_LOCKED,
  SEMINAR_TOPICS_NOT_ALLOCATED,
  SEMINAR_TOPIC_INVALID,
  buildPartnerSeminarTopicCatalog,
  planPartnerSeminarTopicWrite,
  readSeminarTopicSelection,
  type SeminarTopicEvent,
  type SeminarTopicPartner,
} from "@/lib/seminar-topic-selection";

const eventId = "evt-001";

function seminar(
  id: string,
  panelistSlots: number | null,
  title = id
): NonNullable<SeminarTopicEvent["seminars"]>[number] {
  return {
    id,
    title,
    date: "2026-08-15",
    startTime: "10:00",
    endTime: "11:00",
    hall: 1,
    panelistSlots,
  };
}

function events(seminars: NonNullable<SeminarTopicEvent["seminars"]>): SeminarTopicEvent[] {
  return [{ id: eventId, title: "Bengaluru", city: "Bengaluru", seminars }];
}

function partner(
  partial: Partial<SeminarTopicPartner> & Pick<SeminarTopicPartner, "id">
): SeminarTopicPartner {
  return {
    seminarSlotAssignments: [],
    eventPartnerships: [{ eventId, seminarSlotCount: 3 }],
    ...partial,
  };
}

function topic(seminarId: string, assignmentEventId = eventId) {
  return { eventId: assignmentEventId, seminarId };
}

describe("partner seminar topic catalog", () => {
  const catalogEvents = events([
    seminar("open", 2, "Open topic"),
    seminar("zero", 0, "No partners"),
    seminar("undecided", null, "Undecided"),
    seminar("full", 1, "Full topic"),
  ]);

  it("shows an open seminar and hides zero, undecided, and full seminars", () => {
    const catalog = buildPartnerSeminarTopicCatalog({
      partner: partner({ id: "partner-a" }),
      events: catalogEvents,
      partners: [
        {
          id: "someone",
          seminarSlotAssignments: [{ eventId, seminarId: "full", slots: 1 }],
        },
      ],
    });
    const topics = catalog.events[0]?.topics ?? [];
    expect(topics.map((row) => row.seminarId)).toEqual(["open"]);
    expect(Object.keys(topics[0] ?? {}).sort()).toEqual([
      "date",
      "endTime",
      "eventId",
      "hall",
      "locked",
      "selected",
      "seminarId",
      "startTime",
      "title",
    ]);
    expect(JSON.stringify(topics)).not.toMatch(
      /remainingCapacity|panelistSlots|occupancy|"slots"/
    );
    expect(catalog.events[0]).toMatchObject({
      allocated: 3,
      selected: 0,
      remaining: 3,
    });
  });

  it("keeps a selected full seminar visible only to the partner who holds it", () => {
    const holder = buildPartnerSeminarTopicCatalog({
      partner: partner({
        id: "holder",
        seminarSlotAssignments: [{ eventId, seminarId: "full", slots: 1 }],
      }),
      events: catalogEvents,
      partners: [],
    });
    expect(holder.events[0]?.topics.map((row) => row.seminarId)).toContain("full");
    expect(holder.events[0]?.selected).toBe(1);

    const other = buildPartnerSeminarTopicCatalog({
      partner: partner({ id: "other" }),
      events: catalogEvents,
      partners: [
        {
          id: "holder",
          seminarSlotAssignments: [{ eventId, seminarId: "full", slots: 1 }],
        },
      ],
    });
    expect(other.events[0]?.topics.map((row) => row.seminarId)).not.toContain("full");
  });

  it("does not return a seminar from an unrelated event", () => {
    const catalog = buildPartnerSeminarTopicCatalog({
      partner: partner({ id: "partner-a" }),
      events: [
        ...events([seminar("mine", 2, "Mine")]),
        {
          id: "evt-002",
          title: "Mumbai",
          city: "Mumbai",
          seminars: [seminar("other-event", 4, "Elsewhere")],
        },
      ],
      partners: [],
    });
    const ids = catalog.events.flatMap((group) => group.topics.map((row) => row.seminarId));
    expect(ids).toEqual(["mine"]);
    expect(catalog.events.map((group) => group.eventId)).toEqual([eventId]);
  });

  it("counts a legacy stack as one selected topic and two occupied seats", () => {
    const catalog = buildPartnerSeminarTopicCatalog({
      partner: partner({
        id: "legacy",
        eventPartnerships: [{ eventId, seminarSlotCount: 2 }],
        seminarSlotAssignments: [{ eventId, seminarId: "open", slots: 2 }],
      }),
      events: events([seminar("open", 3, "Open topic")]),
      partners: [],
    });
    expect(catalog.events[0]).toMatchObject({ allocated: 2, selected: 1, remaining: 1 });
    const other = buildPartnerSeminarTopicCatalog({
      partner: partner({ id: "other", eventPartnerships: [{ eventId, seminarSlotCount: 1 }] }),
      events: events([seminar("open", 3, "Open topic")]),
      partners: [
        {
          id: "legacy",
          seminarSlotAssignments: [{ eventId, seminarId: "open", slots: 2 }],
        },
      ],
    });
    expect(other.events[0]?.topics.map((row) => row.seminarId)).toEqual(["open"]);
    expect(JSON.stringify(other.events[0]?.topics)).not.toMatch(
      /remainingCapacity|panelistSlots|occupancy|"slots"/
    );
    const blocked = buildPartnerSeminarTopicCatalog({
      partner: partner({ id: "other", eventPartnerships: [{ eventId, seminarSlotCount: 1 }] }),
      events: events([seminar("open", 2, "Open topic")]),
      partners: [
        {
          id: "legacy",
          seminarSlotAssignments: [{ eventId, seminarId: "open", slots: 2 }],
        },
      ],
    });
    expect(blocked.events[0]?.topics).toEqual([]);
  });

  it("offers no picker when nothing is allocated", () => {
    const catalog = buildPartnerSeminarTopicCatalog({
      partner: partner({
        id: "partner-a",
        eventPartnerships: [{ eventId, seminarSlotCount: 0 }],
      }),
      events: events([seminar("open", 2)]),
      partners: [],
    });
    expect(catalog.events).toEqual([]);
    expect(catalog.canConfirm).toBe(false);
  });
});

describe("partner seminar topic writes", () => {
  const topicEvents = events([
    seminar("sem-a", 3, "Design"),
    seminar("sem-b", 3, "Media"),
    seminar("sem-c", 3, "Law"),
    seminar("sem-d", 3, "Health"),
  ]);

  it("saves a partial selection without confirming it", () => {
    const planned = planPartnerSeminarTopicWrite({
      partner: partner({ id: "partner-a" }),
      events: topicEvents,
      partners: [],
      topics: [topic("sem-a")],
      confirm: false,
      now: "2026-11-08T00:00:00.000Z",
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.assignments).toEqual([
      {
        eventId,
        seminarId: "sem-a",
        slots: 1,
        seminarTitle: "Design",
        confirmedAt: null,
      },
    ]);
    expect(planned.assignments[0]?.seminarTitle?.includes("\u2060")).toBe(false);
    expect(planned.seminarSlotsConfirmedAt).toBeUndefined();
    const catalog = buildPartnerSeminarTopicCatalog({
      partner: partner({
        id: "partner-a",
        seminarSlotAssignments: planned.assignments,
      }),
      events: topicEvents,
      partners: [],
    });
    expect(catalog.events[0]).toMatchObject({ selected: 1, remaining: 2 });
    expect(catalog.canConfirm).toBe(false);
  });

  it("rejects too many topics, duplicates, stacked slots, a full seminar, and the wrong event", () => {
    expect(
      planPartnerSeminarTopicWrite({
        partner: partner({
          id: "partner-a",
          eventPartnerships: [{ eventId, seminarSlotCount: 1 }],
        }),
        events: topicEvents,
        partners: [],
        topics: [topic("sem-a"), topic("sem-b")],
        confirm: false,
      })
    ).toMatchObject({ ok: false, error: SEMINAR_ALLOCATION_EXCEEDED });

    expect(
      readSeminarTopicSelection({
        topics: [topic("sem-a"), topic("sem-a")],
      })
    ).toMatchObject({ ok: false, error: SEMINAR_DUPLICATE_TOPIC });

    expect(
      readSeminarTopicSelection({
        topics: [{ ...topic("sem-a"), slots: 2 }],
      })
    ).toMatchObject({ ok: false, error: SEMINAR_SLOTS_MUST_BE_ONE });

    expect(
      planPartnerSeminarTopicWrite({
        partner: partner({ id: "partner-a" }),
        events: topicEvents,
        partners: [
          {
            id: "other",
            seminarSlotAssignments: [
              { eventId, seminarId: "sem-a", slots: 3 },
            ],
          },
        ],
        topics: [topic("sem-a")],
        confirm: false,
      })
    ).toMatchObject({ ok: false, status: 409, error: SEMINAR_FULL });

    expect(
      planPartnerSeminarTopicWrite({
        partner: partner({ id: "partner-a" }),
        events: [
          ...topicEvents,
          {
            id: "evt-002",
            title: "Mumbai",
            city: "Mumbai",
            seminars: [seminar("sem-x", 2, "Elsewhere")],
          },
        ],
        partners: [],
        topics: [topic("sem-x")],
        confirm: false,
      })
    ).toMatchObject({ ok: false, error: SEMINAR_WRONG_EVENT });

    expect(
      planPartnerSeminarTopicWrite({
        partner: partner({ id: "partner-a" }),
        events: topicEvents,
        partners: [],
        topics: [topic("missing")],
        confirm: false,
      })
    ).toMatchObject({ ok: false, error: SEMINAR_TOPIC_INVALID });
  });

  it("lets an unconfirmed partner remove or replace a topic and frees the seat", () => {
    const removed = planPartnerSeminarTopicWrite({
      partner: partner({
        id: "partner-a",
        seminarSlotAssignments: [
          { eventId, seminarId: "sem-a", slots: 1 },
          { eventId, seminarId: "sem-b", slots: 1 },
        ],
      }),
      events: topicEvents,
      partners: [],
      topics: [topic("sem-b")],
      confirm: false,
    });
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.assignments.map((row) => row.seminarId)).toEqual(["sem-b"]);

    const replaced = planPartnerSeminarTopicWrite({
      partner: partner({
        id: "partner-a",
        seminarSlotAssignments: [{ eventId, seminarId: "sem-a", slots: 1 }],
      }),
      events: topicEvents,
      partners: [],
      topics: [topic("sem-c")],
      confirm: false,
    });
    expect(replaced.ok).toBe(true);
    if (!replaced.ok) return;
    expect(replaced.assignments.map((row) => row.seminarId)).toEqual(["sem-c"]);

    const catalog = buildPartnerSeminarTopicCatalog({
      partner: partner({
        id: "partner-b",
        eventPartnerships: [{ eventId, seminarSlotCount: 1 }],
      }),
      events: events([seminar("sem-a", 1, "Design")]),
      partners: [
        {
          id: "partner-a",
          seminarSlotAssignments: removed.assignments,
        },
      ],
    });
    expect(catalog.events[0]?.topics.map((row) => row.seminarId)).toContain("sem-a");
  });

  it("confirms only an exact selection and then locks it", () => {
    const current = partner({
      id: "partner-a",
      seminarSlotAssignments: [
        { eventId, seminarId: "sem-a", slots: 1 },
        { eventId, seminarId: "sem-b", slots: 1 },
      ],
    });
    expect(
      planPartnerSeminarTopicWrite({
        partner: current,
        events: topicEvents,
        partners: [],
        topics: [topic("sem-a"), topic("sem-b")],
        confirm: true,
      })
    ).toMatchObject({ ok: false, error: SEMINAR_TOPICS_CONFIRM_INCOMPLETE });

    const confirmed = planPartnerSeminarTopicWrite({
      partner: current,
      events: topicEvents,
      partners: [],
      topics: [topic("sem-a"), topic("sem-b"), topic("sem-c")],
      confirm: true,
      now: "2026-11-08T01:00:00.000Z",
    });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.seminarSlotsConfirmedAt).toBe("2026-11-08T01:00:00.000Z");
    expect(confirmed.assignments.map((row) => row.seminarTitle)).toEqual([
      "Design",
      "Media",
      "Law",
    ]);
    expect(confirmed.assignments.map((row) => row.confirmedAt)).toEqual([
      "2026-11-08T01:00:00.000Z",
      "2026-11-08T01:00:00.000Z",
      "2026-11-08T01:00:00.000Z",
    ]);
    expect(
      confirmed.assignments.every((row) => !row.seminarTitle?.includes("\u2060"))
    ).toBe(true);

    const locked = partner({
      id: "partner-a",
      seminarSlotsConfirmedAt: confirmed.seminarSlotsConfirmedAt,
      seminarSlotAssignments: confirmed.assignments,
    });
    expect(
      planPartnerSeminarTopicWrite({
        partner: locked,
        events: topicEvents,
        partners: [],
        topics: [topic("sem-a"), topic("sem-b"), topic("sem-d")],
        confirm: false,
      })
    ).toMatchObject({ ok: false, error: SEMINAR_TOPICS_LOCKED });
    expect(
      planPartnerSeminarTopicWrite({
        partner: locked,
        events: topicEvents,
        partners: [],
        topics: [topic("sem-a"), topic("sem-b"), topic("sem-c")],
        confirm: true,
      })
    ).toMatchObject({ ok: false, error: SEMINAR_TOPICS_ALREADY_CONFIRMED });
  });

  it("rechecks capacity while confirming a new topic", () => {
    expect(
      planPartnerSeminarTopicWrite({
        partner: partner({
          id: "partner-a",
          eventPartnerships: [{ eventId, seminarSlotCount: 1 }],
        }),
        events: events([seminar("sem-a", 1, "Design")]),
        partners: [
          {
            id: "other",
            seminarSlotAssignments: [{ eventId, seminarId: "sem-a", slots: 1 }],
          },
        ],
        topics: [topic("sem-a")],
        confirm: true,
      })
    ).toMatchObject({ ok: false, status: 409, error: SEMINAR_FULL });
  });

  it("keeps a confirmed legacy assignment read-only and does not rewrite stacked slots", () => {
    const legacy = partner({
      id: "legacy",
      eventPartnerships: [{ eventId, seminarSlotCount: 1 }],
      seminarSlotsConfirmedAt: "2026-06-01T00:00:00.000Z",
      seminarSlotAssignments: [
        { eventId, seminarId: "sem-a", slots: 2, seminarTitle: "Design" },
      ],
    });
    expect(
      planPartnerSeminarTopicWrite({
        partner: legacy,
        events: topicEvents,
        partners: [],
        topics: [topic("sem-b")],
        confirm: false,
      })
    ).toMatchObject({ ok: false, error: SEMINAR_TOPICS_LOCKED });

    const kept = planPartnerSeminarTopicWrite({
      partner: partner({
        id: "legacy",
        eventPartnerships: [{ eventId, seminarSlotCount: 1 }],
        seminarSlotAssignments: [
          { eventId, seminarId: "sem-a", slots: 2, seminarTitle: "Design" },
        ],
      }),
      events: topicEvents,
      partners: [],
      topics: [topic("sem-a")],
      confirm: false,
    });
    expect(kept.ok).toBe(true);
    if (!kept.ok) return;
    expect(kept.assignments).toEqual([
      {
        eventId,
        seminarId: "sem-a",
        slots: 2,
        seminarTitle: "Design",
        confirmedAt: null,
      },
    ]);
  });

  it("lets a confirmed partner add only the newly allocated topics and confirm again", () => {
    const confirmed = planPartnerSeminarTopicWrite({
      partner: partner({
        id: "partner-a",
        eventPartnerships: [{ eventId, seminarSlotCount: 2 }],
        seminarSlotAssignments: [
          { eventId, seminarId: "sem-a", slots: 1, seminarTitle: "Design" },
          { eventId, seminarId: "sem-b", slots: 1, seminarTitle: "Media" },
        ],
        seminarSlotsConfirmedAt: "2026-06-01T00:00:00.000Z",
      }),
      events: topicEvents,
      partners: [],
      topics: [topic("sem-a"), topic("sem-b")],
      confirm: false,
    });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;

    const grown = partner({
      id: "partner-a",
      eventPartnerships: [{ eventId, seminarSlotCount: 4 }],
      seminarSlotsConfirmedAt: confirmed.seminarSlotsConfirmedAt,
      seminarSlotAssignments: confirmed.assignments,
    });
    expect(
      planPartnerSeminarTopicWrite({
        partner: grown,
        events: topicEvents,
        partners: [],
        topics: [topic("sem-a"), topic("sem-c")],
        confirm: false,
      })
    ).toMatchObject({ ok: false, error: SEMINAR_TOPICS_LOCKED });

    const added = planPartnerSeminarTopicWrite({
      partner: grown,
      events: topicEvents,
      partners: [],
      topics: [topic("sem-a"), topic("sem-b"), topic("sem-c"), topic("sem-d")],
      confirm: false,
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(added.assignments.map((row) => row.seminarId)).toEqual([
      "sem-a",
      "sem-b",
      "sem-c",
      "sem-d",
    ]);
    expect(added.seminarSlotsConfirmedAt).toBe("2026-06-01T00:00:00.000Z");
    expect(added.assignments.find((row) => row.seminarId === "sem-a")?.slots).toBe(1);

    const expanded = partner({
      id: "partner-a",
      eventPartnerships: [{ eventId, seminarSlotCount: 4 }],
      seminarSlotsConfirmedAt: added.seminarSlotsConfirmedAt,
      seminarSlotAssignments: added.assignments,
    });
    expect(
      planPartnerSeminarTopicWrite({
        partner: expanded,
        events: topicEvents,
        partners: [],
        topics: [topic("sem-b"), topic("sem-c"), topic("sem-d")],
        confirm: false,
      })
    ).toMatchObject({ ok: false, error: SEMINAR_TOPICS_LOCKED });

    const removedAddition = planPartnerSeminarTopicWrite({
      partner: expanded,
      events: topicEvents,
      partners: [],
      topics: [topic("sem-a"), topic("sem-b"), topic("sem-c")],
      confirm: false,
    });
    expect(removedAddition.ok).toBe(true);
    if (!removedAddition.ok) return;
    expect(removedAddition.assignments.map((row) => row.seminarId)).toEqual([
      "sem-a",
      "sem-b",
      "sem-c",
    ]);

    const again = planPartnerSeminarTopicWrite({
      partner: expanded,
      events: topicEvents,
      partners: [],
      topics: [topic("sem-a"), topic("sem-b"), topic("sem-c"), topic("sem-d")],
      confirm: true,
      now: "2026-11-08T02:00:00.000Z",
    });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.seminarSlotsConfirmedAt).toBe("2026-11-08T02:00:00.000Z");
    expect(again.assignments.map((row) => [row.seminarId, row.slots])).toEqual([
      ["sem-a", 1],
      ["sem-b", 1],
      ["sem-c", 1],
      ["sem-d", 1],
    ]);
    expect(again.assignments.map((row) => row.confirmedAt)).toEqual([
      "2026-06-01T00:00:00.000Z",
      "2026-06-01T00:00:00.000Z",
      "2026-11-08T02:00:00.000Z",
      "2026-11-08T02:00:00.000Z",
    ]);
    expect(again.assignments.map((row) => row.seminarTitle)).toEqual([
      "Design",
      "Media",
      "Law",
      "Health",
    ]);
    expect(added.assignments.map((row) => row.confirmedAt)).toEqual([
      "2026-06-01T00:00:00.000Z",
      "2026-06-01T00:00:00.000Z",
      null,
      null,
    ]);
  });

  it("ignores confirmation fields sent by the partner", () => {
    const parsed = readSeminarTopicSelection({
      partnerId: "someone-else",
      seminarSlotsConfirmedAt: "2099-01-01T00:00:00.000Z",
      confirmedAt: "2099-01-01T00:00:00.000Z",
      confirm: false,
      topics: [
        {
          eventId,
          seminarId: "sem-a",
          confirmedAt: "2099-01-01T00:00:00.000Z",
          seminarTitle: "Hacked\u2060",
          slots: 1,
        },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.confirm).toBe(false);
    expect(parsed.topics).toEqual([topic("sem-a")]);

    const planned = planPartnerSeminarTopicWrite({
      partner: partner({ id: "partner-a" }),
      events: topicEvents,
      partners: [],
      topics: parsed.topics,
      confirm: parsed.confirm,
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.seminarSlotsConfirmedAt).toBeUndefined();
    expect(planned.assignments).toEqual([
      {
        eventId,
        seminarId: "sem-a",
        slots: 1,
        seminarTitle: "Design",
        confirmedAt: null,
      },
    ]);
  });

  it("rejects confirmation when no topics are allocated", () => {
    expect(
      planPartnerSeminarTopicWrite({
        partner: partner({
          id: "partner-a",
          eventPartnerships: [{ eventId, seminarSlotCount: 0 }],
        }),
        events: topicEvents,
        partners: [],
        topics: [],
        confirm: true,
      })
    ).toMatchObject({ ok: false, error: SEMINAR_TOPICS_NOT_ALLOCATED });
  });
});
