import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Event, Partner } from "@/types";

const partners: Partner[] = [];

vi.mock("@/lib/server/partner-communication-service", () => ({
  notifyConfirmedSeminarCommunications: vi.fn(async () => undefined),
}));

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
import { notifyConfirmedSeminarCommunications } from "@/lib/server/partner-communication-service";
import { savePartnerSeminarTopics } from "@/lib/server/seminar-topic-service";

const catalogue = {
  id: "evt-001",
  seminars: [
    {
      id: "sem-a",
      title: "Design",
      date: "2026-12-19",
      startTime: "10:00",
      endTime: "11:00",
      hall: 1,
      panelistSlots: 2,
    },
    {
      id: "sem-b",
      title: "Media",
      date: "2026-12-19",
      startTime: "12:00",
      endTime: "13:00",
      hall: 2,
      panelistSlots: 2,
    },
  ],
} as Event;

function partner(): Partner {
  return {
    id: "partner-a",
    name: "partner-a",
    city: "Bengaluru",
    state: "Karnataka",
    primaryContact: {
      name: "Ada",
      designation: "Dean",
      phone: "9845011001",
      email: "partner-a@example.com",
    },
    secondaryContact: {
      name: "Bo",
      designation: "Lead",
      phone: "9845011002",
      email: "partner-a.secondary@example.com",
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
  };
}

describe("partner confirm topics communication", () => {
  beforeEach(() => {
    partners.splice(0, partners.length, partner());
    delete process.env.PARTNER_PERSISTENCE;
    vi.mocked(listEventsForApi).mockResolvedValue([catalogue]);
    vi.mocked(notifyConfirmedSeminarCommunications).mockReset();
    vi.mocked(notifyConfirmedSeminarCommunications).mockResolvedValue(undefined);
  });

  it("does not send panel details for a partial save", async () => {
    const result = await savePartnerSeminarTopics("partner-a", {
      topics: [{ eventId: "evt-001", seminarId: "sem-a" }],
    });
    expect(result.ok).toBe(true);
    expect(notifyConfirmedSeminarCommunications).not.toHaveBeenCalled();
    expect(partners[0]?.seminarSlotAssignments?.[0]?.confirmedAt ?? null).toBeNull();
  });

  it("sends the current confirmed set after Confirm Topics and keeps it when email fails", async () => {
    const saved = await savePartnerSeminarTopics("partner-a", {
      confirm: true,
      topics: [
        { eventId: "evt-001", seminarId: "sem-a" },
        { eventId: "evt-001", seminarId: "sem-b" },
      ],
    });
    expect(saved.ok).toBe(true);
    expect(notifyConfirmedSeminarCommunications).toHaveBeenCalledTimes(1);
    const notified = vi.mocked(notifyConfirmedSeminarCommunications).mock.calls[0]?.[0];
    expect(notified?.seminarSlotAssignments?.map((row) => row.seminarId).sort()).toEqual([
      "sem-a",
      "sem-b",
    ]);
    expect(notified?.seminarSlotAssignments?.every((row) => row.confirmedAt)).toBe(true);

    vi.mocked(notifyConfirmedSeminarCommunications).mockRejectedValueOnce(
      new Error("mailbox unavailable")
    );
    partners.splice(0, partners.length, partner());
    const failed = await savePartnerSeminarTopics("partner-a", {
      confirm: true,
      topics: [
        { eventId: "evt-001", seminarId: "sem-a" },
        { eventId: "evt-001", seminarId: "sem-b" },
      ],
    });
    expect(failed.ok).toBe(true);
    if (!failed.ok) return;
    expect(failed.catalog.fullyConfirmed).toBe(true);
    expect(JSON.stringify(failed)).not.toContain("mailbox unavailable");
    expect(partners[0]?.seminarSlotAssignments?.every((row) => row.confirmedAt)).toBe(true);
  });
});
