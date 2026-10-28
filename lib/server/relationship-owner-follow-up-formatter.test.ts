import { describe, expect, it } from "vitest";

import {
  buildRelationshipOwnerFollowUpDigestPayload,
  buildRelationshipOwnerFollowUpDigestText,
  buildRelationshipOwnerFollowUpOverflowLine,
  buildRelationshipOwnerFollowUpTemplateBodyParameters,
  formatDigestContactLine,
  formatUniversityDigestEntry,
  formatUniversityFollowUpLine,
  RELATIONSHIP_OWNER_DIGEST_MAX_VISIBLE_FOLLOW_UPS,
  sanitizeMetaTemplateParameterText,
} from "@/lib/server/relationship-owner-follow-up-formatter";
import type { Partner, PartnerFollowUpItem } from "@/types";

function item(
  overrides: Partial<Partner> & {
    followUpAt: string;
    outcome?: "in_discussion" | "lost";
    followUpNotes?: string;
  }
): PartnerFollowUpItem {
  const partner: Partner = {
    id: overrides.id ?? "p1",
    name: overrides.name ?? "ABC University",
    city: "Bengaluru",
    state: "Karnataka",
    primaryContact: overrides.primaryContact ?? {
      name: "Rahul Sharma",
      designation: "",
      phone: "9876543210",
      email: "rahul@example.edu",
    },
    secondaryContact: {
      name: "Secondary",
      designation: "",
      phone: "9000000001",
      email: "sec@example.edu",
    },
    eventIds: [],
    relationshipOwner: {
      organization: "K2",
      spocId: "spoc-1",
      managerName: "Owner",
      managerPhone: "919999999999",
      managerEmail: "owner@example.com",
    },
    stage: "Meeting Scheduled",
    stageRemarks: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    meetings: overrides.meetings,
  };

  return {
    partner,
    meeting: {
      id: "m1",
      meetingAt: "2026-10-20T10:00:00",
      outcome: overrides.outcome ?? "in_discussion",
      followUpAt: overrides.followUpAt,
      followUpNotes: overrides.followUpNotes,
      lostReason: overrides.outcome === "lost" ? "Budget" : undefined,
      notes: "Internal meeting notes",
      createdAt: "2026-10-20T00:00:00.000Z",
      updatedAt: "2026-10-20T00:00:00.000Z",
    },
  };
}

function assertSingleLineMetaParameter(value: string): void {
  expect(value).not.toMatch(/\n/);
  expect(value).not.toMatch(/\r/);
  expect(value).not.toMatch(/\t/);
  expect(value).not.toContain("undefined");
  expect(value).not.toContain("null");
  expect(value).not.toContain("| |");
}

describe("relationship owner digest formatter", () => {
  const asOf = new Date("2026-10-24T10:00:00+05:30");

  it("formats a single follow-up line without static list numbering", () => {
    const payload = buildRelationshipOwnerFollowUpDigestPayload({
      ownerName: "Priya Owner",
      items: [item({ followUpAt: "2026-10-24T11:00:00" })],
      asOf,
    });

    expect(payload.ownerName).toBe("Priya Owner");
    expect(payload.followUpCount).toBe(1);
    expect(payload.visibleFollowUpCount).toBe(1);
    expect(payload.overflowCount).toBe(0);
    expect(payload.followUpLines).toEqual([
      "ABC University | Rahul Sharma | 9876543210 | Due today | 24 Oct 2026",
    ]);
    payload.followUpLines.forEach(assertSingleLineMetaParameter);
  });

  it("returns separate parameters for multiple follow-ups (max 5 visible)", () => {
    const items = Array.from({ length: 9 }, (_, index) =>
      item({
        id: `p-${index}`,
        name: `University ${index + 1}`,
        followUpAt: "2026-10-20T10:00:00",
      })
    );

    const payload = buildRelationshipOwnerFollowUpDigestPayload({
      ownerName: "Owner",
      items,
      asOf,
    });

    expect(payload.followUpCount).toBe(9);
    expect(payload.visibleFollowUpCount).toBe(5);
    expect(payload.overflowCount).toBe(4);
    expect(payload.followUpLines).toHaveLength(5);
    expect(payload.overflowLine).toBe(
      "+ 4 more follow-ups available in the Admin Portal"
    );

    const parameters = buildRelationshipOwnerFollowUpTemplateBodyParameters(
      payload
    );
    expect(parameters).toHaveLength(8);
    expect(parameters[1]?.text).toBe("9");
    parameters.forEach((row) => assertSingleLineMetaParameter(row.text));
  });

  it("uses singular overflow grammar for one extra follow-up", () => {
    expect(buildRelationshipOwnerFollowUpOverflowLine(1)).toBe(
      "+ 1 more follow-up available in the Admin Portal"
    );
    const payload = buildRelationshipOwnerFollowUpDigestPayload({
      ownerName: "Owner",
      items: Array.from({ length: 6 }, (_, index) =>
        item({ id: `p-${index}`, followUpAt: "2026-10-20T10:00:00" })
      ),
      asOf,
    });
    expect(payload.overflowCount).toBe(1);
    expect(payload.overflowLine).toBe(
      "+ 1 more follow-up available in the Admin Portal"
    );
  });

  it("handles missing contact name cleanly on one line", () => {
    const row = item({
      followUpAt: "2026-10-24T11:00:00",
      outcome: "lost",
      primaryContact: {
        name: "",
        designation: "",
        phone: "9988776655",
        email: "x@example.edu",
      },
    });
    const entry = formatUniversityFollowUpLine(row, "2026-10-24");
    expect(entry).toBe(
      "ABC University | 9988776655 | Re-engage | 24 Oct 2026"
    );
    assertSingleLineMetaParameter(entry);
  });

  it("handles missing phone cleanly", () => {
    const line = formatDigestContactLine("Priya Rao", "");
    expect(line).toBe("Priya Rao");

    const entry = formatUniversityDigestEntry(
      item({
        followUpAt: "2026-10-24T11:00:00",
        primaryContact: {
          name: "Priya Rao",
          designation: "",
          phone: "",
          email: "x@example.edu",
        },
      }),
      1,
      "2026-10-24"
    );
    expect(entry).toBe("ABC University | Priya Rao | Due today | 24 Oct 2026");
  });

  it("omits contact segments when both name and phone are missing", () => {
    const row = item({
      followUpAt: "2026-10-24T11:00:00",
      primaryContact: {
        name: "  ",
        designation: "",
        phone: "",
        email: "x@example.edu",
      },
    });
    const entry = formatUniversityFollowUpLine(row, "2026-10-24");
    expect(entry).toBe("ABC University | Due today | 24 Oct 2026");
  });

  it("caps visible follow-ups at five while keeping full total count", () => {
    const many = Array.from({ length: 20 }, (_, index) =>
      item({
        id: `p-${index}`,
        name: `University Number ${index + 1}`,
        followUpAt: "2026-10-20T10:00:00",
      })
    );

    const formatted = buildRelationshipOwnerFollowUpDigestText({
      ownerName: "Owner A",
      items: many,
      asOf,
    });

    expect(formatted.itemCount).toBe(20);
    expect(formatted.visibleFollowUpCount).toBe(
      RELATIONSHIP_OWNER_DIGEST_MAX_VISIBLE_FOLLOW_UPS
    );
    expect(formatted.overflowCount).toBe(15);
    expect(formatted.followUpLines).toHaveLength(5);
  });

  it("sanitizes embedded line breaks in defensive pass", () => {
    expect(sanitizeMetaTemplateParameterText("a\tb\nc\r\rd")).toBe("a b c d");
  });
});
