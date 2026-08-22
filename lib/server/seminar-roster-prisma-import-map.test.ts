import { Prisma } from "@/lib/generated/prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildSeminarRosterImportPlan,
  mapSeminarRosterSourceToPrisma,
  rosterSessionKey,
  validateSeminarRosterSources,
} from "@/lib/server/seminar-roster-prisma-import-map";
import {
  canonicalizeSeminarRosterForComparison,
  compareSeminarRosters,
  deepCanonicalizeStableJson,
  deepCanonicalizeValue,
  type PrismaSeminarSessionRosterRecord,
} from "@/lib/server/seminar-roster-reconciliation";
import type { SeminarSessionRoster } from "@/types";

const EVENT_ID = "evt-001";
const SEMINAR_ID = "sem-001-a";
const PARTNER_ID = "partner-001";

function baseRoster(overrides: Partial<SeminarSessionRoster> = {}): SeminarSessionRoster {
  return {
    eventId: EVENT_ID,
    seminarId: SEMINAR_ID,
    moderator: {
      id: "mod-1",
      name: "Dr. Rao",
      organization: "Christ University",
      status: "Confirmed",
    },
    panelists: [
      {
        id: "panel-1",
        name: "Speaker One",
        organization: "Partner A",
        partnerId: PARTNER_ID,
        seatIndex: 0,
        status: "Invited",
      },
      {
        id: "panel-2",
        name: "Speaker Two",
        organization: "Partner B",
        seatIndex: 1,
        status: "Tentative",
      },
    ],
    topicBrief: "Career pathways",
    notes: "Internal note",
    updatedAt: "2026-08-20T12:34:56.789Z",
    ...overrides,
  };
}

function catalog() {
  return {
    knownEventIds: new Set([EVENT_ID]),
    seminarCatalog: new Map([
      [
        SEMINAR_ID,
        { id: SEMINAR_ID, eventId: EVENT_ID, panelistSlots: 4 },
      ],
    ]),
    knownPartnerIds: new Set([PARTNER_ID]),
  };
}

describe("seminar roster prisma import map", () => {
  it("uses composite roster identity eventId + seminarId", () => {
    expect(rosterSessionKey(EVENT_ID, SEMINAR_ID)).toBe("evt-001:sem-001-a");
    const mapped = mapSeminarRosterSourceToPrisma(baseRoster());
    expect(mapped.eventId).toBe(EVENT_ID);
    expect(mapped.seminarId).toBe(SEMINAR_ID);
  });

  it("preserves panelist order exactly in import mapping", () => {
    const roster = baseRoster();
    const mapped = mapSeminarRosterSourceToPrisma(roster);
    expect(mapped.panelists).toEqual(roster.panelists);
    expect((mapped.panelists as unknown as typeof roster.panelists)[0]?.id).toBe("panel-1");
    expect((mapped.panelists as unknown as typeof roster.panelists)[1]?.id).toBe("panel-2");
  });

  it("preserves moderator null", () => {
    const mapped = mapSeminarRosterSourceToPrisma(
      baseRoster({ moderator: null })
    );
    expect(mapped.moderator).toBe(Prisma.JsonNull);
  });

  it("preserves partnerId inside speaker JSON", () => {
    const mapped = mapSeminarRosterSourceToPrisma(baseRoster());
    const panelists = mapped.panelists as Array<{ partnerId?: string }>;
    expect(panelists[0]?.partnerId).toBe(PARTNER_ID);
  });

  it("preserves updatedAt exactly from JSON", () => {
    const updatedAt = "2026-08-20T12:34:56.789Z";
    const mapped = mapSeminarRosterSourceToPrisma(baseRoster({ updatedAt }));
    expect(mapped.updatedAt).toEqual(new Date(updatedAt));
  });

  it("detects duplicate session keys", () => {
    const result = validateSeminarRosterSources({
      rosters: [baseRoster(), baseRoster()],
      ...catalog(),
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.code === "duplicate_session")).toBe(
      true
    );
  });

  it("detects seminar/event mismatch", () => {
    const result = validateSeminarRosterSources({
      rosters: [baseRoster({ eventId: "evt-999" })],
      ...catalog(),
    });
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) => error.code === "seminar_event_mismatch")
    ).toBe(true);
  });

  it("detects orphan partner references", () => {
    const result = validateSeminarRosterSources({
      rosters: [
        baseRoster({
          panelists: [
            {
              id: "panel-x",
              name: "Speaker",
              organization: "Org",
              partnerId: "missing-partner",
              seatIndex: 0,
              status: "Invited",
            },
          ],
        }),
      ],
      ...catalog(),
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.code === "orphan_partner")).toBe(
      true
    );
  });

  it("preserves topicBrief empty string in import mapping", () => {
    const mapped = mapSeminarRosterSourceToPrisma(baseRoster({ topicBrief: "" }));
    expect(mapped.topicBrief).toBe("");
  });

  it("preserves notes empty string in import mapping", () => {
    const mapped = mapSeminarRosterSourceToPrisma(baseRoster({ notes: "" }));
    expect(mapped.notes).toBe("");
  });

  it("maps missing topicBrief to Prisma null", () => {
    const roster = baseRoster();
    delete roster.topicBrief;
    const mapped = mapSeminarRosterSourceToPrisma(roster);
    expect(mapped.topicBrief).toBeNull();
  });

  it("maps missing notes to Prisma null", () => {
    const roster = baseRoster();
    delete roster.notes;
    const mapped = mapSeminarRosterSourceToPrisma(roster);
    expect(mapped.notes).toBeNull();
  });
});

describe("seminar roster reconciliation", () => {
  it("treats nested objects with different key order as equal", () => {
    expect(
      deepCanonicalizeStableJson({
        id: "panel-1",
        name: "Speaker",
        organization: "Org",
      })
    ).toBe(
      deepCanonicalizeStableJson({
        organization: "Org",
        id: "panel-1",
        name: "Speaker",
      })
    );
  });

  it("does not reorder arrays during deep canonicalization", () => {
    expect(
      deepCanonicalizeStableJson([
        { id: "first", seatIndex: 0 },
        { id: "second", seatIndex: 1 },
      ])
    ).not.toBe(
      deepCanonicalizeStableJson([
        { id: "second", seatIndex: 1 },
        { id: "first", seatIndex: 0 },
      ])
    );
  });

  it("detects panelist order differences", () => {
    const expected = baseRoster();
    const mapped = mapSeminarRosterSourceToPrisma(
      baseRoster({
        panelists: [
          expected.panelists[1]!,
          expected.panelists[0]!,
        ],
      })
    );
    const actual: PrismaSeminarSessionRosterRecord = {
      eventId: mapped.eventId,
      seminarId: mapped.seminarId,
      moderator: mapped.moderator as PrismaSeminarSessionRosterRecord["moderator"],
      panelists: mapped.panelists as PrismaSeminarSessionRosterRecord["panelists"],
      topicBrief: mapped.topicBrief ?? null,
      notes: mapped.notes ?? null,
      updatedAt: mapped.updatedAt as Date,
    };

    const comparison = compareSeminarRosters(expected, actual);
    expect(comparison.panelistOrderMismatch).toBe(true);
    expect(comparison.exactMatch).toBe(false);
  });

  it("reports exact match for equivalent JSON and Prisma rows", () => {
    const roster = baseRoster();
    const mapped = mapSeminarRosterSourceToPrisma(roster);
    const dbRow: PrismaSeminarSessionRosterRecord = {
      eventId: mapped.eventId,
      seminarId: mapped.seminarId,
      moderator: mapped.moderator as PrismaSeminarSessionRosterRecord["moderator"],
      panelists: mapped.panelists as PrismaSeminarSessionRosterRecord["panelists"],
      topicBrief: mapped.topicBrief ?? null,
      notes: mapped.notes ?? null,
      updatedAt: mapped.updatedAt as Date,
    };

    const comparison = compareSeminarRosters(roster, dbRow);
    expect(comparison.exactMatch).toBe(true);
    expect(canonicalizeSeminarRosterForComparison(roster).updatedAt).toBe(
      canonicalizeSeminarRosterForComparison(dbRow).updatedAt
    );
  });

  it("builds import plan without mutating source order", () => {
    const rosters = [baseRoster()];
    const plan = buildSeminarRosterImportPlan(rosters);
    expect(plan).toHaveLength(1);
    expect((plan[0]!.panelists as Array<{ id: string }>)[0]?.id).toBe("panel-1");
  });

  it("deep canonicalizes speaker objects while preserving array order", () => {
    const canonical = deepCanonicalizeValue([
      { b: 1, a: 2, id: "panel-1" },
      { d: 3, c: 4, id: "panel-2" },
    ]);
    expect(canonical).toEqual([
      { a: 2, b: 1, id: "panel-1" },
      { c: 4, d: 3, id: "panel-2" },
    ]);
  });

  it("treats missing source topicBrief and database null as equivalent", () => {
    const roster = baseRoster();
    delete roster.topicBrief;

    const dbRow: PrismaSeminarSessionRosterRecord = {
      eventId: roster.eventId,
      seminarId: roster.seminarId,
      moderator: null,
      panelists: [],
      topicBrief: null,
      notes: roster.notes ?? null,
      updatedAt: new Date(roster.updatedAt),
    };

    const comparison = compareSeminarRosters(
      { ...roster, moderator: null, panelists: [] },
      dbRow
    );
    expect(comparison.fieldMismatches).not.toContain("topicBrief");
  });

  it("treats missing source notes and database null as equivalent", () => {
    const roster = baseRoster();
    delete roster.notes;

    const dbRow: PrismaSeminarSessionRosterRecord = {
      eventId: roster.eventId,
      seminarId: roster.seminarId,
      moderator: null,
      panelists: [],
      topicBrief: roster.topicBrief ?? null,
      notes: null,
      updatedAt: new Date(roster.updatedAt),
    };

    const comparison = compareSeminarRosters(
      { ...roster, moderator: null, panelists: [] },
      dbRow
    );
    expect(comparison.fieldMismatches).not.toContain("notes");
  });

  it("treats empty string topicBrief and database null as a mismatch", () => {
    const roster = baseRoster({ topicBrief: "", moderator: null, panelists: [] });

    const dbRow: PrismaSeminarSessionRosterRecord = {
      eventId: roster.eventId,
      seminarId: roster.seminarId,
      moderator: null,
      panelists: [],
      topicBrief: null,
      notes: roster.notes ?? null,
      updatedAt: new Date(roster.updatedAt),
    };

    const comparison = compareSeminarRosters(roster, dbRow);
    expect(comparison.fieldMismatches).toContain("topicBrief");
    expect(comparison.exactMatch).toBe(false);
  });

  it("treats empty string notes and database null as a mismatch", () => {
    const roster = baseRoster({ notes: "", moderator: null, panelists: [] });

    const dbRow: PrismaSeminarSessionRosterRecord = {
      eventId: roster.eventId,
      seminarId: roster.seminarId,
      moderator: null,
      panelists: [],
      topicBrief: roster.topicBrief ?? null,
      notes: null,
      updatedAt: new Date(roster.updatedAt),
    };

    const comparison = compareSeminarRosters(roster, dbRow);
    expect(comparison.fieldMismatches).toContain("notes");
    expect(comparison.exactMatch).toBe(false);
  });
});

describe("seminar roster import dry-run semantics", () => {
  it("import plan is deterministic and does not imply writes", () => {
    const plan = buildSeminarRosterImportPlan([baseRoster()]);
    expect(plan).toEqual(buildSeminarRosterImportPlan([baseRoster()]));
    expect(plan.length).toBe(1);
  });
});
