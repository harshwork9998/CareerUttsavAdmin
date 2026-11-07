import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Event, Partner, SeminarSessionRoster } from "@/types";

const partners: Partner[] = [];
const rosters: SeminarSessionRoster[] = [];
let rosterWrites = 0;
let failRoster = false;

vi.mock("@/lib/server/partners-persistence", () => ({
  loadPartners: vi.fn(() => partners.map((partner) => structuredClone(partner))),
  savePartners: vi.fn((next: Partner[]) => {
    partners.splice(0, partners.length, ...next.map((partner) => structuredClone(partner)));
    return partners;
  }),
}));

vi.mock("@/lib/server/partner-prisma-store", () => ({
  listPrismaPartners: vi.fn(),
  getPrismaPartnerById: vi.fn(),
  findPrismaPartnersByPortalLogin: vi.fn(),
  createPrismaPartner: vi.fn(),
  updatePrismaPartner: vi.fn(),
  deletePrismaPartner: vi.fn(),
  prunePrismaPartnersForEventIds: vi.fn(),
}));

vi.mock("@/lib/server/event-service", () => ({
  listEventsForApi: vi.fn(),
}));

vi.mock("@/lib/server/events-persistence", () => ({
  loadEvents: vi.fn(),
}));

vi.mock("@/lib/server/partner-communication-service", () => ({
  notifyConfirmedSeminarCommunications: vi.fn(async () => undefined),
}));

vi.mock("@/lib/server/seminar-rosters-persistence", () => ({
  loadSeminarRosters: vi.fn(() => rosters.map((roster) => structuredClone(roster))),
  loadRawSeminarRosters: vi.fn(() => rosters.map((roster) => structuredClone(roster))),
  saveSeminarRosters: vi.fn((next: SeminarSessionRoster[]) => {
    rosters.splice(0, rosters.length, ...next);
    return rosters;
  }),
  upsertSeminarRoster: vi.fn((roster: SeminarSessionRoster) => {
    rosterWrites += 1;
    if (failRoster) throw new Error("roster down");
    const index = rosters.findIndex(
      (row) => row.eventId === roster.eventId && row.seminarId === roster.seminarId
    );
    if (index >= 0) rosters[index] = roster;
    else rosters.push(roster);
    return roster;
  }),
}));

import { notifyConfirmedSeminarCommunications } from "@/lib/server/partner-communication-service";
import { listEventsForApi } from "@/lib/server/event-service";
import { loadEvents } from "@/lib/server/events-persistence";
import {
  movePartnerSeminarForApi,
  removePartnerSeminarForApi,
} from "@/lib/server/seminar-admin-service";
import { SEMINAR_FULL } from "@/lib/seminar-allocation";
import { LEGACY_STACKED_ASSIGNMENT_MOVE } from "@/lib/seminar-admin";

function partner(id: string, overrides: Partial<Partner> = {}): Partner {
  return {
    id,
    name: id,
    city: "Bengaluru",
    state: "Karnataka",
    primaryContact: {
      name: "Ada",
      designation: "Dean",
      phone: "9845011001",
      email: `${id}@example.com`,
    },
    secondaryContact: {
      name: "Bo",
      designation: "Lead",
      phone: "9845011002",
      email: `${id}.secondary@example.com`,
    },
    eventIds: ["evt-001"],
    relationshipOwner: {
      organization: "K2",
      managerName: "Riya",
      managerPhone: "9886020001",
      managerEmail: "riya@example.com",
    },
    stage: "Confirmed",
    stageRemarks: [],
    eventPartnerships: [
      { eventId: "evt-001", deliverables: [], seminarSlotCount: 2 },
    ],
    seminarSlotAssignments: [],
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

const catalog = {
  id: "evt-001",
  title: "Bengaluru",
  city: "Bengaluru",
  seminars: [
    { id: "sem-a", title: "Design", date: null, startTime: null, endTime: null, hall: null, panelistSlots: 1 },
    { id: "sem-b", title: "Media", date: null, startTime: null, endTime: null, hall: null, panelistSlots: 1 },
  ],
} as Event;

describe("admin seminar assignment service", () => {
  beforeEach(() => {
    partners.splice(0, partners.length);
    rosters.splice(0, rosters.length);
    rosterWrites = 0;
    failRoster = false;
    delete process.env.PARTNER_PERSISTENCE;
    delete process.env.SEMINAR_ROSTER_PERSISTENCE;
    vi.mocked(notifyConfirmedSeminarCommunications).mockReset();
    vi.mocked(notifyConfirmedSeminarCommunications).mockResolvedValue(undefined);
    vi.mocked(listEventsForApi).mockResolvedValue([structuredClone(catalog)]);
    vi.mocked(loadEvents).mockReturnValue([structuredClone(catalog)]);
  });

  it("moves a confirmed topic, frees the source, and clears only the partner roster seat", async () => {
    partners.push(
      partner("partner-a", {
        seminarSlotsConfirmedAt: "2026-06-01T00:00:00.000Z",
        seminarSlotAssignments: [
          {
            eventId: "evt-001",
            seminarId: "sem-a",
            slots: 1,
            seminarTitle: "Design",
            confirmedAt: "2026-06-01T00:00:00.000Z",
          },
        ],
        portalSeminarSpeakers: [
          {
            eventId: "evt-001",
            seminarId: "sem-a",
            speakers: [{ name: "Ada" }],
            updatedAt: "2026-06-01T00:00:00.000Z",
          },
        ],
      })
    );
    rosters.push({
      eventId: "evt-001",
      seminarId: "sem-a",
      moderator: null,
      panelists: [
        {
          id: "partner-seat-partner-a-0",
          name: "Ada",
          organization: "partner-a",
          partnerId: "partner-a",
          status: "Invited",
        },
        {
          id: "manual-1",
          name: "Guest",
          organization: "Independent",
          status: "Confirmed",
        },
      ],
      updatedAt: "2026-06-01T00:00:00.000Z",
    });

    const result = await movePartnerSeminarForApi({
      partnerId: "partner-a",
      eventId: "evt-001",
      seminarId: "sem-a",
      destinationSeminarId: "sem-b",
      now: "2026-11-08T03:00:00.000Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.partner.seminarSlotAssignments).toEqual([
      expect.objectContaining({
        seminarId: "sem-b",
        slots: 1,
        confirmedAt: "2026-11-08T03:00:00.000Z",
      }),
    ]);
    expect(result.partner.seminarSlotsConfirmedAt).toBe("2026-11-08T03:00:00.000Z");
    expect(result.partner.portalSeminarSpeakers).toEqual([
      expect.objectContaining({ seminarId: "sem-a" }),
    ]);
    expect(rosters[0]?.panelists.map((row) => row.id)).toEqual(["manual-1"]);
    expect(notifyConfirmedSeminarCommunications).toHaveBeenCalledTimes(1);
    expect(notifyConfirmedSeminarCommunications).toHaveBeenCalledWith(
      expect.objectContaining({
        seminarSlotAssignments: [
          expect.objectContaining({ seminarId: "sem-b", confirmedAt: "2026-11-08T03:00:00.000Z" }),
        ],
      })
    );
  });

  it("leaves the source assignment when the destination is full or the roster write fails", async () => {
    partners.push(
      partner("other", {
        seminarSlotAssignments: [
          { eventId: "evt-001", seminarId: "sem-b", slots: 1 },
        ],
      }),
      partner("partner-a", {
        seminarSlotAssignments: [
          { eventId: "evt-001", seminarId: "sem-a", slots: 1, confirmedAt: null },
        ],
      })
    );
    const full = await movePartnerSeminarForApi({
      partnerId: "partner-a",
      eventId: "evt-001",
      seminarId: "sem-a",
      destinationSeminarId: "sem-b",
    });
    expect(full).toMatchObject({ ok: false, status: 409, error: SEMINAR_FULL });
    expect(partners.find((row) => row.id === "partner-a")?.seminarSlotAssignments).toEqual([
      expect.objectContaining({ seminarId: "sem-a" }),
    ]);

    partners.splice(0, partners.length, partner("partner-a", {
      seminarSlotAssignments: [
        { eventId: "evt-001", seminarId: "sem-a", slots: 1, confirmedAt: null },
      ],
    }));
    rosters.push({
      eventId: "evt-001",
      seminarId: "sem-a",
      moderator: null,
      panelists: [
        {
          id: "partner-seat-partner-a-0",
          name: "Ada",
          organization: "partner-a",
          partnerId: "partner-a",
          status: "Invited",
        },
      ],
      updatedAt: "2026-06-01T00:00:00.000Z",
    });
    failRoster = true;
    const failed = await movePartnerSeminarForApi({
      partnerId: "partner-a",
      eventId: "evt-001",
      seminarId: "sem-a",
      destinationSeminarId: "sem-b",
    });
    expect(failed.ok).toBe(false);
    expect(partners[0]?.seminarSlotAssignments).toEqual([
      expect.objectContaining({ seminarId: "sem-a", slots: 1 }),
    ]);
    expect(rosterWrites).toBeGreaterThan(0);
  });

  it("rejects a move of a legacy stacked assignment and keeps the source row", async () => {
    partners.push(
      partner("partner-a", {
        seminarSlotAssignments: [
          { eventId: "evt-001", seminarId: "sem-a", slots: 2, seminarTitle: "Design" },
        ],
      }),
      partner("other", {
        seminarSlotAssignments: [],
      })
    );
    const result = await movePartnerSeminarForApi({
      partnerId: "partner-a",
      eventId: "evt-001",
      seminarId: "sem-a",
      destinationSeminarId: "sem-b",
    });
    expect(result).toMatchObject({
      ok: false,
      status: 400,
      error: LEGACY_STACKED_ASSIGNMENT_MOVE,
    });
    if (result.ok) return;
    const stored = partners.find((row) => row.id === "partner-a");
    expect(stored?.seminarSlotAssignments).toEqual([
      expect.objectContaining({ seminarId: "sem-a", slots: 2 }),
    ]);
    expect(
      partners.some((row) =>
        (row.seminarSlotAssignments ?? []).some((seat) => seat.seminarId === "sem-b")
      )
    ).toBe(false);
    expect(rosterWrites).toBe(0);
  });

  it("removes an assignment without deleting speaker history", async () => {
    partners.push(
      partner("partner-a", {
        seminarSlotsConfirmedAt: "2026-06-01T00:00:00.000Z",
        seminarSlotAssignments: [
          {
            eventId: "evt-001",
            seminarId: "sem-a",
            slots: 1,
            confirmedAt: "2026-06-01T00:00:00.000Z",
          },
        ],
        portalSeminarSpeakers: [
          {
            eventId: "evt-001",
            seminarId: "sem-a",
            speakers: [{ name: "Ada" }],
            updatedAt: "2026-06-01T00:00:00.000Z",
          },
        ],
      })
    );
    const result = await removePartnerSeminarForApi({
      partnerId: "partner-a",
      eventId: "evt-001",
      seminarId: "sem-a",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.partner.seminarSlotAssignments).toEqual([]);
    expect(result.partner.portalSeminarSpeakers?.[0]?.speakers[0]?.name).toBe("Ada");
    expect(result.partner.seminarSlotsConfirmedAt).toBe("2026-06-01T00:00:00.000Z");
    expect(notifyConfirmedSeminarCommunications).not.toHaveBeenCalled();
  });

  it("does not send official panel details for an unconfirmed move", async () => {
    partners.push(
      partner("partner-a", {
        seminarSlotAssignments: [
          { eventId: "evt-001", seminarId: "sem-a", slots: 1, confirmedAt: null },
        ],
      })
    );
    const result = await movePartnerSeminarForApi({
      partnerId: "partner-a",
      eventId: "evt-001",
      seminarId: "sem-a",
      destinationSeminarId: "sem-b",
    });
    expect(result.ok).toBe(true);
    expect(notifyConfirmedSeminarCommunications).not.toHaveBeenCalled();
  });

  it("keeps a confirmed move when the follow-up email fails", async () => {
    vi.mocked(notifyConfirmedSeminarCommunications).mockRejectedValueOnce(
      new Error("mailbox unavailable")
    );
    partners.push(
      partner("partner-a", {
        seminarSlotsConfirmedAt: "2026-06-01T00:00:00.000Z",
        seminarSlotAssignments: [
          {
            eventId: "evt-001",
            seminarId: "sem-a",
            slots: 1,
            confirmedAt: "2026-06-01T00:00:00.000Z",
          },
        ],
      })
    );
    const result = await movePartnerSeminarForApi({
      partnerId: "partner-a",
      eventId: "evt-001",
      seminarId: "sem-a",
      destinationSeminarId: "sem-b",
      now: "2026-11-08T03:00:00.000Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.partner.seminarSlotAssignments).toEqual([
      expect.objectContaining({
        seminarId: "sem-b",
        confirmedAt: "2026-11-08T03:00:00.000Z",
      }),
    ]);
  });
});
