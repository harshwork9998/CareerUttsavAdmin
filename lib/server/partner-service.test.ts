import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyPartnerCredentialFields } from "@/lib/partner-credentials";
import { authenticatePartnerPortalLogin } from "@/lib/partner-portal-auth";
import type { Partner } from "@/types";

const SAMPLE_HASH =
  "scrypt$66c925ef5729e711f567edbdda4caeb0$d3a447bf5e224a2b2213ffab14a47deae48dec6d2cb0de76237243fd988595ad7c051e67eda505c5f393b7599b3817c686c9a78c8271bef1132a58d58c61b460";

function partner(overrides: Partial<Partner> = {}): Partner {
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
      managerName: "Suresh Kulkarni",
      managerPhone: "9886020001",
      managerEmail: "suresh.kulkarni@k2group.in",
    },
    stage: "Negotiation",
    stageRemarks: [],
    portalLogin: "anitha.rao@christuniversity.in",
    portalInviteEmail: "priya.verify@example.com",
    portalPasswordHash: SAMPLE_HASH,
    portalAuthVersion: 2,
    portalInviteSentAt: "2026-07-10T10:00:00.000Z",
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-08-18T07:01:27.875Z",
    ...overrides,
  };
}

vi.mock("@/lib/server/partners-persistence", () => ({
  loadPartners: vi.fn(),
  savePartners: vi.fn((partners: Partner[]) => partners),
}));

vi.mock("@/lib/server/partner-prisma-store", () => ({
  listPrismaPartners: vi.fn(),
  getPrismaPartnerById: vi.fn(),
  findPrismaPartnersByPortalLogin: vi.fn(),
  createPrismaPartner: vi.fn(),
  updatePrismaPartner: vi.fn(),
  deletePrismaPartner: vi.fn(),
  prunePrismaPartnersForEventIds: vi.fn(),
}));

vi.mock("@/lib/server/spocs-persistence", () => ({
  loadSpocs: vi.fn(() => []),
  saveSpocs: vi.fn((spocs: unknown[]) => spocs),
  findSpocByEmail: vi.fn(),
}));

vi.mock("@/lib/server/spoc-prisma-store", () => ({
  listPrismaSpocs: vi.fn(),
  getPrismaSpocById: vi.fn(),
  findPrismaSpocByEmail: vi.fn(),
  createPrismaSpoc: vi.fn(),
  updatePrismaSpoc: vi.fn(),
  deletePrismaSpoc: vi.fn(),
  isPrismaUniqueConstraintError: vi.fn(),
}));

import { loadPartners } from "@/lib/server/partners-persistence";
import {
  createPartnerForApi,
  findPartnersByPortalLoginForApi,
  listPartnersForApi,
  updatePartnerForApi,
} from "@/lib/server/partner-service";
import {
  createSpocForApi,
  updateSpocForApi,
} from "@/lib/server/spoc-service";
import { findPrismaPartnersByPortalLogin } from "@/lib/server/partner-prisma-store";
import { findPrismaSpocByEmail } from "@/lib/server/spoc-prisma-store";
import { findSpocByEmail } from "@/lib/server/spocs-persistence";

describe("partner service json mode", () => {
  const original = process.env.PARTNER_PERSISTENCE;

  beforeEach(() => {
    delete process.env.PARTNER_PERSISTENCE;
    vi.mocked(loadPartners).mockReturnValue([partner()]);
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.PARTNER_PERSISTENCE;
    } else {
      process.env.PARTNER_PERSISTENCE = original;
    }
    vi.clearAllMocks();
  });

  it("lists partners from JSON persistence unchanged", async () => {
    const rows = await listPartnersForApi();
    expect(rows).toHaveLength(1);
    expect(loadPartners).toHaveBeenCalledTimes(1);
  });

  it("updates partner in JSON mode without credential side effects", async () => {
    const result = await updatePartnerForApi("partner-001", {
      portalFasciaName: "Updated fascia",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.partner.portalFasciaName).toBe("Updated fascia");
    expect(result.partner.portalAuthVersion).toBe(2);
  });
});

describe("partner service prisma mode auth", () => {
  const original = process.env.PARTNER_PERSISTENCE;

  beforeEach(() => {
    process.env.PARTNER_PERSISTENCE = "prisma";
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.PARTNER_PERSISTENCE;
    } else {
      process.env.PARTNER_PERSISTENCE = original;
    }
    vi.clearAllMocks();
  });

  it("finds partner by portalLogin via prisma lookup", async () => {
    vi.mocked(findPrismaPartnersByPortalLogin).mockResolvedValue([partner()]);
    const matches = await findPartnersByPortalLoginForApi(
      "anitha.rao@christuniversity.in"
    );
    expect(matches).toHaveLength(1);
  });

  it("finds partner by portalInviteEmail via prisma lookup", async () => {
    vi.mocked(findPrismaPartnersByPortalLogin).mockResolvedValue([
      partner({ portalLogin: undefined }),
    ]);
    const matches = await findPartnersByPortalLoginForApi(
      "priya.verify@example.com"
    );
    expect(matches).toHaveLength(1);
  });

  it("rejects ambiguous cross-field login matches", async () => {
    vi.mocked(findPrismaPartnersByPortalLogin).mockResolvedValue([
      partner({ id: "partner-a" }),
      partner({ id: "partner-b" }),
    ]);
    const result = await authenticatePartnerPortalLogin({
      login: "shared@example.com",
      password: "123456",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("ambiguous_credentials");
    expect(result.status).toBe(503);
  });
});

describe("spoc service", () => {
  const original = process.env.PARTNER_PERSISTENCE;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.PARTNER_PERSISTENCE;
    } else {
      process.env.PARTNER_PERSISTENCE = original;
    }
    vi.clearAllMocks();
  });

  it("upserts SPOC by normalized email in JSON mode", async () => {
    delete process.env.PARTNER_PERSISTENCE;
    vi.mocked(findSpocByEmail).mockReturnValue({
      id: "spoc-1",
      name: "Old Name",
      organization: "IES",
      phone: "9886130001",
      email: "meera.joshi@iesedu.in",
      createdAt: "2026-08-06T17:51:02.605Z",
      updatedAt: "2026-08-06T17:51:02.605Z",
    });

    const result = await createSpocForApi({
      name: "Meera Joshi",
      organization: "IES",
      phone: "9886130001",
      email: "meera.joshi@iesedu.in",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spoc.id).toBe("spoc-1");
    expect(result.spoc.name).toBe("Meera Joshi");
  });

  it("rejects duplicate email on PATCH in prisma mode", async () => {
    process.env.PARTNER_PERSISTENCE = "prisma";
    const { listPrismaSpocs } = await import("@/lib/server/spoc-prisma-store");
    vi.mocked(listPrismaSpocs).mockResolvedValue([
      {
        id: "spoc-1",
        name: "Meera Joshi",
        organization: "IES",
        phone: "9886130001",
        email: "meera.joshi@iesedu.in",
        createdAt: "2026-08-06T17:51:02.605Z",
        updatedAt: "2026-08-06T17:51:02.605Z",
      },
    ]);
    vi.mocked(findPrismaSpocByEmail).mockResolvedValue({
      id: "spoc-other",
      name: "Other",
      organization: "K2",
      phone: "9886020001",
      email: "suresh.kulkarni@k2group.in",
      createdAt: "2026-08-06T17:51:02.605Z",
      updatedAt: "2026-08-06T17:51:02.605Z",
    });

    const result = await updateSpocForApi("spoc-1", {
      email: "suresh.kulkarni@k2group.in",
    });

    expect(result).toMatchObject({ ok: false, status: 409 });
  });
});

describe("partner credential parity", () => {
  it("bumps authVersion only when password changes", () => {
    const existing = partner({ portalAuthVersion: 2 });
    const noPasswordChange = applyPartnerCredentialFields(existing, {
      portalPasswordPromptSkippedAt: "2026-08-18T07:01:20.660Z",
    } as Partial<Partner>);
    expect(noPasswordChange.portalAuthVersion).toBe(2);

    const passwordChange = applyPartnerCredentialFields(existing, {
      portalTempPassword: "brand-new-password",
    });
    expect(passwordChange.portalAuthVersion).toBe(3);
  });
});
