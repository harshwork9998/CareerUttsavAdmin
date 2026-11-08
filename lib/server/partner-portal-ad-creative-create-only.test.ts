import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  findSubmittedPortalDocument,
  isSubmittedPortalDocument,
} from "@/lib/partner-portal-document";
import {
  PORTAL_AD_CREATIVE_ALREADY_EXISTS_MESSAGE,
  PORTAL_UPLOAD_CONFLICT_MESSAGE,
} from "@/lib/partner-upload-policy";
import {
  buildAdCreativeObjectPath,
  commitPartnerAdCreativeUpload,
  resolveAdCreativeCommitCas,
} from "@/lib/server/partner-portal-ad-creative";
import { applyPortalSubmissionMutation } from "@/lib/server/partner-portal-submission-write";
import * as storage from "@/lib/server/partner-portal-storage";
import * as submissionWrite from "@/lib/server/partner-portal-submission-write";
import type { Partner, PartnerDeliverable, PartnerPortalDocument } from "@/types";

const entitledDeliverables: PartnerDeliverable[] = [
  {
    id: "d1",
    key: "bookAdCareersAfterPlus2",
    label: "Ad",
    included: true,
    option: "full page",
  },
];

function basePartner(overrides: Partial<Partner> = {}): Partner {
  return {
    id: "partner-001",
    name: "Test U",
    city: "Bengaluru",
    state: "Karnataka",
    stage: "Confirmed",
    eventIds: ["evt-001"],
    eventPartnerships: [
      {
        eventId: "evt-001",
        deliverables: entitledDeliverables,
        seminarSlotCount: 0,
        representativeSlotCount: 2,
      },
    ],
    portalDocuments: [],
    ...overrides,
  } as Partner;
}

function adDoc(
  storagePath: string,
  overrides: Partial<PartnerPortalDocument> = {}
): PartnerPortalDocument {
  return {
    id: "ad-1",
    kind: "ad_creative",
    label: "Advertisement creative",
    fileName: "ad.png",
    mimeType: "image/png",
    url: "",
    fileSizeBytes: 2048,
    uploadedAt: "2026-11-08T12:00:00.000Z",
    storageProvider: "supabase",
    storageBucket: "partner-portal-assets",
    storagePath,
    ...overrides,
  };
}

function logoDoc(): PartnerPortalDocument {
  return {
    id: "logo-1",
    kind: "logo",
    label: "University logo",
    fileName: "logo.png",
    mimeType: "image/png",
    url: "",
    fileSizeBytes: 512,
    uploadedAt: "2026-11-08T11:00:00.000Z",
    storageProvider: "supabase",
    storageBucket: "partner-portal-assets",
    storagePath: "partners/partner-001/logo/keep.png",
  };
}

describe("ad_creative create-only commit safeguards", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SUPABASE_URL = "https://example-ref.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    process.env.SUPABASE_PORTAL_BUCKET = "partner-portal-assets";
  });

  it("resolves create mode with empty CAS when no submitted document exists", () => {
    expect(resolveAdCreativeCommitCas({ portalDocuments: [] })).toEqual({
      mode: "create",
      ifMatchToken: "",
    });
    expect(resolveAdCreativeCommitCas({ portalDocuments: [], ifMatchToken: undefined })).toEqual({
      mode: "create",
      ifMatchToken: "",
    });
  });

  it("rejects replace attempts without an explicit match token", () => {
    const path = "partners/partner-001/ad_creative/live.png";
    expect(
      resolveAdCreativeCommitCas({
        portalDocuments: [adDoc(path)],
        ifMatchToken: undefined,
      })
    ).toEqual({ mode: "reject", reason: "already_exists" });
    expect(
      resolveAdCreativeCommitCas({
        portalDocuments: [adDoc(path)],
        ifMatchToken: "",
      })
    ).toEqual({ mode: "reject", reason: "already_exists" });
  });

  it("commits first upload with empty CAS under the row lock", () => {
    const columns = {
      portalDocuments: [] as PartnerPortalDocument[],
      portalFasciaName: "",
      portalWebsiteUrl: "",
      portalSmsContent: "",
      portalSeminarSpeakers: [] as never[],
      portalRepresentatives: [] as never[],
    };
    const next = adDoc("partners/partner-001/ad_creative/first.png");
    const first = applyPortalSubmissionMutation(columns, {
      op: "upsert_document",
      ifMatchToken: "",
      document: next,
    });
    expect(first.conflict).toBeUndefined();
    const second = applyPortalSubmissionMutation(first.columns, {
      op: "upsert_document",
      ifMatchToken: "",
      document: adDoc("partners/partner-001/ad_creative/race.png"),
    });
    expect(second.conflict).toBe(true);
    expect(second.columns.portalDocuments[0]?.storagePath).toBe(
      "partners/partner-001/ad_creative/first.png"
    );
  });

  it("persists first upload and sends create CAS to submission write", async () => {
    vi.spyOn(storage, "verifyPortalStorageObject").mockResolvedValue({
      ok: true,
      info: { size: 4096, mimeType: "image/png" },
    });
    const writeSpy = vi.spyOn(submissionWrite, "writePartnerPortalSubmission").mockResolvedValue({
      ok: true,
      partner: basePartner({
        portalDocuments: [
          adDoc("partners/partner-001/ad_creative/new.png", { fileSizeBytes: 4096 }),
        ],
      }),
    });
    const removeSpy = vi.spyOn(storage, "removePortalStorageObject").mockResolvedValue();

    const path = buildAdCreativeObjectPath("partner-001", ".png");
    const result = await commitPartnerAdCreativeUpload({
      partner: basePartner(),
      label: "Advertisement creative",
      fileName: "ad.png",
      mimeType: "image/png",
      fileSizeBytes: 4096,
      storageBucket: "partner-portal-assets",
      storagePath: path,
    });
    expect(result.ok).toBe(true);
    expect(writeSpy).toHaveBeenCalledWith(
      "partner-001",
      expect.objectContaining({
        op: "upsert_document",
        ifMatchToken: "",
      })
    );
    expect(removeSpy).not.toHaveBeenCalled();
  });

  it("rejects when a submitted ad already exists at commit time without a replace token", async () => {
    vi.spyOn(storage, "verifyPortalStorageObject").mockResolvedValue({
      ok: true,
      info: { size: 4096, mimeType: "image/png" },
    });
    const writeSpy = vi.spyOn(submissionWrite, "writePartnerPortalSubmission");
    const removeSpy = vi.spyOn(storage, "removePortalStorageObject").mockResolvedValue();
    const livePath = "partners/partner-001/ad_creative/existing.png";

    const result = await commitPartnerAdCreativeUpload({
      partner: basePartner({ portalDocuments: [adDoc(livePath)] }),
      label: "Advertisement creative",
      fileName: "ad.png",
      mimeType: "image/png",
      fileSizeBytes: 4096,
      storageBucket: "partner-portal-assets",
      storagePath: buildAdCreativeObjectPath("partner-001", ".png"),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toBe(PORTAL_AD_CREATIVE_ALREADY_EXISTS_MESSAGE);
    }
    expect(writeSpy).not.toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it("rejects create CAS when a submitted ad already exists", async () => {
    vi.spyOn(storage, "verifyPortalStorageObject").mockResolvedValue({
      ok: true,
      info: { size: 2048, mimeType: "image/png" },
    });
    const writeSpy = vi.spyOn(submissionWrite, "writePartnerPortalSubmission");
    const livePath = "partners/partner-001/ad_creative/live.png";

    const result = await commitPartnerAdCreativeUpload({
      partner: basePartner({ portalDocuments: [adDoc(livePath)] }),
      label: "Advertisement creative",
      fileName: "ad.png",
      mimeType: "image/png",
      fileSizeBytes: 2048,
      storageBucket: "partner-portal-assets",
      storagePath: buildAdCreativeObjectPath("partner-001", ".png"),
      ifMatchToken: "",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toBe(PORTAL_AD_CREATIVE_ALREADY_EXISTS_MESSAGE);
    }
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("rejects stale first-upload attempts after another session submitted", async () => {
    vi.spyOn(storage, "verifyPortalStorageObject").mockResolvedValue({
      ok: true,
      info: { size: 4096, mimeType: "image/png" },
    });
    const livePath = "partners/partner-001/ad_creative/other-session.png";
    const newPath = buildAdCreativeObjectPath("partner-001", ".png");
    vi.spyOn(submissionWrite, "writePartnerPortalSubmission").mockResolvedValue({
      ok: false,
      status: 409,
      error: PORTAL_UPLOAD_CONFLICT_MESSAGE,
      partner: basePartner({ portalDocuments: [adDoc(livePath)] }),
    });
    const removeSpy = vi.spyOn(storage, "removePortalStorageObject").mockResolvedValue();

    const staleSnapshot = basePartner({ portalDocuments: [] });
    const result = await commitPartnerAdCreativeUpload({
      partner: staleSnapshot,
      label: "Advertisement creative",
      fileName: "ad.png",
      mimeType: "image/png",
      fileSizeBytes: 4096,
      storageBucket: "partner-portal-assets",
      storagePath: newPath,
      ifMatchToken: "",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(409);
    expect(removeSpy).toHaveBeenCalledWith("partner-portal-assets", newPath);
    const existing = findSubmittedPortalDocument(
      result.partner?.portalDocuments,
      "ad_creative"
    );
    expect(existing?.storagePath).toBe(livePath);
  });

  it("cleans up only the new object on CAS conflict and keeps the live storage path", async () => {
    const livePath = "partners/partner-001/ad_creative/keep.png";
    const stalePath = "partners/partner-001/ad_creative/stale.png";
    vi.spyOn(storage, "verifyPortalStorageObject").mockResolvedValue({
      ok: true,
      info: { size: 1024, mimeType: "image/png" },
    });
    vi.spyOn(submissionWrite, "writePartnerPortalSubmission").mockResolvedValue({
      ok: false,
      status: 409,
      error: PORTAL_UPLOAD_CONFLICT_MESSAGE,
      partner: basePartner({ portalDocuments: [adDoc(livePath)] }),
    });
    const removeSpy = vi.spyOn(storage, "removePortalStorageObject").mockResolvedValue();

    await commitPartnerAdCreativeUpload({
      partner: basePartner({ portalDocuments: [adDoc(livePath)] }),
      label: "Advertisement creative",
      fileName: "ad.png",
      mimeType: "image/png",
      fileSizeBytes: 1024,
      storageBucket: "partner-portal-assets",
      storagePath: stalePath,
      ifMatchToken: livePath,
    });

    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledWith("partner-portal-assets", stalePath);
    expect(removeSpy).not.toHaveBeenCalledWith("partner-portal-assets", livePath);
  });

  it("does not modify unrelated portal documents on successful create", () => {
    const current = {
      portalDocuments: [logoDoc()],
      portalFasciaName: "FASCIA",
      portalWebsiteUrl: "https://uni.test",
      portalSmsContent: "sms",
      portalSeminarSpeakers: [] as never[],
      portalRepresentatives: [] as never[],
    };
    const result = applyPortalSubmissionMutation(current, {
      op: "upsert_document",
      ifMatchToken: "",
      document: adDoc("partners/partner-001/ad_creative/new.png"),
    });
    expect(result.conflict).toBeUndefined();
    expect(result.columns.portalDocuments).toHaveLength(2);
    expect(result.columns.portalDocuments[0]?.kind).toBe("logo");
    expect(result.columns.portalDocuments[0]?.storagePath).toBe(
      "partners/partner-001/logo/keep.png"
    );
    expect(
      isSubmittedPortalDocument(
        findSubmittedPortalDocument(result.columns.portalDocuments, "ad_creative")!
      )
    ).toBe(true);
    expect(result.columns.portalFasciaName).toBe("FASCIA");
  });
});
