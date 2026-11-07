import { describe, expect, it } from "vitest";

import {
  isPartnerSpeakerComplete,
  pendingItemsForPartnership,
  readinessLinesForPartnership,
  type PendingPartnershipInput,
} from "@/lib/partner-pending-state";
import type { PartnerDeliverable } from "@/types";

function deliverable(
  key: string,
  included: boolean,
  option?: string,
  isCustom = false
): PartnerDeliverable {
  return { id: key, key, label: key, included, option, isCustom };
}

function input(
  overrides: Partial<PendingPartnershipInput> = {}
): PendingPartnershipInput {
  return {
    eventId: "evt-001",
    deliverables: [],
    representativeSlotCount: 0,
    sessions: [],
    documents: [],
    speakers: [],
    representatives: [],
    ...overrides,
  };
}

const completeSpeaker = {
  name: "Asha Rao",
  designation: "Dean",
  contact: "9876543210",
  introduction: "Leads student outreach.",
  photoUrl: "https://example.com/asha.png",
};

describe("partner pending state", () => {
  it("excludes items that are not included in the partnership", () => {
    const pending = pendingItemsForPartnership(
      input({
        deliverables: [
          deliverable("stallSize", false, "6 (3x2)"),
          deliverable("weblink", false),
          deliverable("smsMailerCampaign", false),
          deliverable("fullPageWriteup", false),
          deliverable("bookAdCareersAfterPlus2", false, "full page"),
        ],
        portalFasciaName: "",
        portalWebsiteUrl: "",
        portalSmsContent: "",
      })
    );
    expect(pending.map((item) => item.key)).toEqual([]);
  });

  it("does not treat an optional LinkedIn profile as a pending speaker field", () => {
    expect(isPartnerSpeakerComplete({ ...completeSpeaker, linkedinProfile: "" })).toBe(
      true
    );
    const pending = pendingItemsForPartnership(
      input({
        sessions: [
          {
            eventId: "evt-001",
            seminarId: "sem-001",
            topic: "Design careers",
            dateLabel: null,
            timeLabel: null,
            hallLabel: null,
          },
        ],
        speakers: [
          {
            eventId: "evt-001",
            seminarId: "sem-001",
            updatedAt: "2026-11-01T00:00:00.000Z",
            speakers: [{ ...completeSpeaker, linkedinProfile: "" }],
          },
        ],
      })
    );
    expect(pending.some((item) => item.section === "speakers")).toBe(false);
  });

  it("does not mark Panel Discussion pending when nothing is allocated", () => {
    const pending = pendingItemsForPartnership(input());
    expect(pending.some((item) => /panel discussion/i.test(item.label))).toBe(false);
    expect(pending.some((item) => item.section === "speakers")).toBe(false);
    expect(
      readinessLinesForPartnership(input()).find(
        (line) => line.label === "Panel Discussion"
      )?.status
    ).toBe("Not Applicable");
  });

  it("marks speaker details pending when a Panel Discussion is allocated and incomplete", () => {
    const pending = pendingItemsForPartnership(
      input({
        sessions: [
          {
            eventId: "evt-001",
            seminarId: "sem-001",
            topic: "Design careers",
            dateLabel: null,
            timeLabel: null,
            hallLabel: null,
          },
        ],
        speakers: [
          {
            eventId: "evt-001",
            seminarId: "sem-001",
            updatedAt: "2026-11-01T00:00:00.000Z",
            speakers: [{ ...completeSpeaker, photoUrl: "" }],
          },
        ],
      })
    );
    expect(pending.map((item) => item.label)).toEqual([
      "Speaker details — Design careers",
    ]);
  });

  it("requires Careers After +2 artwork only when a full or half page is included", () => {
    const missing = pendingItemsForPartnership(
      input({
        deliverables: [deliverable("bookAdCareersAfterPlus2", true, "half page")],
      })
    );
    expect(missing.map((item) => item.key)).toContain("ad_creative");

    const filled = pendingItemsForPartnership(
      input({
        deliverables: [deliverable("bookAdCareersAfterPlus2", true, "full page")],
        documents: [{ kind: "ad_creative" }],
      })
    );
    expect(filled.map((item) => item.key)).not.toContain("ad_creative");

    const notApplicable = pendingItemsForPartnership(
      input({
        deliverables: [deliverable("bookAdCareersAfterPlus2", false, "full page")],
      })
    );
    expect(notApplicable.map((item) => item.key)).not.toContain("ad_creative");
  });

  it("treats one valid representative as complete and zero representatives as pending", () => {
    const none = pendingItemsForPartnership(
      input({
        representativeSlotCount: 5,
        representatives: [
          {
            eventId: "evt-001",
            count: 0,
            representatives: [],
            updatedAt: "2026-11-01T00:00:00.000Z",
          },
        ],
      })
    );
    expect(none.map((item) => item.key)).toContain("representatives:evt-001");

    const one = pendingItemsForPartnership(
      input({
        representativeSlotCount: 5,
        representatives: [
          {
            eventId: "evt-001",
            count: 1,
            representatives: [
              { name: "Ravi", designation: "Lead", phone: "9876543211" },
            ],
            updatedAt: "2026-11-02T00:00:00.000Z",
          },
        ],
      })
    );
    expect(one.map((item) => item.key)).not.toContain("representatives:evt-001");
  });

  it("marks SMS content pending only when that deliverable applies and is empty", () => {
    const missing = pendingItemsForPartnership(
      input({
        deliverables: [deliverable("smsMailerCampaign", true)],
        portalSmsContent: "   ",
      })
    );
    expect(missing.map((item) => item.key)).toContain("sms_content");

    const done = pendingItemsForPartnership(
      input({
        deliverables: [deliverable("smsMailerCampaign", true)],
        portalSmsContent: "Join Career Uttsav.",
      })
    );
    expect(done.map((item) => item.key)).not.toContain("sms_content");

    const skipped = pendingItemsForPartnership(
      input({
        deliverables: [deliverable("custom", true, undefined, true)],
        portalSmsContent: "",
      })
    );
    expect(skipped).toEqual([]);
  });

  it("drops a submission from the pending list once it is complete", () => {
    const base = {
      deliverables: [deliverable("logoB2C", true), deliverable("weblink", true)],
      portalWebsiteUrl: "",
    };
    const missing = pendingItemsForPartnership(input(base));
    expect(missing.map((item) => item.key)).toEqual(["website_link", "logo"]);
    const saved = pendingItemsForPartnership(
      input({
        ...base,
        portalWebsiteUrl: "https://example.edu",
        documents: [{ kind: "logo" }],
      })
    );
    expect(saved).toEqual([]);
  });
});

function seminarInput(input: {
  allocated: number;
  assignments?: PendingPartnershipInput["assignments"];
  sessions?: PendingPartnershipInput["sessions"];
  speakers?: PendingPartnershipInput["speakers"];
}): PendingPartnershipInput {
  return {
    eventId: "evt-001",
    deliverables: [],
    representativeSlotCount: 0,
    seminarSlotCount: input.allocated,
    assignments: input.assignments ?? [],
    sessions: input.sessions ?? [],
    documents: [],
    speakers: input.speakers ?? [],
    representatives: [],
  };
}

function assignment(
  seminarId: string,
  confirmedAt: string | null
): NonNullable<PendingPartnershipInput["assignments"]>[number] {
  return { eventId: "evt-001", seminarId, slots: 1, confirmedAt };
}

function session(seminarId: string, topic: string): PendingPartnershipInput["sessions"][number] {
  return {
    eventId: "evt-001",
    seminarId,
    topic,
    dateLabel: null,
    timeLabel: null,
    hallLabel: null,
  };
}

describe("seminar topic pending actions and readiness", () => {
  it("adds no topic-selection item when nothing is allocated", () => {
    const pending = pendingItemsForPartnership(seminarInput({ allocated: 0 }));
    expect(pending.some((item) => item.section === "topics")).toBe(false);
    expect(readinessLinesForPartnership(seminarInput({ allocated: 0 }))).toEqual(
      expect.arrayContaining([
        { label: "Panel Discussion", status: "Not Applicable" },
        { label: "Speaker details", status: "Not Applicable" },
      ])
    );
  });

  it("asks the partner to select topics while the allocation is open", () => {
    const none = pendingItemsForPartnership(seminarInput({ allocated: 3 }));
    expect(none.map((item) => item.label)).toContain(
      "Select Panel Discussion topics (0 of 3 selected)"
    );
    const partial = pendingItemsForPartnership(
      seminarInput({
        allocated: 3,
        assignments: [assignment("sem-a", null), assignment("sem-b", null)],
        sessions: [session("sem-a", "Design"), session("sem-b", "Media")],
      })
    );
    expect(partial.map((item) => item.label)).toContain(
      "Select Panel Discussion topics (2 of 3 selected)"
    );
    expect(
      readinessLinesForPartnership(
        seminarInput({ allocated: 3, assignments: [assignment("sem-a", null)] })
      ).find((line) => line.label === "Panel Discussion")?.status
    ).toBe("Pending");
  });

  it("asks for confirmation when every allocated topic is selected but not confirmed", () => {
    const pending = pendingItemsForPartnership(
      seminarInput({
        allocated: 3,
        assignments: [
          assignment("sem-a", null),
          assignment("sem-b", null),
          assignment("sem-c", null),
        ],
      })
    );
    expect(pending.map((item) => item.label)).toContain("Confirm Panel Discussion topics");
    expect(pending.some((item) => item.label.startsWith("Select Panel Discussion"))).toBe(
      false
    );
    expect(
      readinessLinesForPartnership(
        seminarInput({
          allocated: 3,
          assignments: [
            assignment("sem-a", null),
            assignment("sem-b", null),
            assignment("sem-c", null),
          ],
        })
      ).find((line) => line.label === "Panel Discussion")?.status
    ).toBe("Pending Confirmation");
  });

  it("clears the topic item only after every current selection is confirmed", () => {
    const pending = pendingItemsForPartnership(
      seminarInput({
        allocated: 3,
        assignments: [
          assignment("sem-a", "2026-11-08T00:00:00.000Z"),
          assignment("sem-b", "2026-11-08T00:00:00.000Z"),
          assignment("sem-c", "2026-11-08T00:00:00.000Z"),
        ],
        sessions: [
          session("sem-a", "Design"),
          session("sem-b", "Media"),
          session("sem-c", "Law"),
        ],
        speakers: [
          {
            eventId: "evt-001",
            seminarId: "sem-a",
            updatedAt: "2026-11-08T00:00:00.000Z",
            speakers: [completeSpeaker],
          },
          {
            eventId: "evt-001",
            seminarId: "sem-b",
            updatedAt: "2026-11-08T00:00:00.000Z",
            speakers: [completeSpeaker],
          },
          {
            eventId: "evt-001",
            seminarId: "sem-c",
            updatedAt: "2026-11-08T00:00:00.000Z",
            speakers: [completeSpeaker],
          },
        ],
      })
    );
    expect(pending.some((item) => item.section === "topics")).toBe(false);
    expect(pending.some((item) => item.section === "speakers")).toBe(false);
    expect(
      readinessLinesForPartnership(
        seminarInput({
          allocated: 3,
          assignments: [
            assignment("sem-a", "2026-11-08T00:00:00.000Z"),
            assignment("sem-b", "2026-11-08T00:00:00.000Z"),
            assignment("sem-c", "2026-11-08T00:00:00.000Z"),
          ],
          sessions: [session("sem-a", "Design")],
        })
      ).find((line) => line.label === "Panel Discussion")?.status
    ).toBe("Confirmed");
  });

  it("does not let a historical speaker satisfy the current seminar", () => {
    const pending = pendingItemsForPartnership(
      seminarInput({
        allocated: 1,
        assignments: [assignment("sem-b", "2026-11-08T00:00:00.000Z")],
        sessions: [session("sem-b", "Media")],
        speakers: [
          {
            eventId: "evt-001",
            seminarId: "sem-a",
            updatedAt: "2026-11-01T00:00:00.000Z",
            speakers: [completeSpeaker],
          },
        ],
      })
    );
    expect(pending.map((item) => item.label)).toContain("Speaker details — Media");
    expect(pending.some((item) => item.key === "speaker:evt-001:sem-a")).toBe(false);
  });

  it("reopens topic selection and readiness after a confirmed topic is removed", () => {
    const removed = seminarInput({ allocated: 2, assignments: [assignment("sem-a", "2026-11-08T00:00:00.000Z")] });
    const pending = pendingItemsForPartnership(removed);
    expect(pending.map((item) => item.label)).toContain(
      "Select Panel Discussion topics (1 of 2 selected)"
    );
    expect(
      readinessLinesForPartnership(removed).find((line) => line.label === "Panel Discussion")
        ?.status
    ).toBe("Pending");
  });
});
