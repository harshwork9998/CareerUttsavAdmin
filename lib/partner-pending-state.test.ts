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
