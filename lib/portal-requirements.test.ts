import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { deliverableOptionLabel } from "@/constants/partner-deliverables";
import {
  normalizePortalRepresentatives,
  representativesShownInViewDocs,
} from "@/lib/partner-portal-docs";
import { validateLinkedInProfile } from "@/lib/partner-linkedin";
import {
  mergeRepresentativesPreservingHistory,
  parseRepresentativeSlotCount,
} from "@/lib/partner-representative-allocation";
import {
  SMS_CONTENT_MAX_LENGTH,
  SMS_CONTENT_TOO_LONG_MESSAGE,
  validateSmsContent,
} from "@/lib/partner-sms-content";
import {
  MAX_UPLOAD_BYTES,
  OVERSIZE_FILE_MESSAGE,
  UNSUPPORTED_FILE_MESSAGE,
  validateStoredUpload,
  validateUploadFile,
} from "@/lib/partner-upload-policy";
import { validatePartnerPortalContent } from "@/lib/server/partner-portal-content";
import { parsePartnerPortalPatch } from "@/lib/server/partner-portal-patch";

const root = path.resolve(__dirname, "..");

describe("event representative allocation", () => {
  it("accepts zero and positive integers and rejects negatives", () => {
    expect(parseRepresentativeSlotCount(0)).toEqual({ ok: true, count: 0 });
    expect(parseRepresentativeSlotCount(3)).toEqual({ ok: true, count: 3 });
    expect(parseRepresentativeSlotCount(-1).ok).toBe(false);
    expect(parseRepresentativeSlotCount(1.5).ok).toBe(false);
  });

  it("keeps historical representative rows when allocation shrinks", () => {
    const merged = mergeRepresentativesPreservingHistory(
      [
        { name: "A", designation: "Dean", phone: "9876543210" },
        { name: "B", designation: "Lead", phone: "9876543211" },
      ],
      1,
      [{ name: "Asha", designation: "Director", phone: "9876543212" }]
    );
    expect(merged).toEqual([
      { name: "Asha", designation: "Director", phone: "9876543212" },
      { name: "B", designation: "Lead", phone: "9876543211" },
    ]);
  });

  it("does not let the partner portal patch allocation", () => {
    const parsed = parsePartnerPortalPatch({
      eventPartnerships: [{ eventId: "evt-001", representativeSlotCount: 9 }],
    });
    expect(parsed.ok).toBe(false);
  });
});

describe("representative fields for View Docs", () => {
  it("keeps name, designation, and phone, including rows beyond the current count", () => {
    const rows = normalizePortalRepresentatives([
      {
        eventId: "evt-001",
        count: 1,
        representatives: [
          { name: "Asha", designation: "Director", phone: "9876543210" },
          { name: "Earlier", designation: "Dean", phone: "9876543211" },
        ],
        updatedAt: "2026-10-01T00:00:00.000Z",
      },
    ]);
    expect(rows[0]?.representatives).toEqual([
      { name: "Asha", designation: "Director", phone: "9876543210" },
      { name: "Earlier", designation: "Dean", phone: "9876543211" },
    ]);
  });

  it("shows only submitted representatives and skips blank slots", () => {
    const shown = representativesShownInViewDocs([
      { name: "Asha", designation: "Director", phone: "9876543210" },
      { name: "Ravi", designation: "Dean", phone: "9876543211" },
      { name: "Neha", designation: "Lead", phone: "9876543212" },
      { name: "", designation: "", phone: "" },
    ]);
    expect(shown.map((person) => person.name)).toEqual(["Asha", "Ravi", "Neha"]);
  });

  it("labels the View Docs section Event Representatives and shows designation", () => {
    const source = readFileSync(
      path.join(root, "features/partners/partner-docs-dialog.tsx"),
      "utf8"
    );
    expect(source).toContain("person.designation");
    const docs = readFileSync(
      path.join(root, "lib/partner-portal-docs.ts"),
      "utf8"
    );
    expect(docs).toContain('label: "Event Representatives"');
  });
});

describe("LinkedIn profile", () => {
  it("allows an empty profile and a valid URL, and rejects an invalid URL", () => {
    expect(validateLinkedInProfile(undefined)).toEqual({ ok: true, value: "" });
    expect(validateLinkedInProfile("  https://www.linkedin.com/in/asha  ")).toEqual({
      ok: true,
      value: "https://www.linkedin.com/in/asha",
    });
    expect(validateLinkedInProfile("not a url").ok).toBe(false);
    expect(validateLinkedInProfile("javascript:alert(1)").ok).toBe(false);
  });
});

describe("SMS content", () => {
  it("accepts 300 characters and rejects 301 without changing the submitted text", () => {
    const accepted = "a".repeat(SMS_CONTENT_MAX_LENGTH);
    const rejected = "b".repeat(SMS_CONTENT_MAX_LENGTH + 1);
    expect(validateSmsContent(accepted)).toBeNull();
    expect(validateSmsContent(rejected)).toBe(SMS_CONTENT_TOO_LONG_MESSAGE);
    expect(rejected).toHaveLength(301);
    expect(
      validatePartnerPortalContent({ portalSmsContent: rejected })
    ).toBe(SMS_CONTENT_TOO_LONG_MESSAGE);
  });
});

describe("uploads", () => {
  const extensions = ["svg", "png", "jpg", "jpeg", "pdf", "cdr", "ai", "eps"];

  it("accepts each allowed extension, including uppercase, at exactly 40 MB", () => {
    for (const extension of extensions) {
      expect(
        validateUploadFile({
          fileName: `creative.${extension}`,
          fileSizeBytes: 12,
        })
      ).toBeNull();
      expect(
        validateUploadFile({
          fileName: `creative.${extension.toUpperCase()}`,
          fileSizeBytes: MAX_UPLOAD_BYTES,
        })
      ).toBeNull();
    }
  });

  it("rejects an unsupported extension and a file larger than 40 MB", () => {
    expect(
      validateUploadFile({ fileName: "notes.docx", fileSizeBytes: 20 })
    ).toBe(UNSUPPORTED_FILE_MESSAGE);
    expect(
      validateUploadFile({
        fileName: "banner.png",
        fileSizeBytes: MAX_UPLOAD_BYTES + 1,
      })
    ).toBe(OVERSIZE_FILE_MESSAGE);
    expect(
      validatePartnerPortalContent({
        portalDocuments: [
          {
            id: "doc-1",
            kind: "logo",
            label: "Logo",
            fileName: "logo.exe",
            mimeType: "application/octet-stream",
            url: "https://example.com/logo.exe",
            fileSizeBytes: 10,
            uploadedAt: "2026-10-01T00:00:00.000Z",
          },
        ],
      })
    ).toBe(UNSUPPORTED_FILE_MESSAGE);
  });

  it("does not advertise formats or the size limit in the upload control", () => {
    const source = readFileSync(
      path.join(root, "components/shared/file-upload.tsx"),
      "utf8"
    );
    expect(source).toContain("accept = PORTAL_UPLOAD_ACCEPT");
    expect(source).toContain("Drag and drop files here, or click to browse");
    expect(source).not.toContain("40 MB");
    expect(source).not.toContain("Supported");
  });
});

describe("advertisement labels", () => {
  it("shows the required Careers After +2 dimensions", () => {
    expect(deliverableOptionLabel("full page")).toBe(
      'Full Page (6.5" W × 4.75" H)'
    );
    expect(deliverableOptionLabel("half page")).toBe(
      'Half Page (6.5" W × 9.5" H)'
    );
    expect(deliverableOptionLabel("full page")).not.toMatch(/MB|PDF|PNG/i);
  });
});

describe("stored upload size", () => {
  it("rejects a data URL whose decoded bytes exceed 40 MB", () => {
    const payload = Buffer.alloc(MAX_UPLOAD_BYTES + 1).toString("base64");
    expect(
      validateStoredUpload({
        fileName: "logo.png",
        fileSizeBytes: 10,
        url: `data:image/png;base64,${payload}`,
      })
    ).toBe(OVERSIZE_FILE_MESSAGE);
  });
});
