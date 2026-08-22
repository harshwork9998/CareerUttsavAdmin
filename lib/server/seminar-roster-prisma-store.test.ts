import { Prisma } from "@/lib/generated/prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SeminarSessionRoster } from "@/types";

const EVENT_ID = "evt-001";
const SEMINAR_ID = "sem-001-a";

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
        seatIndex: 0,
        status: "Invited",
      },
    ],
    topicBrief: "Career pathways",
    notes: "Internal note",
    updatedAt: "2026-08-20T12:34:56.789Z",
    ...overrides,
  };
}

const {
  upsertMock,
  findManyMock,
} = vi.hoisted(() => ({
  upsertMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    seminarSessionRoster: {
      findMany: findManyMock,
      findUnique: vi.fn(),
      upsert: upsertMock,
      delete: vi.fn(),
    },
    $transaction: vi.fn(async (actions: Promise<unknown>[]) => {
      for (const action of actions) {
        await action;
      }
    }),
  },
}));

import {
  listPrismaSeminarRosters,
  upsertPrismaSeminarRoster,
} from "@/lib/server/seminar-roster-prisma-store";

describe("seminar roster prisma store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsertMock.mockImplementation(async (args: { create: Record<string, unknown> }) => ({
      ...args.create,
      updatedAt: new Date("2026-08-22T18:00:00.000Z"),
    }));
    findManyMock.mockResolvedValue([]);
  });

  it("maps moderator null to Prisma JsonNull", async () => {
    await upsertPrismaSeminarRoster(baseRoster({ moderator: null }));

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ moderator: Prisma.JsonNull }),
        update: expect.objectContaining({ moderator: Prisma.JsonNull }),
      })
    );
  });

  it("preserves topicBrief empty string", async () => {
    await upsertPrismaSeminarRoster(baseRoster({ topicBrief: "" }));

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ topicBrief: "" }),
        update: expect.objectContaining({ topicBrief: "" }),
      })
    );
  });

  it("preserves notes empty string", async () => {
    await upsertPrismaSeminarRoster(baseRoster({ notes: "" }));

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ notes: "" }),
        update: expect.objectContaining({ notes: "" }),
      })
    );
  });

  it("maps missing topicBrief to Prisma null", async () => {
    const roster = baseRoster();
    delete roster.topicBrief;
    await upsertPrismaSeminarRoster(roster);

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ topicBrief: null }),
        update: expect.objectContaining({ topicBrief: null }),
      })
    );
  });

  it("maps missing notes to Prisma null", async () => {
    const roster = baseRoster();
    delete roster.notes;
    await upsertPrismaSeminarRoster(roster);

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ notes: null }),
        update: expect.objectContaining({ notes: null }),
      })
    );
  });

  it("preserves panelist order on list mapping", async () => {
    findManyMock.mockResolvedValue([
      {
        eventId: EVENT_ID,
        seminarId: SEMINAR_ID,
        moderator: null,
        panelists: [
          { id: "panel-1", name: "A", organization: "Org", status: "Invited" },
          { id: "panel-2", name: "B", organization: "Org", status: "Tentative" },
        ],
        topicBrief: null,
        notes: null,
        updatedAt: new Date("2026-08-20T12:34:56.789Z"),
      },
    ]);

    const rows = await listPrismaSeminarRosters();
    expect(rows[0]?.panelists.map((panelist) => panelist.id)).toEqual([
      "panel-1",
      "panel-2",
    ]);
  });

  it("uses server-controlled updatedAt on upsert", async () => {
    const before = Date.now();
    await upsertPrismaSeminarRoster(
      baseRoster({ updatedAt: "2020-01-01T00:00:00.000Z" })
    );
    const after = Date.now();

    const upsertArgs = upsertMock.mock.calls[0]?.[0] as {
      create: { updatedAt: Date };
    };
    expect(upsertArgs.create.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(upsertArgs.create.updatedAt.getTime()).toBeLessThanOrEqual(after);
  });
});
