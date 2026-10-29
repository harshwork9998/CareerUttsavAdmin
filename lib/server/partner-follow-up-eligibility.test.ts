import { describe, expect, it } from "vitest";

import {
  buildRelationshipOwnerFollowUpDigestPayload,
  buildRelationshipOwnerFollowUpTemplateBodyParameters,
} from "@/lib/server/relationship-owner-follow-up-formatter";
import {
  collectDueFollowUpsFromPartners,
  followUpUrgency,
  followUpUrgencyDisplayLabel,
  sortPartnerFollowUpItems,
} from "@/lib/server/partner-follow-up-eligibility";
import type { Partner, PartnerFollowUpItem } from "@/types";

const AS_OF = new Date("2026-10-29T10:00:00+05:30");
const AS_OF_IST = "2026-10-29";

function meeting(
  id: string,
  followUpAt: string,
  outcome: "in_discussion" | "lost" | "won" = "in_discussion"
) {
  return {
    id,
    meetingAt: "2026-10-20T10:00:00",
    outcome,
    followUpAt,
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
  };
}

function partner(id: string, meetings: Partner["meetings"]): Partner {
  return {
    id,
    name: `University ${id}`,
    city: "Bengaluru",
    state: "Karnataka",
    primaryContact: {
      name: "Rahul Sharma",
      designation: "",
      phone: "9901128865",
      email: "rahul@example.edu",
    },
    secondaryContact: {
      name: "",
      designation: "",
      phone: "",
      email: "",
    },
    eventIds: [],
    relationshipOwner: {
      organization: "K2 Learning",
      spocId: "spoc-a",
      managerName: "Owner",
      managerPhone: "9876543210",
      managerEmail: "owner@example.com",
    },
    stage: "Meeting Scheduled",
    stageRemarks: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    meetings,
  };
}

describe("follow-up eligibility", () => {
  it("includes past follow-ups as Overdue", () => {
    expect(
      followUpUrgency("2026-10-24T11:00:00", AS_OF_IST, "in_discussion")
    ).toBe("overdue");
  });

  it("includes today's follow-up as Due today", () => {
    expect(
      followUpUrgency("2026-10-29T11:00:00", AS_OF_IST, "in_discussion")
    ).toBe("due_today");
  });

  it("includes tomorrow as Scheduled", () => {
    expect(
      followUpUrgency("2026-10-30T11:00:00", AS_OF_IST, "in_discussion")
    ).toBe("scheduled");
  });

  it("includes future follow-ups weeks away", () => {
    const items = collectDueFollowUpsFromPartners(
      [partner("p-future", [meeting("m1", "2026-11-15T10:00:00")])],
      AS_OF
    );
    expect(items).toHaveLength(1);
    expect(
      followUpUrgency(items[0]!.meeting.followUpAt!, AS_OF_IST, "in_discussion")
    ).toBe("scheduled");
  });

  it("does not filter out future follow-ups", () => {
    const items = collectDueFollowUpsFromPartners(
      [
        partner("p1", [meeting("m1", "2026-10-24T10:00:00")]),
        partner("p2", [meeting("m2", "2026-11-03T10:00:00")]),
      ],
      AS_OF
    );
    expect(items.map((row) => row.partner.id)).toEqual(["p1", "p2"]);
  });

  it("excludes partners without followUpAt", () => {
    const items = collectDueFollowUpsFromPartners(
      [
        partner("p1", [
          {
            id: "m1",
            meetingAt: "2026-10-20T10:00:00",
            outcome: "in_discussion",
            createdAt: "2026-10-20T00:00:00.000Z",
            updatedAt: "2026-10-20T00:00:00.000Z",
          },
        ]),
      ],
      AS_OF
    );
    expect(items).toHaveLength(0);
  });

  it("excludes Won meetings", () => {
    const items = collectDueFollowUpsFromPartners(
      [partner("p1", [meeting("m1", "2026-11-03T10:00:00", "won")])],
      AS_OF
    );
    expect(items).toHaveLength(0);
  });

  it("keeps Re-engage behavior for lost follow-ups due today", () => {
    expect(
      followUpUrgency("2026-10-29T10:00:00", AS_OF_IST, "lost")
    ).toBe("re_engage");
    expect(followUpUrgencyDisplayLabel("re_engage")).toBe("Re-engage");
  });

  it("sorts overdue, then due today, then scheduled with stable tie-breakers", () => {
    const items: PartnerFollowUpItem[] = [
      {
        partner: partner("p-sched-far", [meeting("m1", "2026-11-20T10:00:00")]),
        meeting: meeting("m1", "2026-11-20T10:00:00"),
      },
      {
        partner: partner("p-overdue-new", [meeting("m2", "2026-10-28T10:00:00")]),
        meeting: meeting("m2", "2026-10-28T10:00:00"),
      },
      {
        partner: partner("p-sched-near", [meeting("m3", "2026-11-03T10:00:00")]),
        meeting: meeting("m3", "2026-11-03T10:00:00"),
      },
      {
        partner: partner("p-overdue-old", [meeting("m4", "2026-10-24T10:00:00")]),
        meeting: meeting("m4", "2026-10-24T10:00:00"),
      },
      {
        partner: partner("p-today", [meeting("m5", "2026-10-29T10:00:00")]),
        meeting: meeting("m5", "2026-10-29T10:00:00"),
      },
    ];

    const sorted = sortPartnerFollowUpItems(items, AS_OF);
    expect(sorted.map((row) => row.partner.id)).toEqual([
      "p-overdue-old",
      "p-overdue-new",
      "p-today",
      "p-sched-near",
      "p-sched-far",
    ]);
  });

  it("sorts upcoming scheduled items nearest date first", () => {
    const items: PartnerFollowUpItem[] = [
      {
        partner: partner("p-b", [meeting("m1", "2026-11-10T10:00:00")]),
        meeting: meeting("m1", "2026-11-10T10:00:00"),
      },
      {
        partner: partner("p-a", [meeting("m2", "2026-11-01T10:00:00")]),
        meeting: meeting("m2", "2026-11-01T10:00:00"),
      },
    ];
    const sorted = sortPartnerFollowUpItems(items, AS_OF);
    expect(sorted.map((row) => row.partner.id)).toEqual(["p-a", "p-b"]);
  });
});

describe("popup and WhatsApp shared resolver", () => {
  it("feeds WhatsApp digest from the same collected follow-up items", () => {
    const items = collectDueFollowUpsFromPartners(
      [
        partner("p1", [meeting("m1", "2026-10-24T10:00:00")]),
        partner("p2", [meeting("m2", "2026-10-29T10:00:00")]),
        ...Array.from({ length: 4 }, (_, index) =>
          partner(`p-f-${index}`, [
            meeting(`m-f-${index}`, `2026-11-0${index + 1}T10:00:00`),
          ])
        ),
      ],
      AS_OF
    );

    const payload = buildRelationshipOwnerFollowUpDigestPayload({
      ownerName: "Owner",
      items,
      asOf: AS_OF,
    });

    expect(payload.followUpCount).toBe(6);
    expect(payload.visibleFollowUpCount).toBe(5);
    expect(payload.overflowCount).toBe(1);

    const scheduledLine = payload.followUpLines.find((line) =>
      line.includes("Scheduled")
    );
    expect(scheduledLine).toMatch(
      /University p-f-\d \| Rahul Sharma \| 9901128865 \| Scheduled \| \d{1,2} Nov 2026/
    );

    const parameters = buildRelationshipOwnerFollowUpTemplateBodyParameters(payload);
    expect(parameters[1]?.text).toBe("6");
    expect(JSON.stringify(parameters)).not.toMatch(/\\n|\\r|\\t/);
  });

  it("formats WhatsApp line with Scheduled status for future follow-ups", () => {
    const items = collectDueFollowUpsFromPartners(
      [partner("p1", [meeting("m1", "2026-11-03T10:00:00")])],
      AS_OF
    );
    const payload = buildRelationshipOwnerFollowUpDigestPayload({
      ownerName: "Owner",
      items,
      asOf: AS_OF,
    });
    expect(payload.followUpLines[0]).toBe(
      "University p1 | Rahul Sharma | 9901128865 | Scheduled | 3 Nov 2026"
    );
  });
});
