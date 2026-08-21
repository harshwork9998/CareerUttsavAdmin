import { describe, expect, it } from "vitest";

import {
  buildPartnerImportPlan,
  detectPortalLoginCollisions,
  mapPartnerSourceToPrisma,
  mapPartnerSeminarSlotAssignments,
  mapSpocSourceToPrisma,
  normalizeEmail,
  normalizePortalLogin,
  partnershipId,
  resolveSpocOrganization,
  validatePartnerSources,
} from "@/lib/server/partner-prisma-import-map";
import type { Partner } from "@/types";

const SAMPLE_HASH =
  "scrypt$66c925ef5729e711f567edbdda4caeb0$d3a447bf5e224a2b2213ffab14a47deae48dec6d2cb0de76237243fd988595ad7c051e67eda505c5f393b7599b3817c686c9a78c8271bef1132a58d58c61b460";

function basePartner(overrides: Partial<Partner> = {}): Partner {
  return {
    id: "partner-001",
    name: "Christ University",
    city: "Bangalore",
    state: "Karnataka",
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
    eventIds: ["evt-001"],
    relationshipOwner: {
      organization: "K2",
      spocId: "udvqbmrts",
      managerName: "Suresh Kulkarni",
      managerPhone: "9886020001",
      managerEmail: "suresh.kulkarni@k2group.in",
    },
    stage: "Negotiation",
    stageRemarks: [],
    eventPartnerships: [
      {
        eventId: "evt-001",
        sponsorshipTier: "Knowledge Partner (Gold)",
        deliverables: [{ id: "d1", key: "stallSize", label: "Stall", included: true }],
        seminarSlotCount: 2,
      },
    ],
    seminarSlotAssignments: [
      {
        eventId: "evt-001",
        seminarId: "sem-001-a",
        slots: 1,
        seminarTitle: "Stream selection",
      },
    ],
    portalLogin: "Anitha.Rao@ChristUniversity.in",
    portalInviteEmail: "anitha.rao@christuniversity.in",
    portalPasswordHash: SAMPLE_HASH,
    portalAuthVersion: 3,
    portalPasswordChangedAt: "2026-08-18T07:00:00.000Z",
    createdAt: "2026-06-01T10:00:00+05:30",
    updatedAt: "2026-08-18T07:01:27.875Z",
    ...overrides,
  } as Partner & { portalPasswordPromptSkippedAt?: string };
}

describe("partner prisma import map", () => {
  it("copies password hash and authVersion exactly", () => {
    const partner = {
      ...basePartner({
        portalInviteSentAt: "2026-07-10T10:00:00+05:30",
      }),
      portalPasswordPromptSkippedAt: "2026-08-18T07:01:20.660Z",
    } as Partner & { portalPasswordPromptSkippedAt?: string };

    const mapped = mapPartnerSourceToPrisma(partner);
    expect(mapped.portalPasswordHash).toBe(SAMPLE_HASH);
    expect(mapped.portalAuthVersion).toBe(3);
    expect(mapped.portalPasswordChangedAt).toEqual(
      new Date("2026-08-18T07:00:00.000Z")
    );
    expect(mapped.portalPasswordPromptSkippedAt).toEqual(
      new Date("2026-08-18T07:01:20.660Z")
    );
  });

  it("normalizes portal login and invite email fields", () => {
    const mapped = mapPartnerSourceToPrisma(basePartner());
    expect(normalizePortalLogin("Anitha.Rao@ChristUniversity.in")).toBe(
      "anitha.rao@christuniversity.in"
    );
    expect(mapped.portalLoginNormalized).toBe("anitha.rao@christuniversity.in");
    expect(mapped.portalInviteEmailNormalized).toBe(
      "anitha.rao@christuniversity.in"
    );
  });

  it("uses SPOC organization fallback of em dash", () => {
    expect(resolveSpocOrganization(undefined)).toBe("—");
    expect(resolveSpocOrganization("  ")).toBe("—");
    expect(
      mapSpocSourceToPrisma({
        id: "spoc-1",
        name: "Meera Joshi",
        phone: "9886130001",
        email: "meera.joshi@iesedu.in",
        createdAt: "2026-08-06T17:51:02.605Z",
        updatedAt: "2026-08-06T17:51:02.605Z",
      }).organization
    ).toBe("—");
    expect(normalizeEmail(" Meera.Joshi@IESEdu.in ")).toBe(
      "meera.joshi@iesedu.in"
    );
  });

  it("maps event links, partnerships, and seminar assignments", () => {
    const partner = basePartner();
    const plan = buildPartnerImportPlan({
      spocs: [
        {
          id: "udvqbmrts",
          name: "Suresh Kulkarni",
          organization: "K2",
          phone: "9886020001",
          email: "suresh.kulkarni@k2group.in",
          createdAt: "2026-08-06T17:51:02.605Z",
          updatedAt: "2026-08-06T17:51:02.605Z",
        },
      ],
      partners: [partner],
    });

    expect(plan.eventLinks).toEqual([
      { partnerId: "partner-001", eventId: "evt-001" },
    ]);
    expect(plan.eventPartnerships[0]).toMatchObject({
      id: partnershipId("partner-001", "evt-001"),
      partnerId: "partner-001",
      eventId: "evt-001",
      sponsorshipTier: "Knowledge Partner (Gold)",
      seminarSlotCount: 2,
    });
    expect(plan.seminarSlotAssignments[0]).toMatchObject({
      partnershipId: partnershipId("partner-001", "evt-001"),
      seminarId: "sem-001-a",
      slots: 1,
      seminarTitle: "Stream selection",
    });
  });

  it("derives legacy partnerships when eventPartnerships is absent", () => {
    const partner = basePartner({
      eventPartnerships: undefined,
      deliverables: [{ id: "d1", key: "weblink", label: "Weblink", included: true }],
      sponsorshipTier: "Stall Partner",
    });

    const partnerships = buildPartnerImportPlan({
      spocs: [],
      partners: [partner],
    }).eventPartnerships;

    expect(partnerships).toHaveLength(1);
    expect(partnerships[0]?.sponsorshipTier).toBe("Stall Partner");
    expect(partnerships[0]?.seminarSlotCount).toBe(1);
  });

  it("detects cross-partner portal login collisions", () => {
    const errors = detectPortalLoginCollisions([
      basePartner({ id: "partner-a", portalLogin: "shared@example.com" }),
      basePartner({
        id: "partner-b",
        portalLogin: undefined,
        portalInviteEmail: "shared@example.com",
      }),
    ]);

    expect(errors.some((error) => error.includes("partner-a"))).toBe(true);
    expect(errors.some((error) => error.includes("partner-b"))).toBe(true);
  });

  it("flags missing event and seminar foreign keys", () => {
    const validation = validatePartnerSources({
      spocs: [],
      partners: [
        basePartner({
          eventIds: ["evt-missing"],
          seminarSlotAssignments: [
            {
              eventId: "evt-missing",
              seminarId: "sem-missing",
              slots: 1,
            },
          ],
        }),
      ],
      knownEventIds: new Set(["evt-001"]),
      knownSeminarIds: new Set(["sem-001-a"]),
    });

    expect(validation.ok).toBe(false);
    if (validation.ok) return;
    expect(validation.errors.join("\n")).toContain("missing event evt-missing");
    expect(validation.errors.join("\n")).toContain("missing seminar sem-missing");
  });

  it("requires a partnership row for seminar slot assignment mapping", () => {
    const rows = mapPartnerSeminarSlotAssignments(
      basePartner({
        eventPartnerships: undefined,
        deliverables: [],
        sponsorshipTier: undefined,
        seminarSlotAssignments: [
          { eventId: "evt-001", seminarId: "sem-001-a", slots: 1 },
        ],
      })
    );

    expect(rows[0]?.partnershipId).toBe("pep-partner-001-evt-001");
  });
});
