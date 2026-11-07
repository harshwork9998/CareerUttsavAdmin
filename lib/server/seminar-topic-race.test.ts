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
import {
  getPartnerSeminarTopicCatalog,
  savePartnerSeminarTopics,
} from "@/lib/server/seminar-topic-service";
import { SEMINAR_FULL } from "@/lib/seminar-allocation";

function partner(id: string): Partner {
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
      { eventId: "evt-001", deliverables: [], seminarSlotCount: 1 },
    ],
    seminarSlotAssignments: [],
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  };
}

describe("partner seminar topic races", () => {
  beforeEach(() => {
    partners.splice(0, partners.length);
    delete process.env.PARTNER_PERSISTENCE;
    vi.mocked(listEventsForApi).mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      return [
        {
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
          ],
        } as Event,
      ];
    });
  });

  it("gives one partner the last seat and a controlled full response to the other", async () => {
    partners.push(partner("partner-a"), partner("partner-b"));
    const body = {
      topics: [{ eventId: "evt-001", seminarId: "sem-a" }],
      confirm: false,
    };
    const [first, second] = await Promise.all([
      savePartnerSeminarTopics("partner-a", body),
      savePartnerSeminarTopics("partner-b", body),
    ]);
    const saved = [first, second].filter((result) => result.ok);
    const rejected = [first, second].filter((result) => !result.ok);
    expect(saved).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    if (!rejected[0] || rejected[0].ok) return;
    expect(rejected[0].status).toBe(409);
    expect(rejected[0].error).toBe(SEMINAR_FULL);
    if (!saved[0] || !saved[0].ok) return;
    expect(
      partners.flatMap((row) =>
        (row.seminarSlotAssignments ?? []).map((seat) => ({
          id: row.id,
          seminarId: seat.seminarId,
          slots: seat.slots,
        }))
      )
    ).toEqual([{ id: saved[0] === first ? "partner-a" : "partner-b", seminarId: "sem-a", slots: 1 }]);
    const visible = saved[0].catalog.events.flatMap((group) => group.topics);
    expect(visible.some((topic) => topic.seminarId === "sem-a" && topic.selected)).toBe(
      true
    );
    const loserId = rejected[0] === first ? "partner-a" : "partner-b";
    const refreshed = await getPartnerSeminarTopicCatalog(loserId);
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) return;
    expect(
      refreshed.catalog.events.flatMap((group) =>
        group.topics.filter((topic) => topic.seminarId === "sem-a")
      )
    ).toEqual([]);
  });
});
