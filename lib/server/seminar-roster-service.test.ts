import { Prisma } from "@/lib/generated/prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Event, SeminarSessionRoster } from "@/types";

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

function eventCatalog(): Event[] {
  return [
    {
      id: EVENT_ID,
      title: "Career Uttsav Bengaluru 2026",
      slug: "career-uttsav-bengaluru-2026",
      description: "Desc",
      status: "Published",
      venue: "Palace Grounds",
      address: "Bellary Road",
      city: "Bangalore",
      state: "Karnataka",
      pincode: "560052",
      startDate: "2026-08-15",
      endDate: "2026-08-16",
      startTime: "09:00",
      endTime: "18:00",
      hallCount: 3,
      seminars: [
        {
          id: SEMINAR_ID,
          title: "Engineering Careers",
          date: "2026-08-15",
          startTime: "10:00",
          endTime: "11:00",
          panelistSlots: 4,
          hall: 1,
        },
      ],
      registrationDeadline: "2026-08-10T23:59:59+05:30",
      maxCapacity: 15000,
      registrationCount: 8429,
      checkInCount: 0,
      isFeatured: true,
      tags: [],
      createdBy: "usr-001",
      createdAt: "2025-11-01T10:00:00+05:30",
      updatedAt: "2026-06-20T14:30:00+05:30",
    },
  ];
}

function prismaRosterRecord(
  overrides: Partial<{
    eventId: string;
    seminarId: string;
    moderator: Prisma.JsonValue | null;
    panelists: Prisma.JsonValue;
    topicBrief: string | null;
    notes: string | null;
    updatedAt: Date;
  }> = {}
) {
  const roster = baseRoster();
  return {
    eventId: EVENT_ID,
    seminarId: SEMINAR_ID,
    moderator: roster.moderator,
    panelists: roster.panelists,
    topicBrief: roster.topicBrief ?? null,
    notes: roster.notes ?? null,
    updatedAt: new Date("2026-08-20T12:34:56.789Z"),
    ...overrides,
  };
}

vi.mock("@/lib/server/events-persistence", () => ({
  loadEvents: vi.fn(),
}));

vi.mock("@/lib/server/seminar-rosters-persistence", () => ({
  loadSeminarRosters: vi.fn(),
  loadRawSeminarRosters: vi.fn(),
  saveSeminarRosters: vi.fn((rosters: SeminarSessionRoster[]) => rosters),
  upsertSeminarRoster: vi.fn((roster: SeminarSessionRoster) => ({
    ...roster,
    updatedAt: "2026-08-22T18:00:00.000Z",
  })),
}));

vi.mock("@/lib/server/seminar-roster-prisma-store", () => ({
  listPrismaSeminarRosters: vi.fn(),
  getPrismaSeminarRoster: vi.fn(),
  upsertPrismaSeminarRoster: vi.fn(),
  prunePrismaSeminarRostersForEventCatalog: vi.fn(),
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    seminar: {
      findUnique: vi.fn(),
    },
    event: {
      findUnique: vi.fn(),
    },
  },
}));

import { loadEvents } from "@/lib/server/events-persistence";
import { prisma } from "@/lib/server/prisma";
import {
  getPrismaSeminarRoster,
  listPrismaSeminarRosters,
  prunePrismaSeminarRostersForEventCatalog,
  upsertPrismaSeminarRoster,
} from "@/lib/server/seminar-roster-prisma-store";
import {
  listSeminarRostersForApi,
  pruneSeminarRostersForEventCatalog,
  upsertSeminarRosterForApi,
  validateSeminarSessionForRoster,
} from "@/lib/server/seminar-roster-service";
import {
  loadRawSeminarRosters,
  loadSeminarRosters,
  saveSeminarRosters,
  upsertSeminarRoster,
} from "@/lib/server/seminar-rosters-persistence";

describe("seminar roster service json mode", () => {
  const original = process.env.SEMINAR_ROSTER_PERSISTENCE;

  beforeEach(() => {
    delete process.env.SEMINAR_ROSTER_PERSISTENCE;
    vi.mocked(loadEvents).mockReturnValue(eventCatalog());
    vi.mocked(loadSeminarRosters).mockReturnValue([baseRoster()]);
    vi.mocked(loadRawSeminarRosters).mockReturnValue([baseRoster()]);
    vi.mocked(getPrismaSeminarRoster).mockResolvedValue(null);
    vi.mocked(listPrismaSeminarRosters).mockResolvedValue([]);
    vi.mocked(upsertPrismaSeminarRoster).mockResolvedValue(baseRoster());
    vi.mocked(prunePrismaSeminarRostersForEventCatalog).mockResolvedValue();
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.SEMINAR_ROSTER_PERSISTENCE;
    } else {
      process.env.SEMINAR_ROSTER_PERSISTENCE = original;
    }
    vi.clearAllMocks();
  });

  it("selects JSON backend for list", async () => {
    const rows = await listSeminarRostersForApi();
    expect(rows).toHaveLength(1);
    expect(loadSeminarRosters).toHaveBeenCalledTimes(1);
    expect(listPrismaSeminarRosters).not.toHaveBeenCalled();
  });

  it("does not write Prisma in JSON mode", async () => {
    const result = await upsertSeminarRosterForApi(baseRoster());
    expect(result.ok).toBe(true);
    expect(upsertSeminarRoster).toHaveBeenCalledTimes(1);
    expect(upsertPrismaSeminarRoster).not.toHaveBeenCalled();
  });

  it("uses JSON event catalog for validation", async () => {
    const result = await validateSeminarSessionForRoster(EVENT_ID, SEMINAR_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.panelistSlots).toBe(4);
    }
    expect(loadEvents).toHaveBeenCalledTimes(1);
    expect(prisma.seminar.findUnique).not.toHaveBeenCalled();
  });

  it("rejects nonexistent seminar in JSON mode", async () => {
    const result = await validateSeminarSessionForRoster(EVENT_ID, "missing");
    expect(result.ok).toBe(false);
  });

  it("prunes JSON rosters on event catalog changes", async () => {
    vi.mocked(loadRawSeminarRosters).mockReturnValue([
      baseRoster(),
      baseRoster({ eventId: "evt-999", seminarId: "sem-999" }),
    ]);

    await pruneSeminarRostersForEventCatalog(eventCatalog());

    expect(saveSeminarRosters).toHaveBeenCalledWith([baseRoster()]);
    expect(prunePrismaSeminarRostersForEventCatalog).not.toHaveBeenCalled();
  });

  it("preserves API response contract in JSON mode", async () => {
    const result = await upsertSeminarRosterForApi(baseRoster());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.roster).toMatchObject({
        eventId: EVENT_ID,
        seminarId: SEMINAR_ID,
        moderator: expect.objectContaining({ id: "mod-1" }),
        panelists: expect.arrayContaining([
          expect.objectContaining({ id: "panel-1" }),
          expect.objectContaining({ id: "panel-2" }),
        ]),
        updatedAt: expect.any(String),
      });
    }
  });
});

describe("seminar roster service prisma mode", () => {
  const original = process.env.SEMINAR_ROSTER_PERSISTENCE;

  beforeEach(() => {
    process.env.SEMINAR_ROSTER_PERSISTENCE = "prisma";
    vi.mocked(loadEvents).mockImplementation(() => {
      throw new Error("events-store.json must not be read in prisma roster mode");
    });
    vi.mocked(prisma.seminar.findUnique).mockResolvedValue({
      id: SEMINAR_ID,
      eventId: EVENT_ID,
      panelistSlots: 4,
    } as Awaited<ReturnType<typeof prisma.seminar.findUnique>>);
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      id: EVENT_ID,
    } as Awaited<ReturnType<typeof prisma.event.findUnique>>);
    vi.mocked(listPrismaSeminarRosters).mockResolvedValue([
      {
        ...baseRoster(),
        updatedAt: "2026-08-20T12:34:56.789Z",
      },
    ]);
    vi.mocked(getPrismaSeminarRoster).mockResolvedValue(null);
    vi.mocked(upsertPrismaSeminarRoster).mockImplementation(async (roster) => ({
      ...roster,
      updatedAt: "2026-08-22T18:00:00.000Z",
    }));
    vi.mocked(prunePrismaSeminarRostersForEventCatalog).mockResolvedValue();
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.SEMINAR_ROSTER_PERSISTENCE;
    } else {
      process.env.SEMINAR_ROSTER_PERSISTENCE = original;
    }
    vi.clearAllMocks();
  });

  it("selects Prisma backend for list", async () => {
    const rows = await listSeminarRostersForApi();
    expect(rows).toHaveLength(1);
    expect(listPrismaSeminarRosters).toHaveBeenCalledTimes(1);
    expect(loadSeminarRosters).not.toHaveBeenCalled();
  });

  it("maps moderator correctly from Prisma list results", async () => {
    const rows = await listSeminarRostersForApi();
    expect(rows[0]?.moderator).toEqual(
      expect.objectContaining({ id: "mod-1", status: "Confirmed" })
    );
  });

  it("preserves panelist order from Prisma list results", async () => {
    const rows = await listSeminarRostersForApi();
    expect(rows[0]?.panelists.map((panelist) => panelist.id)).toEqual([
      "panel-1",
      "panel-2",
    ]);
  });

  it("does not write JSON in Prisma mode", async () => {
    const result = await upsertSeminarRosterForApi(baseRoster());
    expect(result.ok).toBe(true);
    expect(upsertPrismaSeminarRoster).toHaveBeenCalledTimes(1);
    expect(upsertSeminarRoster).not.toHaveBeenCalled();
    expect(saveSeminarRosters).not.toHaveBeenCalled();
  });

  it("replaces full roster on Prisma upsert", async () => {
    await upsertSeminarRosterForApi(
      baseRoster({
        panelists: [baseRoster().panelists[1]!],
        moderator: null,
      })
    );

    expect(upsertPrismaSeminarRoster).toHaveBeenCalledWith(
      expect.objectContaining({
        moderator: null,
        panelists: [expect.objectContaining({ id: "panel-2" })],
      })
    );
  });

  it("uses Prisma Event/Seminar catalog for validation", async () => {
    const result = await validateSeminarSessionForRoster(EVENT_ID, SEMINAR_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.panelistSlots).toBe(4);
    }
    expect(prisma.seminar.findUnique).toHaveBeenCalledWith({
      where: { id: SEMINAR_ID },
      select: { id: true, eventId: true, panelistSlots: true },
    });
    expect(prisma.event.findUnique).toHaveBeenCalledWith({
      where: { id: EVENT_ID },
      select: { id: true },
    });
    expect(loadEvents).not.toHaveBeenCalled();
  });

  it("rejects event/seminar mismatch in Prisma mode", async () => {
    vi.mocked(prisma.seminar.findUnique).mockResolvedValue({
      id: SEMINAR_ID,
      eventId: "evt-other",
      panelistSlots: 4,
    } as Awaited<ReturnType<typeof prisma.seminar.findUnique>>);

    const result = await validateSeminarSessionForRoster(EVENT_ID, SEMINAR_ID);
    expect(result.ok).toBe(false);
  });

  it("rejects nonexistent seminar in Prisma mode", async () => {
    vi.mocked(prisma.seminar.findUnique).mockResolvedValue(null);

    const result = await validateSeminarSessionForRoster(EVENT_ID, SEMINAR_ID);
    expect(result.ok).toBe(false);
  });

  it("uses server-controlled updatedAt on Prisma upsert", async () => {
    const result = await upsertSeminarRosterForApi(
      baseRoster({ updatedAt: "2020-01-01T00:00:00.000Z" })
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.roster.updatedAt).toBe("2026-08-22T18:00:00.000Z");
    }
  });

  it("prunes Prisma rosters on event catalog changes", async () => {
    await pruneSeminarRostersForEventCatalog(eventCatalog());
    expect(prunePrismaSeminarRostersForEventCatalog).toHaveBeenCalledWith(
      eventCatalog()
    );
    expect(saveSeminarRosters).not.toHaveBeenCalled();
  });

  it("preserves moderator null on Prisma upsert", async () => {
    await upsertSeminarRosterForApi(baseRoster({ moderator: null }));
    expect(upsertPrismaSeminarRoster).toHaveBeenCalledWith(
      expect.objectContaining({ moderator: null })
    );
  });
});
