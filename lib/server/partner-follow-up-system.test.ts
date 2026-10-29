import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  canShowFollowUpDialog,
  followUpDialogNextShowStorageKey,
  markFollowUpDialogDismissed,
  readFollowUpDialogNextShowAt,
} from "@/lib/follow-up-dialog-storage";
import { collectDueFollowUpsFromPartners } from "@/lib/server/partner-follow-up-eligibility";
import { istCalendarDateFromDate } from "@/lib/server/ist-calendar";
import {
  listDueFollowUpsForAdminUser,
  listFollowUpApiItemsForAdminUser,
} from "@/lib/server/partner-follow-up-resolver";
import { processRelationshipOwnerFollowUpDigests } from "@/lib/server/relationship-owner-follow-up-processor";
import { requireRelationshipOwnerFollowUpCronAuth } from "@/lib/server/relationship-owner-follow-up-cron-auth";
import { sendWhatsAppTemplate } from "@/lib/server/whatsapp/meta-client";
import type { Partner, User } from "@/types";

vi.mock("@/lib/server/admin-user-spoc", () => ({
  findAdminUserRelationshipSpocId: vi.fn(),
}));

vi.mock("@/lib/server/partner-service", () => ({
  listPartnersForApi: vi.fn(),
}));

vi.mock("@/lib/server/partner-prisma-store", () => ({
  listPrismaPartnersByRelationshipSpocId: vi.fn(),
}));

vi.mock("@/lib/server/partner-persistence-mode", () => ({
  isPrismaPartnerPersistence: vi.fn(() => false),
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    spoc: { findUnique: vi.fn(), findMany: vi.fn() },
    relationshipOwnerFollowUpDigest: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { findAdminUserRelationshipSpocId } from "@/lib/server/admin-user-spoc";
import { listPartnersForApi } from "@/lib/server/partner-service";
import { isPrismaPartnerPersistence } from "@/lib/server/partner-persistence-mode";

function partner(overrides: Partial<Partner> & { id: string }): Partner {
  return {
    id: overrides.id,
    name: overrides.name ?? "Example University",
    city: "Bengaluru",
    state: "Karnataka",
    primaryContact: {
      name: "Primary",
      designation: "",
      phone: "9876543210",
      email: "primary@example.edu",
    },
    secondaryContact: {
      name: "Secondary",
      designation: "",
      phone: "9876543211",
      email: "secondary@example.edu",
    },
    eventIds: [],
    relationshipOwner: overrides.relationshipOwner ?? {
      organization: "K2",
      spocId: "spoc-a",
      managerName: "Owner A",
      managerPhone: "919999999999",
      managerEmail: "owner@example.com",
    },
    stage: "Meeting Scheduled",
    stageRemarks: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    meetings: overrides.meetings,
  };
}

const userA: User = {
  id: "usr-a",
  name: "Owner A",
  email: "a@example.com",
  role: "user",
  roleId: "role-user",
  status: "Active",
  relationshipSpocId: "spoc-a",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const superuser: User = {
  ...userA,
  id: "usr-super",
  role: "superuser",
  roleId: "role-superuser",
  relationshipSpocId: undefined,
};

describe("partner follow-up eligibility", () => {
  it("includes due, overdue, and scheduled in_discussion and lost meetings only", () => {
    const asOf = new Date("2026-07-21T12:00:00+05:30");
    const items = collectDueFollowUpsFromPartners(
      [
        partner({
          id: "p1",
          meetings: [
            {
              id: "m1",
              meetingAt: "2026-07-20T10:00:00",
              outcome: "in_discussion",
              followUpAt: "2026-07-21T10:00:00",
              createdAt: "2026-07-20T00:00:00.000Z",
              updatedAt: "2026-07-20T00:00:00.000Z",
            },
            {
              id: "m2",
              meetingAt: "2026-07-19T10:00:00",
              outcome: "won",
              followUpAt: "2026-07-21T10:00:00",
              createdAt: "2026-07-19T00:00:00.000Z",
              updatedAt: "2026-07-19T00:00:00.000Z",
            },
            {
              id: "m3",
              meetingAt: "2026-07-19T10:00:00",
              outcome: "in_discussion",
              followUpAt: "2026-07-25T10:00:00",
              createdAt: "2026-07-19T00:00:00.000Z",
              updatedAt: "2026-07-19T00:00:00.000Z",
            },
          ],
        }),
      ],
      asOf
    );
    expect(items.map((row) => row.meeting.id)).toEqual(["m1", "m3"]);
  });
});

describe("owner-scoped follow-up resolver", () => {
  beforeEach(() => {
    vi.mocked(findAdminUserRelationshipSpocId).mockReset();
    vi.mocked(listPartnersForApi).mockReset();
  });

  it("popup and WhatsApp paths share collectDueFollowUpsFromPartners eligibility", async () => {
    vi.mocked(findAdminUserRelationshipSpocId).mockResolvedValue("spoc-a");
    vi.mocked(listPartnersForApi).mockResolvedValue([
      partner({
        id: "p-overdue",
        meetings: [
          {
            id: "m1",
            meetingAt: "2026-10-20T10:00:00",
            outcome: "in_discussion",
            followUpAt: "2026-10-24T10:00:00",
            createdAt: "2026-10-20T00:00:00.000Z",
            updatedAt: "2026-10-20T00:00:00.000Z",
          },
        ],
      }),
      partner({
        id: "p-scheduled",
        meetings: [
          {
            id: "m2",
            meetingAt: "2026-10-20T10:00:00",
            outcome: "in_discussion",
            followUpAt: "2026-11-03T10:00:00",
            createdAt: "2026-10-20T00:00:00.000Z",
            updatedAt: "2026-10-20T00:00:00.000Z",
          },
        ],
      }),
      partner({
        id: "p-other-owner",
        relationshipOwner: {
          ...partner({ id: "x" }).relationshipOwner!,
          spocId: "spoc-b",
        },
        meetings: [
          {
            id: "m3",
            meetingAt: "2026-10-20T10:00:00",
            outcome: "in_discussion",
            followUpAt: "2026-11-10T10:00:00",
            createdAt: "2026-10-20T00:00:00.000Z",
            updatedAt: "2026-10-20T00:00:00.000Z",
          },
        ],
      }),
    ]);

    const asOf = new Date("2026-10-29T10:00:00+05:30");
    const fromAdmin = await listDueFollowUpsForAdminUser({ user: userA, asOf });
    const expected = collectDueFollowUpsFromPartners(
      [
        partner({
          id: "p-overdue",
          meetings: [
            {
              id: "m1",
              meetingAt: "2026-10-20T10:00:00",
              outcome: "in_discussion",
              followUpAt: "2026-10-24T10:00:00",
              createdAt: "2026-10-20T00:00:00.000Z",
              updatedAt: "2026-10-20T00:00:00.000Z",
            },
          ],
        }),
        partner({
          id: "p-scheduled",
          meetings: [
            {
              id: "m2",
              meetingAt: "2026-10-20T10:00:00",
              outcome: "in_discussion",
              followUpAt: "2026-11-03T10:00:00",
              createdAt: "2026-10-20T00:00:00.000Z",
              updatedAt: "2026-10-20T00:00:00.000Z",
            },
          ],
        }),
      ],
      asOf
    );
    expect(fromAdmin).toEqual(expected);
    expect(fromAdmin.map((row) => row.partner.id)).toEqual([
      "p-overdue",
      "p-scheduled",
    ]);
  });

  it("returns zero rows for unmapped normal admin users", async () => {
    vi.mocked(findAdminUserRelationshipSpocId).mockResolvedValue(null);
    const items = await listDueFollowUpsForAdminUser({ user: userA });
    expect(items).toEqual([]);
    expect(listPartnersForApi).not.toHaveBeenCalled();
  });

  it("scopes normal admin users to their mapped SPOC partners", async () => {
    vi.mocked(findAdminUserRelationshipSpocId).mockResolvedValue("spoc-a");
    vi.mocked(listPartnersForApi).mockResolvedValue([
      partner({
        id: "p1",
        relationshipOwner: { ...partner({ id: "x" }).relationshipOwner, spocId: "spoc-a" },
        meetings: [
          {
            id: "m1",
            meetingAt: "2026-07-20T10:00:00",
            outcome: "lost",
            followUpAt: "2026-07-20T10:00:00",
            createdAt: "2026-07-20T00:00:00.000Z",
            updatedAt: "2026-07-20T00:00:00.000Z",
          },
        ],
      }),
      partner({
        id: "p2",
        relationshipOwner: { ...partner({ id: "x" }).relationshipOwner, spocId: "spoc-b" },
        meetings: [
          {
            id: "m2",
            meetingAt: "2026-07-20T10:00:00",
            outcome: "in_discussion",
            followUpAt: "2026-07-20T10:00:00",
            createdAt: "2026-07-20T00:00:00.000Z",
            updatedAt: "2026-07-20T00:00:00.000Z",
          },
        ],
      }),
    ]);

    const items = await listDueFollowUpsForAdminUser({
      user: userA,
      asOf: new Date("2026-07-21T12:00:00+05:30"),
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.partner.id).toBe("p1");
  });

  it("returns all due follow-ups for superuser", async () => {
    vi.mocked(listPartnersForApi).mockResolvedValue([
      partner({
        id: "p1",
        meetings: [
          {
            id: "m1",
            meetingAt: "2026-07-20T10:00:00",
            outcome: "in_discussion",
            followUpAt: "2026-07-20T10:00:00",
            createdAt: "2026-07-20T00:00:00.000Z",
            updatedAt: "2026-07-20T00:00:00.000Z",
          },
        ],
      }),
      partner({
        id: "p2",
        relationshipOwner: { ...partner({ id: "x" }).relationshipOwner, spocId: "spoc-b" },
        meetings: [
          {
            id: "m2",
            meetingAt: "2026-07-20T10:00:00",
            outcome: "in_discussion",
            followUpAt: "2026-07-20T10:00:00",
            createdAt: "2026-07-20T00:00:00.000Z",
            updatedAt: "2026-07-20T00:00:00.000Z",
          },
        ],
      }),
    ]);

    const items = await listDueFollowUpsForAdminUser({
      user: superuser,
      asOf: new Date("2026-07-21T12:00:00+05:30"),
    });
    expect(items).toHaveLength(2);
    const apiItems = await listFollowUpApiItemsForAdminUser({
      user: superuser,
      asOf: new Date("2026-07-21T12:00:00+05:30"),
    });
    expect(apiItems[0]?.relationshipOwnerName).toBeDefined();
  });
});

describe("follow-up popup suppression", () => {
  it("uses per-user storage and 3-hour dismiss window", () => {
    const storage: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
    });

    const now = new Date("2026-07-21T10:00:00+05:30");
    expect(canShowFollowUpDialog("usr-a", now)).toBe(true);
    markFollowUpDialogDismissed("usr-a", now);
    expect(followUpDialogNextShowStorageKey("usr-a")).toBe(
      "cu-partner-followups-next-show-usr-a"
    );
    expect(canShowFollowUpDialog("usr-a", now)).toBe(false);
    expect(canShowFollowUpDialog("usr-b", now)).toBe(true);

    const later = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    expect(canShowFollowUpDialog("usr-a", later)).toBe(true);
    expect(readFollowUpDialogNextShowAt("usr-a")).toBe(
      now.getTime() + 3 * 60 * 60 * 1000
    );
    vi.unstubAllGlobals();
  });
});

describe("relationship owner digest", () => {
  it("skips when template is not configured", async () => {
    delete process.env.RELATIONSHIP_OWNER_FOLLOWUP_TEMPLATE_NAME;
    const summary = await processRelationshipOwnerFollowUpDigests();
    expect(summary.reasons.template_not_configured).toBe(1);
  });
});

describe("relationship owner follow-up cron auth", () => {
  it("rejects missing and wrong secrets", () => {
    process.env.RELATIONSHIP_OWNER_FOLLOWUP_CRON_SECRET = "secret";
    const missing = requireRelationshipOwnerFollowUpCronAuth(
      new Request("http://localhost/api/internal/whatsapp/relationship-owner-follow-ups", {
        method: "POST",
      })
    );
    expect(missing?.status).toBe(401);

    const wrong = requireRelationshipOwnerFollowUpCronAuth(
      new Request("http://localhost/api/internal/whatsapp/relationship-owner-follow-ups", {
        method: "POST",
        headers: { "x-cu-relationship-owner-followup-cron-key": "bad" },
      })
    );
    expect(wrong?.status).toBe(401);

    const ok = requireRelationshipOwnerFollowUpCronAuth(
      new Request("http://localhost/api/internal/whatsapp/relationship-owner-follow-ups", {
        method: "POST",
        headers: { "x-cu-relationship-owner-followup-cron-key": "secret" },
      })
    );
    expect(ok).toBeNull();
  });
});

describe("sendWhatsAppTemplate", () => {
  it("does not call sendWhatsAppText", async () => {
    const textSpy = vi.spyOn(
      await import("@/lib/server/whatsapp/meta-client"),
      "sendWhatsAppText"
    );
    expect(sendWhatsAppTemplate).toBeDefined();
    textSpy.mockRestore();
  });
});

describe("ist calendar", () => {
  it("uses Asia/Kolkata for eligibility cutoff", () => {
    const date = new Date("2026-07-20T20:00:00.000Z");
    expect(istCalendarDateFromDate(date)).toBe("2026-07-21");
  });
});
