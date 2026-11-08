import { beforeEach, describe, expect, it, vi } from "vitest";

import { isSubmittedPortalDocument } from "@/lib/partner-portal-document";
import {
  AD_CREATIVE_UNSUPPORTED_MESSAGE,
  MAX_UPLOAD_BYTES,
  validateUploadFile,
} from "@/lib/partner-upload-policy";
import {
  assertAdCreativePathOwnedByPartner,
  buildAdCreativeObjectPath,
  commitPartnerAdCreativeUpload,
  createPartnerAdCreativeUploadIntent,
  isPartnerEntitledToAdCreative,
} from "@/lib/server/partner-portal-ad-creative";
import * as storage from "@/lib/server/partner-portal-storage";
import * as submissionWrite from "@/lib/server/partner-portal-submission-write";
import type { Partner, PartnerDeliverable } from "@/types";

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

describe("partner portal ad creative storage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SUPABASE_URL = "https://example-ref.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    process.env.SUPABASE_PORTAL_BUCKET = "partner-portal-assets";
  });

  it("requires ad_creative entitlement before upload intent", async () => {
    const partner = basePartner({
      eventPartnerships: [{ eventId: "evt-001", deliverables: [], seminarSlotCount: 0 }],
    });
    expect(isPartnerEntitledToAdCreative(partner)).toBe(false);
    const result = await createPartnerAdCreativeUploadIntent({
      partner,
      fileName: "ad.png",
      mimeType: "image/png",
      fileSizeBytes: 1200,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("generates partner-owned unique object paths", () => {
    const a = buildAdCreativeObjectPath("partner-001", ".png");
    const b = buildAdCreativeObjectPath("partner-001", ".png");
    expect(a).toMatch(/^partners\/partner-001\/ad_creative\/.+\.png$/);
    expect(b).not.toBe(a);
    expect(assertAdCreativePathOwnedByPartner(a, "partner-001")).toBe(true);
    expect(assertAdCreativePathOwnedByPartner(a, "partner-002")).toBe(false);
    expect(
      assertAdCreativePathOwnedByPartner("../../other.pdf", "partner-001")
    ).toBe(false);
  });

  it("rejects invalid extensions and zero-byte files", async () => {
    const partner = basePartner();
    const badExt = await createPartnerAdCreativeUploadIntent({
      partner,
      fileName: "notes.docx",
      mimeType: "application/vnd",
      fileSizeBytes: 10,
    });
    expect(badExt.ok).toBe(false);

    const zero = await createPartnerAdCreativeUploadIntent({
      partner,
      fileName: "ad.png",
      mimeType: "image/png",
      fileSizeBytes: 0,
    });
    expect(zero.ok).toBe(false);
  });

  for (const [fileName, mimeType] of [
    ["ad.svg", "image/svg+xml"],
    ["ad.png", "image/png"],
    ["ad.jpg", "image/jpeg"],
    ["ad.jpeg", "image/jpeg"],
    ["ad.pdf", "application/pdf"],
    ["ad.cdr", "application/octet-stream"],
    ["ad.cdr", ""],
    ["ad.ai", "application/postscript"],
    ["ad.eps", "application/postscript"],
  ] as const) {
    it(`accepts ${fileName}`, async () => {
      vi.spyOn(storage, "createSignedUploadIntent").mockResolvedValue({
        ok: true,
        intent: {
          bucket: "partner-portal-assets",
          path: "partners/partner-001/ad_creative/x.png",
          token: "tok",
          tusEndpoint: "https://example-ref.storage.supabase.co/storage/v1/upload/resumable/sign",
        },
      });
      const partner = basePartner();
      const result = await createPartnerAdCreativeUploadIntent({
        partner,
        fileName,
        mimeType,
        fileSizeBytes: 1024,
      });
      expect(result.ok).toBe(true);
    });
  }

  it("does not apply the 40 MB application limit to ad_creative", () => {
    expect(
      validateUploadFile({
        fileName: "ad.png",
        fileSizeBytes: MAX_UPLOAD_BYTES + 1,
        kind: "ad_creative",
      })
    ).toBeNull();
    expect(
      validateUploadFile({
        fileName: "logo.png",
        fileSizeBytes: MAX_UPLOAD_BYTES + 1,
        kind: "default",
      })
    ).not.toBeNull();
  });

  it("rejects another partner's path on commit", async () => {
    const partner = basePartner();
    const result = await commitPartnerAdCreativeUpload({
      partner,
      label: "Advertisement creative",
      fileName: "ad.png",
      mimeType: "image/png",
      fileSizeBytes: 1024,
      storageBucket: "partner-portal-assets",
      storagePath: "partners/partner-002/ad_creative/x.png",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("counts legacy data URL and storage-backed docs as submitted", () => {
    expect(
      isSubmittedPortalDocument({
        url: "data:image/png;base64,abc",
        fileName: "a.png",
      })
    ).toBe(true);
    expect(
      isSubmittedPortalDocument({
        url: "",
        fileName: "a.png",
        storageProvider: "supabase",
        storageBucket: "partner-portal-assets",
        storagePath: "partners/p/ad_creative/x.png",
      })
    ).toBe(true);
    expect(
      isSubmittedPortalDocument({ url: "", fileName: "a.png" })
    ).toBe(false);
  });

  it("commit verifies object existence and persists storage metadata", async () => {
    vi.spyOn(storage, "verifyPortalStorageObject").mockResolvedValue({
      ok: true,
      info: {
        size: 4096,
        mimeType: "image/png",
      },
    });
    vi.spyOn(submissionWrite, "writePartnerPortalSubmission").mockResolvedValue({
      ok: true,
      partner: basePartner({
        portalDocuments: [
          {
            id: "doc-1",
            kind: "ad_creative",
            label: "Advertisement creative",
            fileName: "ad.png",
            mimeType: "image/png",
            url: "",
            fileSizeBytes: 4096,
            uploadedAt: new Date().toISOString(),
            storageProvider: "supabase",
            storageBucket: "partner-portal-assets",
            storagePath: "partners/partner-001/ad_creative/new.png",
          },
        ],
      }),
    });
    const removeSpy = vi
      .spyOn(storage, "removePortalStorageObject")
      .mockResolvedValue();

    const partner = basePartner();
    const path = buildAdCreativeObjectPath(partner.id, ".png");
    const result = await commitPartnerAdCreativeUpload({
      partner,
      label: "Advertisement creative",
      fileName: "ad.png",
      mimeType: "image/png",
      fileSizeBytes: 4096,
      storageBucket: "partner-portal-assets",
      storagePath: path,
    });
    expect(result.ok).toBe(true);
    expect(removeSpy).not.toHaveBeenCalled();
  });

  it("does not persist when the uploaded object is missing", async () => {
    vi.spyOn(storage, "verifyPortalStorageObject").mockResolvedValue({
      ok: false,
      reason: "missing",
    });
    const writeSpy = vi.spyOn(submissionWrite, "writePartnerPortalSubmission");
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
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/could not be verified/i);
    }
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("does not persist when storage verification fails", async () => {
    vi.spyOn(storage, "verifyPortalStorageObject").mockResolvedValue({
      ok: false,
      reason: "verification_error",
    });
    const writeSpy = vi.spyOn(submissionWrite, "writePartnerPortalSubmission");
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
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(502);
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("never exposes unsupported helper copy in validation", () => {
    expect(AD_CREATIVE_UNSUPPORTED_MESSAGE).toContain("SVG");
  });
});
