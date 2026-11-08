import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertPortalDocumentPathOwnedByPartner,
  buildPortalDocumentObjectPath,
} from "@/lib/server/partner-portal-storage-paths";
import {
  commitPartnerPortalDocumentUpload,
  createPartnerPortalDocumentUploadIntent,
  isPartnerEntitledToPortalDocument,
} from "@/lib/server/partner-portal-document-upload";
import * as storage from "@/lib/server/partner-portal-storage";
import * as submissionWrite from "@/lib/server/partner-portal-submission-write";
import type { Partner, PartnerDeliverable } from "@/types";

const writeupDeliverables: PartnerDeliverable[] = [
  {
    id: "d1",
    key: "fullPageWriteup",
    label: "Write-up",
    included: true,
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
        deliverables: writeupDeliverables,
        seminarSlotCount: 0,
        representativeSlotCount: 2,
      },
    ],
    portalDocuments: [],
    ...overrides,
  } as Partner;
}

describe("partner portal document storage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SUPABASE_URL = "https://example-ref.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    process.env.SUPABASE_PORTAL_BUCKET = "partner-portal-assets";
  });

  it("logo is always entitled; write-up requires the deliverable", () => {
    const entitled = basePartner();
    const notEntitled = basePartner({
      eventPartnerships: [{ eventId: "evt-001", deliverables: [], seminarSlotCount: 0 }],
    });
    expect(isPartnerEntitledToPortalDocument(entitled, "logo")).toBe(true);
    expect(isPartnerEntitledToPortalDocument(notEntitled, "logo")).toBe(true);
    expect(isPartnerEntitledToPortalDocument(entitled, "souvenir_writeup")).toBe(true);
    expect(isPartnerEntitledToPortalDocument(notEntitled, "souvenir_writeup")).toBe(false);
  });

  it("rejects write-up intent without entitlement", async () => {
    const result = await createPartnerPortalDocumentUploadIntent({
      partner: basePartner({
        eventPartnerships: [{ eventId: "evt-001", deliverables: [], seminarSlotCount: 0 }],
      }),
      kind: "souvenir_writeup",
      fileName: "writeup.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 1200,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("generates partner-owned unique logo and write-up paths", () => {
    const logo = buildPortalDocumentObjectPath("partner-001", "logo", ".png");
    const writeup = buildPortalDocumentObjectPath("partner-001", "souvenir_writeup", ".pdf");
    expect(logo).toMatch(/^partners\/partner-001\/logo\/.+\.png$/);
    expect(writeup).toMatch(/^partners\/partner-001\/souvenir_writeup\/.+\.pdf$/);
    expect(assertPortalDocumentPathOwnedByPartner(logo, "partner-001", "logo")).toBe(true);
    expect(assertPortalDocumentPathOwnedByPartner(logo, "partner-002", "logo")).toBe(false);
    expect(assertPortalDocumentPathOwnedByPartner(writeup, "partner-001", "logo")).toBe(false);
    expect(assertPortalDocumentPathOwnedByPartner("../x", "partner-001", "logo")).toBe(false);
  });

  it("rejects empty files on intent", async () => {
    const zero = await createPartnerPortalDocumentUploadIntent({
      partner: basePartner(),
      kind: "logo",
      fileName: "logo.png",
      mimeType: "image/png",
      fileSizeBytes: 0,
    });
    expect(zero.ok).toBe(false);
  });

  it("commit verifies the object and does not persist when missing", async () => {
    vi.spyOn(storage, "verifyPortalStorageObject").mockResolvedValue({
      ok: false,
      reason: "missing",
    });
    const writeSpy = vi.spyOn(submissionWrite, "writePartnerPortalSubmission");
    const path = buildPortalDocumentObjectPath("partner-001", "logo", ".png");
    const result = await commitPartnerPortalDocumentUpload({
      partner: basePartner(),
      kind: "logo",
      label: "University logo",
      fileName: "logo.png",
      mimeType: "image/png",
      fileSizeBytes: 2048,
      storageBucket: "partner-portal-assets",
      storagePath: path,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("commit persists storage metadata and cleans the previous object", async () => {
    vi.spyOn(storage, "verifyPortalStorageObject").mockResolvedValue({
      ok: true,
      info: { size: 2048, mimeType: "image/png" },
    });
    const path = buildPortalDocumentObjectPath("partner-001", "logo", ".png");
    vi.spyOn(submissionWrite, "writePartnerPortalSubmission").mockResolvedValue({
      ok: true,
      partner: basePartner({
        portalDocuments: [
          {
            id: "logo-1",
            kind: "logo",
            label: "University logo",
            fileName: "logo.png",
            mimeType: "image/png",
            url: "",
            fileSizeBytes: 2048,
            uploadedAt: new Date().toISOString(),
            storageProvider: "supabase",
            storageBucket: "partner-portal-assets",
            storagePath: path,
          },
        ],
      }),
      replacedDocument: {
        id: "logo-1",
        kind: "logo",
        label: "University logo",
        fileName: "old.png",
        mimeType: "image/png",
        url: "",
        fileSizeBytes: 10,
        uploadedAt: new Date().toISOString(),
        storageProvider: "supabase",
        storageBucket: "partner-portal-assets",
        storagePath: "partners/partner-001/logo/old.png",
      },
    });
    const removeSpy = vi.spyOn(storage, "removePortalStorageObject").mockResolvedValue();
    const result = await commitPartnerPortalDocumentUpload({
      partner: basePartner({
        portalDocuments: [
          {
            id: "logo-1",
            kind: "logo",
            label: "University logo",
            fileName: "old.png",
            mimeType: "image/png",
            url: "",
            fileSizeBytes: 10,
            uploadedAt: new Date().toISOString(),
            storageProvider: "supabase",
            storageBucket: "partner-portal-assets",
            storagePath: "partners/partner-001/logo/old.png",
          },
        ],
      }),
      kind: "logo",
      label: "University logo",
      fileName: "logo.png",
      mimeType: "image/png",
      fileSizeBytes: 2048,
      storageBucket: "partner-portal-assets",
      storagePath: path,
    });
    expect(result.ok).toBe(true);
    expect(removeSpy).toHaveBeenCalledWith(
      "partner-portal-assets",
      "partners/partner-001/logo/old.png"
    );
  });

  it("cleans the new object when persistence fails", async () => {
    vi.spyOn(storage, "verifyPortalStorageObject").mockResolvedValue({
      ok: true,
      info: { size: 2048, mimeType: "image/png" },
    });
    vi.spyOn(submissionWrite, "writePartnerPortalSubmission").mockResolvedValue({
      ok: false,
      status: 500,
      error: "Could not save this update. Please try again.",
    });
    const removeSpy = vi.spyOn(storage, "removePortalStorageObject").mockResolvedValue();
    const path = buildPortalDocumentObjectPath("partner-001", "logo", ".png");
    const result = await commitPartnerPortalDocumentUpload({
      partner: basePartner(),
      kind: "logo",
      label: "University logo",
      fileName: "logo.png",
      mimeType: "image/png",
      fileSizeBytes: 2048,
      storageBucket: "partner-portal-assets",
      storagePath: path,
    });
    expect(result.ok).toBe(false);
    expect(removeSpy).toHaveBeenCalledWith("partner-portal-assets", path);
  });
});
