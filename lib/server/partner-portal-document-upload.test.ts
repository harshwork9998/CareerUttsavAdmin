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

  it("accepts write-up design formats even when the browser MIME is empty", async () => {
    vi.spyOn(storage, "createSignedUploadIntent").mockResolvedValue({
      ok: true,
      intent: {
        bucket: "partner-portal-assets",
        path: "partners/partner-001/souvenir_writeup/x.cdr",
        token: "tok",
        tusEndpoint: "https://example-ref.storage.supabase.co/storage/v1/upload/resumable/sign",
      },
    });
    const result = await createPartnerPortalDocumentUploadIntent({
      partner: basePartner(),
      kind: "souvenir_writeup",
      fileName: "writeup.cdr",
      mimeType: "",
      fileSizeBytes: 2048,
    });
    expect(result.ok).toBe(true);
  });

  it("accepts SVG with a charset suffix and PNG with a generic MIME", async () => {
    vi.spyOn(storage, "createSignedUploadIntent").mockResolvedValue({
      ok: true,
      intent: {
        bucket: "partner-portal-assets",
        path: "partners/partner-001/logo/x.svg",
        token: "tok",
        tusEndpoint: "https://example-ref.storage.supabase.co/storage/v1/upload/resumable/sign",
      },
    });
    const svg = await createPartnerPortalDocumentUploadIntent({
      partner: basePartner(),
      kind: "logo",
      fileName: "logo.svg",
      mimeType: "image/svg+xml;charset=utf-8",
      fileSizeBytes: 2048,
    });
    const png = await createPartnerPortalDocumentUploadIntent({
      partner: basePartner(),
      kind: "logo",
      fileName: "logo.png",
      mimeType: "application/octet-stream",
      fileSizeBytes: 2048,
    });
    expect(svg.ok).toBe(true);
    expect(png.ok).toBe(true);
  });

  it("deletes only the new object when a same-kind replacement conflicts", async () => {
    const livePath = "partners/partner-001/logo/live.png";
    const stalePath = buildPortalDocumentObjectPath("partner-001", "logo", ".png");
    vi.spyOn(storage, "verifyPortalStorageObject").mockResolvedValue({
      ok: true,
      info: { size: 2048, mimeType: "image/png" },
    });
    vi.spyOn(submissionWrite, "writePartnerPortalSubmission").mockResolvedValue({
      ok: false,
      status: 409,
      error: "This file was updated from another session. The latest submitted file has been kept.",
      partner: basePartner({
        portalDocuments: [
          {
            id: "logo-1",
            kind: "logo",
            label: "University logo",
            fileName: "live.png",
            mimeType: "image/png",
            url: "",
            fileSizeBytes: 10,
            uploadedAt: new Date().toISOString(),
            storageProvider: "supabase",
            storageBucket: "partner-portal-assets",
            storagePath: livePath,
          },
        ],
      }),
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
            storagePath: livePath,
          },
        ],
      }),
      kind: "logo",
      label: "University logo",
      fileName: "stale.png",
      mimeType: "image/png",
      fileSizeBytes: 2048,
      storageBucket: "partner-portal-assets",
      storagePath: stalePath,
      ifMatchToken: "partners/partner-001/logo/old.png",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(409);
    expect(removeSpy).toHaveBeenCalledWith("partner-portal-assets", stalePath);
    expect(removeSpy).not.toHaveBeenCalledWith("partner-portal-assets", livePath);
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

  it("still returns success if previous-object cleanup throws", async () => {
    vi.spyOn(storage, "verifyPortalStorageObject").mockResolvedValue({
      ok: true,
      info: { size: 2048, mimeType: "image/png" },
    });
    const path = buildPortalDocumentObjectPath("partner-001", "logo", ".png");
    vi.spyOn(submissionWrite, "writePartnerPortalSubmission").mockResolvedValue({
      ok: true,
      partner: basePartner(),
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
    vi.spyOn(storage, "removePortalStorageObject").mockRejectedValue(new Error("storage down"));
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
    expect(result.ok).toBe(true);
  });
});
