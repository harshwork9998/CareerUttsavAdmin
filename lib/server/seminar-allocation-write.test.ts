import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Event, Partner } from "@/types";

const partners: Partner[] = [];

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

import { listEventsForApi } from "@/lib/server/event-service";
import { updatePartnerForApi } from "@/lib/server/partner-service";
import { SEMINAR_FULL } from "@/lib/seminar-allocation";

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
      { eventId: "evt-001", deliverables: [], seminarSlotCount: 3 },
    ],
    seminarSlotAssignments: [],
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

const catalog = {
  id: "evt-001",
  seminars: [
    {
      id: "sem-a",
      title: "Design",
      date: null,
      startTime: null,
      endTime: null,
      hall: null,
      panelistSlots: 1,
    },
    {
      id: "sem-b",
      title: "Media",
      date: null,
      startTime: null,
      endTime: null,
      hall: null,
      panelistSlots: 2,
    },
    {
      id: "sem-c",
      title: "Law",
      date: null,
      startTime: null,
      endTime: null,
      hall: null,
      panelistSlots: 2,
    },
  ],
} as Event;

describe("partner seminar allocation writes", () => {
  beforeEach(() => {
    partners.splice(0, partners.length);
    delete process.env.PARTNER_PERSISTENCE;
    vi.mocked(listEventsForApi).mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      return [structuredClone(catalog)];
    });
  });

  it("does not let two partners take the last seat", async () => {
    partners.push(partner("partner-a"), partner("partner-b"));
    const assignment = {
      seminarSlotAssignments: [
        { eventId: "evt-001", seminarId: "sem-a", slots: 1 },
      ],
    };
    const [first, second] = await Promise.all([
      updatePartnerForApi("partner-a", assignment),
      updatePartnerForApi("partner-b", assignment),
    ]);
    const saved = [first, second].filter((result) => result.ok);
    const rejected = [first, second].filter((result) => !result.ok);
    expect(saved).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    if (!rejected[0] || rejected[0].ok) return;
    expect(rejected[0].status).toBe(409);
    expect(rejected[0].error).toBe(SEMINAR_FULL);
    const held = partners.flatMap((row) =>
      (row.seminarSlotAssignments ?? []).filter(
        (seat) => seat.seminarId === "sem-a" && seat.slots > 0
      )
    );
    expect(held).toHaveLength(1);
    expect(held.reduce((sum, seat) => sum + seat.slots, 0)).toBe(1);
  });

  it("counts a legacy stack when two partners race for the remaining seat", async () => {
    vi.mocked(listEventsForApi).mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      const event = structuredClone(catalog);
      const seminar = event.seminars?.find((row) => row.id === "sem-a");
      if (seminar) seminar.panelistSlots = 3;
      return [event];
    });
    partners.push(
      partner("legacy", {
        eventPartnerships: [
          { eventId: "evt-001", deliverables: [], seminarSlotCount: 1 },
        ],
        seminarSlotAssignments: [
          { eventId: "evt-001", seminarId: "sem-a", slots: 2 },
        ],
      }),
      partner("partner-a", {
        eventPartnerships: [
          { eventId: "evt-001", deliverables: [], seminarSlotCount: 1 },
        ],
      }),
      partner("partner-b", {
        eventPartnerships: [
          { eventId: "evt-001", deliverables: [], seminarSlotCount: 1 },
        ],
      })
    );
    const assignment = {
      seminarSlotAssignments: [
        { eventId: "evt-001", seminarId: "sem-a", slots: 1 },
      ],
    };
    const [first, second] = await Promise.all([
      updatePartnerForApi("partner-a", assignment),
      updatePartnerForApi("partner-b", assignment),
    ]);
    const saved = [first, second].filter((result) => result.ok);
    const rejected = [first, second].filter((result) => !result.ok);
    expect(saved).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    if (!rejected[0] || rejected[0].ok) return;
    expect(rejected[0].status).toBe(409);
    expect(rejected[0].error).toBe(SEMINAR_FULL);
    const seats = partners.flatMap((row) =>
      (row.seminarSlotAssignments ?? []).filter((seat) => seat.seminarId === "sem-a")
    );
    expect(seats.map((seat) => seat.slots).sort()).toEqual([1, 2]);
    expect(seats.reduce((sum, seat) => sum + seat.slots, 0)).toBe(3);
    expect(partners.find((row) => row.id === "legacy")?.seminarSlotAssignments).toEqual([
      { eventId: "evt-001", seminarId: "sem-a", slots: 2 },
    ]);
  });

  it("rejects a reduction below the selected topics and keeps every assignment", async () => {
    const existing = partner("partner-a", {
      seminarSlotsConfirmedAt: "2026-06-02T00:00:00.000Z",
      seminarSlotAssignments: [
        { eventId: "evt-001", seminarId: "sem-a", slots: 1 },
        { eventId: "evt-001", seminarId: "sem-b", slots: 1 },
        { eventId: "evt-001", seminarId: "sem-c", slots: 1 },
      ],
    });
    partners.push(structuredClone(existing));
    const result = await updatePartnerForApi("partner-a", {
      eventPartnerships: [
        { eventId: "evt-001", deliverables: [], seminarSlotCount: 2 },
      ],
      seminarSlotAssignments: existing.seminarSlotAssignments,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/before reducing the allocated seminar slots to 2/);
    expect(partners[0]?.seminarSlotAssignments).toEqual(existing.seminarSlotAssignments);
    expect(partners[0]?.eventPartnerships?.[0]?.seminarSlotCount).toBe(3);
    expect(partners[0]?.seminarSlotsConfirmedAt).toBe("2026-06-02T00:00:00.000Z");
  });

  it("keeps assignments and confirmation when the allocation increases", async () => {
    const existing = partner("partner-a", {
      eventPartnerships: [
        { eventId: "evt-001", deliverables: [], seminarSlotCount: 2 },
      ],
      seminarSlotsConfirmedAt: "2026-06-02T00:00:00.000Z",
      seminarSlotAssignments: [
        { eventId: "evt-001", seminarId: "sem-b", slots: 1 },
        { eventId: "evt-001", seminarId: "sem-c", slots: 1 },
      ],
    });
    partners.push(structuredClone(existing));
    const result = await updatePartnerForApi("partner-a", {
      eventPartnerships: [
        { eventId: "evt-001", deliverables: [], seminarSlotCount: 4 },
      ],
      seminarSlotAssignments: existing.seminarSlotAssignments,
      seminarSlotsConfirmedAt: undefined,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.partner.seminarSlotAssignments).toEqual([
      {
        eventId: "evt-001",
        seminarId: "sem-b",
        slots: 1,
        confirmedAt: "2026-06-02T00:00:00.000Z",
      },
      {
        eventId: "evt-001",
        seminarId: "sem-c",
        slots: 1,
        confirmedAt: "2026-06-02T00:00:00.000Z",
      },
    ]);
    expect(result.partner.eventPartnerships?.[0]?.seminarSlotCount).toBe(4);
    expect(result.partner.seminarSlotsConfirmedAt).toBe("2026-06-02T00:00:00.000Z");
  });

  it("does not normalize a legacy stacked assignment during an unrelated allocation save", async () => {
    const stacked = [
      { eventId: "evt-001", seminarId: "sem-b", slots: 2 },
    ];
    partners.push(
      partner("partner-a", {
        eventPartnerships: [
          { eventId: "evt-001", deliverables: [], seminarSlotCount: 2 },
        ],
        seminarSlotAssignments: stacked,
      })
    );
    const result = await updatePartnerForApi("partner-a", {
      seminarSlotAssignments: stacked.map((row) => ({ ...row })),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.partner.seminarSlotAssignments).toEqual([
      { eventId: "evt-001", seminarId: "sem-b", slots: 2, confirmedAt: null },
    ]);
  });

  it("keeps per-topic confirmation when an admin save omits it", async () => {
    partners.push(
      partner("partner-a", {
        seminarSlotsConfirmedAt: "2026-06-02T00:00:00.000Z",
        seminarSlotAssignments: [
          {
            eventId: "evt-001",
            seminarId: "sem-b",
            slots: 1,
            seminarTitle: "Media\u2060",
            confirmedAt: "2026-05-01T00:00:00.000Z",
          },
          {
            eventId: "evt-001",
            seminarId: "sem-c",
            slots: 1,
            seminarTitle: "Law",
            confirmedAt: "2026-05-02T00:00:00.000Z",
          },
        ],
      })
    );
    const result = await updatePartnerForApi("partner-a", {
      name: "Renamed college",
      seminarSlotAssignments: [
        { eventId: "evt-001", seminarId: "sem-c", slots: 1, seminarTitle: "Law" },
        { eventId: "evt-001", seminarId: "sem-b", slots: 1 },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.partner.name).toBe("Renamed college");
    expect(result.partner.seminarSlotsConfirmedAt).toBe("2026-06-02T00:00:00.000Z");
    expect(result.partner.seminarSlotAssignments).toEqual([
      {
        eventId: "evt-001",
        seminarId: "sem-c",
        slots: 1,
        seminarTitle: "Law",
        confirmedAt: "2026-05-02T00:00:00.000Z",
      },
      {
        eventId: "evt-001",
        seminarId: "sem-b",
        slots: 1,
        seminarTitle: "Media",
        confirmedAt: "2026-05-01T00:00:00.000Z",
      },
    ]);
  });
});
