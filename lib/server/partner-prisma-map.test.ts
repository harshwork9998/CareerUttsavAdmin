import { Prisma } from "@/lib/generated/prisma/client";
import { describe, expect, it } from "vitest";

import { applyPartnerCredentialFields, toPublicPartner } from "@/lib/partner-credentials";
import {
  mapPrismaPartnerToApi,
  type PrismaPartnerRecord,
} from "@/lib/server/partner-prisma-map";
import type { Partner } from "@/types";

const SAMPLE_HASH =
  "scrypt$66c925ef5729e711f567edbdda4caeb0$d3a447bf5e224a2b2213ffab14a47deae48dec6d2cb0de76237243fd988595ad7c051e67eda505c5f393b7599b3817c686c9a78c8271bef1132a58d58c61b460";

function baseRecord(
  overrides: Partial<PrismaPartnerRecord> = {}
): PrismaPartnerRecord {
  return {
    id: "partner-001",
    name: "Christ University",
    city: "Bangalore",
    state: "Karnataka",
    stage: "Negotiation",
    primaryContact: {
      name: "Dr. Anitha Rao",
      designation: "Dean",
      phone: "9845011001",
      email: "anitha.rao@christuniversity.in",
    },
    secondaryContact: {
      name: "Rahul Menon",
      designation: "Manager",
      phone: "9845011002",
      email: "rahul.menon@christuniversity.in",
    },
    relationshipOrganization: "K2",
    relationshipManagerName: "Suresh Kulkarni",
    relationshipManagerPhone: "9886020001",
    relationshipManagerEmail: "suresh.kulkarni@k2group.in",
    relationshipSpocId: "udvqbmrts",
    stageRemarks: [],
    meetings: [],
    contactedAt: null,
    contactedNotes: null,
    meetingAt: null,
    meetingNotes: null,
    notProceedingAt: null,
    notProceedingReason: null,
    sponsorshipTier: "Knowledge Partner (Gold)",
    sponsorshipNotes: null,
    legacyDeliverables: null,
    deliverablesConfirmedAt: null,
    seminarSlotsConfirmedAt: null,
    totalAmount: null,
    discountAmount: null,
    netAmount: null,
    commercialsConfirmedAt: null,
    portalLogin: "anitha.rao@christuniversity.in",
    portalLoginNormalized: "anitha.rao@christuniversity.in",
    portalInviteEmail: "anitha.rao@christuniversity.in",
    portalInviteEmailNormalized: "anitha.rao@christuniversity.in",
    portalPasswordHash: SAMPLE_HASH,
    portalAuthVersion: 3,
    portalPasswordChangedAt: null,
    portalPasswordPromptSkippedAt: new Date("2026-08-18T07:01:20.660Z"),
    portalInviteSentAt: new Date("2026-07-10T10:00:00.000Z"),
    portalDocuments: null,
    portalFasciaName: null,
    portalWebsiteUrl: null,
    portalSmsContent: null,
    portalSeminarSpeakers: null,
    portalRepresentatives: null,
    createdAt: new Date("2026-06-01T10:00:00.000Z"),
    updatedAt: new Date("2026-08-18T07:01:27.875Z"),
    eventLinks: [{ partnerId: "partner-001", eventId: "evt-001" }],
    eventPartnerships: [
      {
        id: "pep-partner-001-evt-001",
        partnerId: "partner-001",
        eventId: "evt-001",
        sponsorshipTier: "Knowledge Partner (Gold)",
        customTierLabel: null,
        deliverables: [
          {
            id: "d1",
            key: "stallSize",
            label: "Stall",
            included: true,
          },
        ],
        seminarSlotCount: 2,
        seminarSlotAssignments: [
          {
            id: "pssa-partner-001-sem-001-a",
            partnershipId: "pep-partner-001-evt-001",
            seminarId: "sem-001-a",
            slots: 1,
            seminarTitle: "Stream selection",
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("partner prisma map", () => {
  it("reconstructs partner list/detail shape from normalized rows", () => {
    const partner = mapPrismaPartnerToApi(baseRecord());
    expect(partner.id).toBe("partner-001");
    expect(partner.eventIds).toEqual(["evt-001"]);
    expect(partner.relationshipOwner).toMatchObject({
      organization: "K2",
      spocId: "udvqbmrts",
      managerName: "Suresh Kulkarni",
    });
    expect(partner.eventPartnerships?.[0]?.eventId).toBe("evt-001");
    expect(partner.seminarSlotAssignments?.[0]).toMatchObject({
      eventId: "evt-001",
      seminarId: "sem-001-a",
      seminarTitle: "Stream selection",
    });
  });

  it("never exposes portalPasswordHash via PublicPartner", () => {
    const partner = mapPrismaPartnerToApi(baseRecord());
    const pub = toPublicPartner(partner);
    expect(pub).not.toHaveProperty("portalPasswordHash");
    expect(pub.hasPortalPassword).toBe(true);
  });

  it("preserves authVersion and portalPasswordPromptSkippedAt", () => {
    const partner = mapPrismaPartnerToApi(baseRecord());
    expect(partner.portalAuthVersion).toBe(3);
    expect(
      (partner as Partner & { portalPasswordPromptSkippedAt?: string })
        .portalPasswordPromptSkippedAt
    ).toBe("2026-08-18T07:01:20.660Z");
    expect(partner.portalPasswordHash).toBe(SAMPLE_HASH);
  });

  it("preserves credential bump rules equivalent to JSON behavior", () => {
    const existing = mapPrismaPartnerToApi(baseRecord());
    const patched = applyPartnerCredentialFields(existing, {
      portalFasciaName: "Updated fascia",
    });
    expect(patched.portalAuthVersion).toBe(3);

    const passwordChanged = applyPartnerCredentialFields(existing, {
      portalTempPassword: "new-password-123",
    });
    expect(passwordChanged.portalAuthVersion).toBe(4);
    expect(passwordChanged.portalTempPassword).toBeUndefined();
  });
});

describe("partner prisma map edge cases", () => {
  it("returns undefined optional collections when empty", () => {
    const partner = mapPrismaPartnerToApi(
      baseRecord({
        eventLinks: [],
        eventPartnerships: [],
        legacyDeliverables: null,
      })
    );
    expect(partner.eventIds).toEqual([]);
    expect(partner.eventPartnerships).toBeUndefined();
    expect(partner.seminarSlotAssignments).toBeUndefined();
    expect(partner.deliverables).toBeUndefined();
  });

  it("maps legacy deliverables from legacyDeliverables json", () => {
    const partner = mapPrismaPartnerToApi(
      baseRecord({
        legacyDeliverables: [
          { id: "d1", key: "weblink", label: "Weblink", included: true },
        ],
      })
    );
    expect(partner.deliverables?.[0]?.key).toBe("weblink");
  });
});
