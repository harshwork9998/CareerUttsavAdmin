import { describe, expect, it } from "vitest";

import {
  isAdCreativeApplicable,
  partnerPortalSubmissionEntitlements,
  partnershipSubmissionEntitlements,
} from "@/lib/portal-entitlements";
import type { PartnerDeliverable } from "@/types";

function deliverable(
  key: string,
  included: boolean,
  option?: string
): PartnerDeliverable {
  return { id: key, key, label: key, included, option, isCustom: false };
}

describe("portal entitlements", () => {
  it("always requires logo, fascia, and website", () => {
    const entitlements = partnershipSubmissionEntitlements({
      eventId: "evt-001",
      deliverables: [],
      representativeSlotCount: 0,
      sessions: [],
      portalFasciaName: "",
      portalWebsiteUrl: "",
      documents: [],
    });
    expect(entitlements.logo.applicable).toBe(true);
    expect(entitlements.fascia_name.applicable).toBe(true);
    expect(entitlements.website_link.applicable).toBe(true);
    expect(entitlements.logo.complete).toBe(false);
  });

  it("maps advertisement creative to all advertisement deliverables", () => {
    expect(
      isAdCreativeApplicable([deliverable("bookAdCareersAfterPlus2", true, "full page")])
    ).toBe(true);
    expect(isAdCreativeApplicable([deliverable("eventSouvenirAd", true)])).toBe(true);
    expect(
      isAdCreativeApplicable([deliverable("bookAdPremiumSpot", true, "back cover")])
    ).toBe(true);
    expect(isAdCreativeApplicable([deliverable("weblink", true)])).toBe(false);
  });

  it("requires the full allocated representative count", () => {
    const partial = partnershipSubmissionEntitlements({
      eventId: "evt-001",
      deliverables: [],
      representativeSlotCount: 2,
      sessions: [],
      representatives: [
        {
          eventId: "evt-001",
          count: 1,
          representatives: [
            { name: "Asha", designation: "Leadership / Management", phone: "9876543210" },
          ],
          updatedAt: "2026-11-01T00:00:00.000Z",
        },
      ],
    });
    expect(partial.representatives.applicable).toBe(true);
    expect(partial.representatives.complete).toBe(false);

    const complete = partnershipSubmissionEntitlements({
      eventId: "evt-001",
      deliverables: [],
      representativeSlotCount: 2,
      sessions: [],
      representatives: [
        {
          eventId: "evt-001",
          count: 2,
          representatives: [
            { name: "Asha", designation: "Leadership / Management", phone: "9876543210" },
            { name: "Ravi", designation: "Speaker", phone: "9876543211" },
          ],
          updatedAt: "2026-11-02T00:00:00.000Z",
        },
      ],
    });
    expect(complete.representatives.complete).toBe(true);
  });

  it("hides representatives when slot count is zero", () => {
    const entitlements = partnershipSubmissionEntitlements({
      eventId: "evt-001",
      deliverables: [],
      representativeSlotCount: 0,
      sessions: [],
    });
    expect(entitlements.representatives.applicable).toBe(false);
  });

  it("only applies speaker details to current assignments", () => {
    const entitlements = partnershipSubmissionEntitlements({
      eventId: "evt-001",
      deliverables: [],
      representativeSlotCount: 0,
      seminarSlotCount: 2,
      assignments: [{ eventId: "evt-001", seminarId: "sem-b", slots: 1, confirmedAt: null }],
      sessions: [
        {
          eventId: "evt-001",
          seminarId: "sem-b",
          topic: "Media",
          dateLabel: null,
          timeLabel: null,
          hallLabel: null,
        },
      ],
      speakers: [
        {
          eventId: "evt-001",
          seminarId: "sem-a",
          updatedAt: "2026-11-01T00:00:00.000Z",
          speakers: [
            {
              name: "Asha",
              designation: "Dean",
              contact: "9876543210",
              introduction: "Leads outreach.",
              photoUrl: "https://example.com/photo.png",
            },
          ],
        },
      ],
    });
    expect(entitlements.speaker_details.applicable).toBe(true);
    expect(entitlements.speaker_details.complete).toBe(false);
  });

  it("merges partner-level entitlements across event partnerships", () => {
    const entitlements = partnerPortalSubmissionEntitlements({
      partnerships: [
        {
          eventId: "evt-001",
          deliverables: [deliverable("fullPageWriteup", true)],
          representativeSlotCount: 0,
          seminarSlotCount: 0,
        },
        {
          eventId: "evt-002",
          deliverables: [deliverable("smsMailerCampaign", true)],
          representativeSlotCount: 0,
          seminarSlotCount: 0,
        },
      ],
      sessions: [],
      portalFasciaName: "Example U",
      portalWebsiteUrl: "https://example.edu",
      documents: [{ kind: "logo" }],
    });
    expect(entitlements.souvenir_writeup.applicable).toBe(true);
    expect(entitlements.sms_content.applicable).toBe(true);
    expect(entitlements.ad_creative.applicable).toBe(false);
    expect(entitlements.representatives.applicable).toBe(false);
    expect(entitlements.logo.complete).toBe(true);
  });
});
