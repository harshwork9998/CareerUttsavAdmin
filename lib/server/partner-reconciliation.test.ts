import { describe, expect, it } from "vitest";

import {
  mapPartnerSourceToPrisma,
  validatePartnerSources,
} from "@/lib/server/partner-prisma-import-map";
import { mapPrismaPartnerToApi, type PrismaPartnerRecord } from "@/lib/server/partner-prisma-map";
import {
  buildPartnerReconciliationPlan,
  summarizePartnerReconciliationPlan,
} from "@/lib/server/partner-reconciliation-plan";
import {
  canonicalizePartnerForComparison,
  compareExistingPartner,
  comparePartnerScalarFields,
  deepCanonicalizeStableJson,
  deepCanonicalizeValue,
  jsonPartnerToExpectedApiShape,
  partnerRowIsExactMatch,
} from "@/lib/server/partner-reconciliation";
import type { Partner } from "@/types";

const SAMPLE_HASH =
  "scrypt$66c925ef5729e711f567edbdda4caeb0$d3a447bf5e224a2b2213ffab14a47deae48dec6d2cb0de76237243fd988595ad7c051e67eda505c5f393b7599b3817c686c9a78c8271bef1132a58d58c61b460";

function basePartner(overrides: Partial<Partner> = {}): Partner {
  return {
    id: "partner-002",
    name: "IES Edu",
    city: "Bangalore",
    state: "Karnataka",
    primaryContact: {
      name: "Meera Joshi",
      designation: "Director",
      phone: "9886130001",
      email: "meera.joshi@iesedu.in",
    },
    secondaryContact: {
      name: "Support",
      designation: "Coordinator",
      phone: "9886130002",
      email: "support@iesedu.in",
    },
    eventIds: ["evt-001"],
    relationshipOwner: {
      organization: "IES",
      managerName: "Meera Joshi",
      managerPhone: "9886130001",
      managerEmail: "meera.joshi@iesedu.in",
    },
    stage: "Confirmed",
    stageRemarks: [],
    sponsorshipTier: "Knowledge Partner (Silver)",
    deliverables: [
      { id: "d1", key: "stallSize", label: "Stall", included: true },
    ],
    portalLogin: "meera.joshi@iesedu.in",
    portalPasswordHash: SAMPLE_HASH,
    portalAuthVersion: 2,
    portalPasswordChangedAt: "2026-08-18T07:00:00.000Z",
    createdAt: "2026-06-01T10:00:00+05:30",
    updatedAt: "2026-08-20T12:34:56.789Z",
    ...overrides,
  } as Partner;
}

function prismaPartnerFromJson(partner: Partner): PrismaPartnerRecord {
  const mapped = mapPartnerSourceToPrisma(partner);
  return {
    ...mapped,
    eventLinks: partner.eventIds.map((eventId) => ({
      partnerId: partner.id,
      eventId,
    })),
    eventPartnerships: [
      {
        id: `pep-${partner.id}-evt-001`,
        partnerId: partner.id,
        eventId: "evt-001",
        sponsorshipTier: partner.sponsorshipTier ?? null,
        customTierLabel: null,
        deliverables: (partner.deliverables ?? []) as unknown as PrismaPartnerRecord["eventPartnerships"][number]["deliverables"],
        seminarSlotCount: 0,
        seminarSlotAssignments: [],
      },
    ],
  } as PrismaPartnerRecord;
}

describe("partner reconciliation", () => {
  it("updates existing partner without authVersion bump when hash unchanged", () => {
    const partner = basePartner({ portalAuthVersion: 2 });
    const mapped = mapPartnerSourceToPrisma(partner);
    expect(mapped.portalAuthVersion).toBe(2);
    expect(mapped.portalPasswordHash).toBe(SAMPLE_HASH);
  });

  it("preserves password hash bytes exactly during mapping", () => {
    const partner = basePartner();
    const mapped = mapPartnerSourceToPrisma(partner);
    expect(mapped.portalPasswordHash).toBe(SAMPLE_HASH);
    expect(mapped.portalPasswordHash?.length).toBe(SAMPLE_HASH.length);
  });

  it("detects relationshipOwner reconciliation differences", () => {
    const jsonPartner = basePartner({
      relationshipOwner: {
        organization: "IES",
        spocId: "i738eqyb8",
        managerName: "Meera Joshi",
        managerPhone: "9886130001",
        managerEmail: "meera.joshi@iesedu.in",
      },
    });
    const dbRecord = prismaPartnerFromJson(
      basePartner({
        relationshipOwner: {
          organization: "IES",
          managerName: "Meera Joshi",
          managerPhone: "9886130001",
          managerEmail: "meera.joshi@iesedu.in",
        },
      })
    );

    const comparison = compareExistingPartner(jsonPartner, dbRecord);
    expect(comparison.fieldMismatches).toContain("relationshipOwner");
  });

  it("reconciles legacy deliverables and derived eventPartnerships", () => {
    const jsonPartner = basePartner({
      eventPartnerships: undefined,
      deliverables: [
        { id: "d1", key: "stallSize", label: "Stall", included: true },
        { id: "d2", key: "banner", label: "Banner", included: false },
      ],
    });

    const expected = jsonPartnerToExpectedApiShape(jsonPartner);
    expect(expected.eventPartnerships).toEqual([
      {
        eventId: "evt-001",
        sponsorshipTier: "Knowledge Partner (Silver)",
        deliverables: expected.deliverables,
        seminarSlotCount: 0,
      },
    ]);
  });

  it("detects explicit eventPartnership reconciliation differences", () => {
    const jsonPartner = basePartner({
      eventPartnerships: [
        {
          eventId: "evt-001",
          sponsorshipTier: "Knowledge Partner (Gold)",
          deliverables: [{ id: "d1", key: "stallSize", label: "Stall", included: true }],
          seminarSlotCount: 1,
        },
      ],
    });
    const dbRecord = prismaPartnerFromJson(basePartner());

    const comparison = compareExistingPartner(jsonPartner, dbRecord);
    expect(
      comparison.fieldMismatches.includes("eventPartnerships") ||
        comparison.relationalMismatches.eventPartnerships
    ).toBe(true);
  });

  it("preserves updatedAt from JSON source during mapping", () => {
    const updatedAt = "2026-08-20T12:34:56.789Z";
    const mapped = mapPartnerSourceToPrisma(basePartner({ updatedAt }));
    expect(mapped.updatedAt).toEqual(new Date(updatedAt));
  });

  it("fails validation before apply when partner references missing SPOC FK", () => {
    const validation = validatePartnerSources({
      spocs: [],
      partners: [
        basePartner({
          relationshipOwner: {
            organization: "IES",
            spocId: "missing-spoc",
            managerName: "Meera Joshi",
            managerPhone: "9886130001",
            managerEmail: "meera.joshi@iesedu.in",
          },
        }),
      ],
      knownEventIds: new Set(["evt-001"]),
      knownSeminarIds: new Set(["sem-001-a"]),
    });

    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.errors.some((error) => error.includes("missing SPOC"))).toBe(
        true
      );
    }
  });

  it("builds reconciliation plan with auth and relational mismatch counts", () => {
    const jsonPartner = basePartner({
      portalAuthVersion: 3,
      updatedAt: "2026-08-21T00:00:00.000Z",
    });
    const dbRecord = prismaPartnerFromJson(basePartner());

    const plan = buildPartnerReconciliationPlan({
      jsonSpocs: [],
      jsonPartners: [jsonPartner],
      dbSpocsById: new Map(),
      dbPartnersById: new Map([[jsonPartner.id, dbRecord]]),
    });

    const summary = summarizePartnerReconciliationPlan(plan);
    expect(summary.authMismatchCount).toBe(1);
    expect(plan.partnerRows[0]?.authMismatches).toContain("portalAuthVersion");
    expect(plan.partnerRows[0]?.fieldMismatches).toContain("updatedAt");
  });

  it("treats matching Prisma API output as exact partner match", () => {
    const jsonPartner = basePartner();
    const dbRecord = prismaPartnerFromJson(jsonPartner);
    const comparison = compareExistingPartner(jsonPartner, dbRecord);

    expect(comparison.fieldMismatches).toEqual([]);
    expect(comparison.authMismatches).toEqual([]);
    expect(comparison.relationalMismatches).toEqual({
      eventLinks: false,
      eventPartnerships: false,
      seminarSlotAssignments: false,
    });
    expect(
      partnerRowIsExactMatch({
        id: jsonPartner.id,
        exactMatch: false,
        fieldMismatches: comparison.fieldMismatches,
        authMismatches: comparison.authMismatches,
        relationalMismatches: comparison.relationalMismatches,
      })
    ).toBe(true);
  });

  it("treats identical ISO string and Prisma Date timestamps as exact", () => {
    const createdAt = "2026-06-01T10:00:00+05:30";
    const updatedAt = "2026-08-20T12:34:56.789Z";
    const jsonPartner = basePartner({ createdAt, updatedAt });
    const dbRecord = prismaPartnerFromJson(jsonPartner);

    const comparison = compareExistingPartner(jsonPartner, dbRecord);
    expect(comparison.fieldMismatches).not.toContain("createdAt");
    expect(comparison.fieldMismatches).not.toContain("updatedAt");
  });

  it("treats API-equivalent empty stageRemarks and meetings as exact", () => {
    const jsonPartner = basePartner({
      stageRemarks: undefined,
      meetings: undefined,
    });
    const dbRecord = prismaPartnerFromJson(basePartner());

    const comparison = compareExistingPartner(jsonPartner, dbRecord);
    expect(comparison.fieldMismatches).not.toContain("stageRemarks");
    expect(comparison.fieldMismatches).not.toContain("meetings");
  });

  it("still detects true relational differences", () => {
    const jsonPartner = basePartner({
      eventPartnerships: [
        {
          eventId: "evt-001",
          sponsorshipTier: "Knowledge Partner (Gold)",
          deliverables: [{ id: "d1", key: "stallSize", label: "Stall", included: true }],
          seminarSlotCount: 2,
        },
      ],
    });
    const dbRecord = prismaPartnerFromJson(basePartner());

    const comparison = compareExistingPartner(jsonPartner, dbRecord);
    expect(
      comparison.fieldMismatches.includes("eventPartnerships") ||
        comparison.relationalMismatches.eventPartnerships
    ).toBe(true);
  });

  it("still detects true relationshipOwner differences", () => {
    const jsonPartner = basePartner({
      relationshipOwner: {
        organization: "IES",
        spocId: "i738eqyb8",
        managerName: "Meera Joshi",
        managerPhone: "9886130001",
        managerEmail: "meera.joshi@iesedu.in",
      },
    });
    const dbRecord = prismaPartnerFromJson(basePartner());

    const comparison = compareExistingPartner(jsonPartner, dbRecord);
    expect(comparison.fieldMismatches).toContain("relationshipOwner");
  });

  it("canonicalizes timestamp fields to numeric instants", () => {
    const createdAt = "2026-06-01T10:00:00+05:30";
    const updatedAt = "2026-08-20T12:34:56.789Z";

    expect(
      canonicalizePartnerForComparison(basePartner({ createdAt, updatedAt }))
        .createdAt
    ).toBe(new Date(createdAt).getTime());
    expect(
      canonicalizePartnerForComparison(
        mapPrismaPartnerToApi(prismaPartnerFromJson(basePartner({ createdAt, updatedAt })))
      ).createdAt
    ).toBe(new Date(createdAt).getTime());
    expect(
      comparePartnerScalarFields(
        jsonPartnerToExpectedApiShape(basePartner({ createdAt, updatedAt })),
        mapPrismaPartnerToApi(
          prismaPartnerFromJson(basePartner({ createdAt, updatedAt }))
        )
      )
    ).toEqual([]);
  });

  describe("deep canonical comparison", () => {
    it("A: nested objects with different property order compare equal", () => {
      expect(
        deepCanonicalizeStableJson({
          id: "remark-1",
          remark: "Follow up",
          createdAt: "2026-06-01T10:00:00.000Z",
        })
      ).toBe(
        deepCanonicalizeStableJson({
          createdAt: "2026-06-01T10:00:00.000Z",
          id: "remark-1",
          remark: "Follow up",
        })
      );
    });

    it("B: stageRemarks with same entries but reordered object keys compare equal", () => {
      const jsonPartner = basePartner({
        stageRemarks: [
          {
            id: "sr-1",
            remark: "Needs callback",
            createdAt: "2026-06-10T10:00:00.000Z",
          } as unknown as NonNullable<Partner["stageRemarks"]>[number],
        ],
      });
      const dbPartner = mapPrismaPartnerToApi({
        ...prismaPartnerFromJson(basePartner()),
        stageRemarks: [
          {
            createdAt: "2026-06-10T10:00:00.000Z",
            id: "sr-1",
            remark: "Needs callback",
          },
        ],
      } as unknown as PrismaPartnerRecord);

      expect(
        comparePartnerScalarFields(
          jsonPartnerToExpectedApiShape(jsonPartner),
          dbPartner
        )
      ).not.toContain("stageRemarks");
    });

    it("C: meetings with JSONB key order differences compare equal", () => {
      const jsonPartner = basePartner({
        meetings: [
          {
            id: "mtg-1",
            meetingAt: "2026-06-18T15:00:00.000Z",
            notes: "Initial discussion",
            outcome: "in_discussion",
          } as unknown as NonNullable<Partner["meetings"]>[number],
        ],
      });
      const dbPartner = mapPrismaPartnerToApi({
        ...prismaPartnerFromJson(basePartner()),
        meetings: [
          {
            notes: "Initial discussion",
            outcome: "in_discussion",
            id: "mtg-1",
            meetingAt: "2026-06-18T15:00:00.000Z",
          },
        ],
      } as unknown as PrismaPartnerRecord);

      expect(
        comparePartnerScalarFields(
          jsonPartnerToExpectedApiShape(jsonPartner),
          dbPartner
        )
      ).not.toContain("meetings");
    });

    it("D: eventPartnership deliverables with reordered object keys compare equal", () => {
      const deliverable = {
        id: "d1",
        key: "stallSize",
        label: "Stall",
        included: true,
      };
      const jsonPartner = basePartner({
        eventPartnerships: [
          {
            eventId: "evt-001",
            sponsorshipTier: "Knowledge Partner (Silver)",
            deliverables: [deliverable],
            seminarSlotCount: 0,
          },
        ],
        deliverables: undefined,
      });
      const dbPartner = mapPrismaPartnerToApi({
        ...prismaPartnerFromJson(basePartner()),
        eventPartnerships: [
          {
            id: "pep-partner-002-evt-001",
            partnerId: "partner-002",
            eventId: "evt-001",
            sponsorshipTier: "Knowledge Partner (Silver)",
            customTierLabel: null,
            deliverables: [
              {
                included: true,
                key: "stallSize",
                label: "Stall",
                id: "d1",
              },
            ],
            seminarSlotCount: 0,
            seminarSlotAssignments: [],
          },
        ],
      } as unknown as PrismaPartnerRecord);

      expect(
        comparePartnerScalarFields(
          jsonPartnerToExpectedApiShape(jsonPartner),
          dbPartner
        )
      ).not.toContain("eventPartnerships");
    });

    it("E: actual changed nested value is still detected", () => {
      expect(
        deepCanonicalizeStableJson({
          id: "remark-1",
          remark: "Needs callback",
        })
      ).not.toBe(
        deepCanonicalizeStableJson({
          remark: "Different note",
          id: "remark-1",
        })
      );

      const comparison = compareExistingPartner(
        basePartner({
          stageRemarks: [
            {
              id: "sr-1",
              remark: "Needs callback",
              createdAt: "2026-06-10T10:00:00.000Z",
            } as unknown as NonNullable<Partner["stageRemarks"]>[number],
          ],
        }),
        {
          ...prismaPartnerFromJson(basePartner()),
          stageRemarks: [
            {
              id: "sr-1",
              remark: "Different note",
              createdAt: "2026-06-10T10:00:00.000Z",
            },
          ],
        } as unknown as PrismaPartnerRecord
      );

      expect(comparison.fieldMismatches).toContain("stageRemarks");
    });

    it("F: array order differences remain detectable", () => {
      expect(
        deepCanonicalizeStableJson([
          { id: "first", remark: "A" },
          { id: "second", remark: "B" },
        ])
      ).not.toBe(
        deepCanonicalizeStableJson([
          { id: "second", remark: "B" },
          { id: "first", remark: "A" },
        ])
      );
    });

    it("treats JSONB key-order differences across partner-001-like fields as exact", () => {
      const jsonPartner = basePartner({
        id: "partner-001",
        stageRemarks: [
          {
            id: "sr-1",
            remark: "Gold package discussion",
            createdAt: "2026-06-12T10:00:00.000Z",
          } as unknown as NonNullable<Partner["stageRemarks"]>[number],
        ],
        deliverables: [
          {
            id: "d1",
            key: "stallSize",
            label: "Stall",
            included: true,
          },
        ],
        portalDocuments: [
          {
            id: "doc-1",
            name: "Agreement.pdf",
            uploadedAt: "2026-07-01T10:00:00.000Z",
          } as unknown as NonNullable<Partner["portalDocuments"]>[number],
        ],
        portalSeminarSpeakers: [
          {
            eventId: "evt-001",
            seminarId: "sem-001-a",
            speakerName: "Dr. Rao",
          } as unknown as NonNullable<Partner["portalSeminarSpeakers"]>[number],
        ],
        meetings: [
          {
            id: "mtg-1",
            meetingAt: "2026-06-18T15:00:00.000Z",
            notes: "Walked through packages",
            outcome: "in_discussion",
          } as unknown as NonNullable<Partner["meetings"]>[number],
        ],
        eventPartnerships: [
          {
            eventId: "evt-001",
            sponsorshipTier: "Knowledge Partner (Gold)",
            deliverables: [
              {
                id: "d1",
                key: "stallSize",
                label: "Stall",
                included: true,
              },
            ],
            seminarSlotCount: 2,
          },
        ],
      });

      const dbRecord = {
        ...prismaPartnerFromJson(jsonPartner),
        stageRemarks: [
          {
            createdAt: "2026-06-12T10:00:00.000Z",
            id: "sr-1",
            remark: "Gold package discussion",
          },
        ],
        legacyDeliverables: [
          {
            included: true,
            key: "stallSize",
            label: "Stall",
            id: "d1",
          },
        ],
        portalDocuments: [
          {
            uploadedAt: "2026-07-01T10:00:00.000Z",
            id: "doc-1",
            name: "Agreement.pdf",
          },
        ],
        portalSeminarSpeakers: [
          {
            speakerName: "Dr. Rao",
            seminarId: "sem-001-a",
            eventId: "evt-001",
          },
        ],
        meetings: [
          {
            outcome: "in_discussion",
            notes: "Walked through packages",
            meetingAt: "2026-06-18T15:00:00.000Z",
            id: "mtg-1",
          },
        ],
        eventPartnerships: [
          {
            id: "pep-partner-001-evt-001",
            partnerId: "partner-001",
            eventId: "evt-001",
            sponsorshipTier: "Knowledge Partner (Gold)",
            customTierLabel: null,
            deliverables: [
              {
                label: "Stall",
                included: true,
                id: "d1",
                key: "stallSize",
              },
            ],
            seminarSlotCount: 2,
            seminarSlotAssignments: [],
          },
        ],
      } as unknown as PrismaPartnerRecord;

      const comparison = compareExistingPartner(jsonPartner, dbRecord);
      expect(comparison.fieldMismatches).toEqual([]);
      expect(comparison.relationalMismatches.eventPartnerships).toBe(false);
    });

    it("deepCanonicalizeValue preserves array order while sorting object keys", () => {
      expect(deepCanonicalizeValue([{ b: 1, a: 2 }, { d: 3, c: 4 }])).toEqual([
        { a: 2, b: 1 },
        { c: 4, d: 3 },
      ]);
    });
  });
});
