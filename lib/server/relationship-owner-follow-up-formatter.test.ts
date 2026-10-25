import { describe, expect, it } from "vitest";

import {
  buildRelationshipOwnerFollowUpDigestText,
  formatDigestContactLine,
  formatUniversityDigestEntry,
  RELATIONSHIP_OWNER_DIGEST_MAX_BODY_CHARS,
  RELATIONSHIP_OWNER_DIGEST_UNIVERSITY_SEPARATOR,
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
  expect(value).not.toContain("  ");
}

describe("relationship owner digest formatter", () => {
  const asOf = new Date("2026-10-24T10:00:00+05:30");

  it("formats a single university on one line with pipes", () => {
    const formatted = buildRelationshipOwnerFollowUpDigestText({
      ownerName: "Priya Owner",
      items: [item({ followUpAt: "2026-10-24T11:00:00" })],
      asOf,
    });

    expect(formatted.ownerName).toBe("Priya Owner");
    expect(formatted.itemCount).toBe(1);
    expect(formatted.details).toBe(
      "1. ABC University | Rahul Sharma | 9876543210 | Due today | 24 Oct 2026"
    );
    assertSingleLineMetaParameter(formatted.details);
    expect(formatted.details).not.toContain("rahul@example");
    expect(formatted.details).not.toContain("Internal meeting notes");
  });

  it("joins multiple universities with the bullet separator", () => {
    const formatted = buildRelationshipOwnerFollowUpDigestText({
      ownerName: "Owner",
      items: [
        item({ id: "p1", name: "ABC University", followUpAt: "2026-10-20T10:00:00" }),
        item({
          id: "p2",
          name: "XYZ University",
          followUpAt: "2026-10-24T11:00:00",
          primaryContact: {
            name: "Priya Rao",
            designation: "",
            phone: "9988776655",
            email: "priya@example.edu",
          },
        }),
      ],
      asOf,
    });

    expect(formatted.details).toContain(
      "1. ABC University | Rahul Sharma | 9876543210 | Overdue | 20 Oct 2026"
    );
    expect(formatted.details).toContain(
      "2. XYZ University | Priya Rao | 9988776655 | Due today | 24 Oct 2026"
    );
    expect(formatted.details.split(RELATIONSHIP_OWNER_DIGEST_UNIVERSITY_SEPARATOR)).toHaveLength(
      2
    );
    assertSingleLineMetaParameter(formatted.details);
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
    const entry = formatUniversityDigestEntry(row, 1, "2026-10-24");
    expect(entry).toBe(
      "1. ABC University | 9988776655 | Re-engage | 24 Oct 2026"
    );
    expect(entry).not.toContain("undefined");
    expect(entry).not.toContain("| |");
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
    expect(entry).toBe("1. ABC University | Priya Rao | Due today | 24 Oct 2026");
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
    const entry = formatUniversityDigestEntry(row, 2, "2026-10-24");
    expect(entry).toBe("2. ABC University | Due today | 24 Oct 2026");
    expect(entry).not.toContain("| |");
  });

  it("keeps total count while truncating list with single-line overflow", () => {
    const many = Array.from({ length: 80 }, (_, index) =>
      item({
        id: `p-${index}`,
        name: `University Number ${index + 1} With A Long Name For Testing`,
        followUpAt: "2026-10-20T10:00:00",
        followUpNotes: "Should not appear",
      })
    );

    const formatted = buildRelationshipOwnerFollowUpDigestText({
      ownerName: "Owner A",
      items: many,
      asOf,
    });

    expect(formatted.itemCount).toBe(80);
    expect(formatted.details.length).toBeLessThanOrEqual(
      RELATIONSHIP_OWNER_DIGEST_MAX_BODY_CHARS
    );
    assertSingleLineMetaParameter(formatted.details);
    expect(formatted.overflowNote).toMatch(/\+\s+\d+\s+more follow-up/);
    expect(formatted.details).toContain(formatted.overflowNote);
    expect(formatted.details).toContain(
      `${RELATIONSHIP_OWNER_DIGEST_UNIVERSITY_SEPARATOR}${formatted.overflowNote}`
    );
    expect(formatted.details).not.toMatch(/\n/);
  });

  it("sanitizes embedded line breaks in defensive pass", () => {
    expect(sanitizeMetaTemplateParameterText("a\tb\nc\r\rd")).toBe("a b c d");
  });
});
