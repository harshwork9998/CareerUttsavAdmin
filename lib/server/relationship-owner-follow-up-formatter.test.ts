import { describe, expect, it } from "vitest";

import {
  buildRelationshipOwnerFollowUpDigestText,
  formatDigestContactLine,
  formatUniversityDigestEntry,
  RELATIONSHIP_OWNER_DIGEST_MAX_BODY_CHARS,
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

describe("relationship owner digest formatter", () => {
  const asOf = new Date("2026-10-24T10:00:00+05:30");

  it("formats a single university with name, phone, status, and date", () => {
    const formatted = buildRelationshipOwnerFollowUpDigestText({
      ownerName: "Priya Owner",
      items: [item({ followUpAt: "2026-10-24T11:00:00" })],
      asOf,
    });

    expect(formatted.ownerName).toBe("Priya Owner");
    expect(formatted.itemCount).toBe(1);
    expect(formatted.details).toContain("1. ABC University");
    expect(formatted.details).toContain("Rahul Sharma | 9876543210");
    expect(formatted.details).toContain("Due today | 24 Oct 2026");
    expect(formatted.details).not.toContain("Good morning");
    expect(formatted.details).not.toContain("university follow-up(s) requiring attention");
    expect(formatted.details).not.toContain("Admin Portal.");
    expect(formatted.details).not.toContain("rahul@example");
    expect(formatted.details).not.toContain("Internal meeting notes");
    expect(formatted.details).not.toContain("Call back");
    expect(formatted.details).not.toContain("Bengaluru");
    expect(formatted.details).not.toContain("Meeting Scheduled");
  });

  it("handles missing contact name cleanly", () => {
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
    expect(entry).toContain("9988776655");
    expect(entry).not.toContain("undefined");
    expect(entry).not.toContain("| |");
    expect(entry).toContain("Re-engage | 24 Oct 2026");
  });

  it("handles missing phone cleanly", () => {
    const line = formatDigestContactLine("Priya Rao", "");
    expect(line).toBe("Priya Rao");
  });

  it("omits the contact line when both name and phone are missing", () => {
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
    const lines = entry.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("2. ABC University");
    expect(lines[1]).toContain("Due today | 24 Oct 2026");
  });

  it("keeps total count in itemCount while truncating list with overflow", () => {
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
    expect(formatted.overflowNote).toMatch(/\+\s+\d+\s+more follow-up/);

    const blocks = formatted.details.split(/\n\n(?=\d+\.|\+ )/);
    const overflowBlock = blocks.find((block) => block.startsWith("+ "));
    const universityBlocks = blocks.filter((block) => /^\d+\./.test(block));
    expect(universityBlocks.length).toBeGreaterThan(0);
    expect(universityBlocks.length).toBeLessThan(80);
    expect(overflowBlock).toBe(formatted.overflowNote);
    expect(formatted.overflowNote).toBe(
      `+ ${80 - universityBlocks.length} more follow-up(s) in the Admin Portal.`
    );

    for (const block of universityBlocks) {
      const lines = block.split("\n");
      expect(lines.length).toBeGreaterThanOrEqual(2);
      expect(lines[0]).toMatch(/^\d+\. /);
      expect(lines[lines.length - 1]).toMatch(
        /^(Overdue|Due today|Re-engage) \| \d{1,2} \w{3} \d{4}$/
      );
    }
  });
});
