import { describe, expect, it } from "vitest";

import {
  isBrowserPreviewableImage,
  MAX_UPLOAD_BYTES,
  mimeAllowedForExtension,
  PORTAL_SPEAKER_PHOTO_ACCEPT,
  PORTAL_UPLOAD_ACCEPT,
  SPEAKER_PHOTO_UNSUPPORTED_MESSAGE,
  UNSUPPORTED_FILE_MESSAGE,
  validateUploadFile,
} from "@/lib/partner-upload-policy";

describe("partner upload format policy", () => {
  it.each([
    ["file.svg", "image/svg+xml;charset=utf-8"],
    ["file.png", "application/octet-stream"],
    ["file.jpg", "image/jpeg"],
    ["file.jpeg", ""],
    ["file.pdf", "application/pdf"],
    ["file.cdr", ""],
    ["file.ai", "application/postscript"],
    ["file.eps", "application/octet-stream"],
  ])("accepts %s with MIME %s", (fileName, mimeType) => {
    expect(
      validateUploadFile({ fileName, fileSizeBytes: 20, mimeType })
    ).toBeNull();
  });

  it("rejects a PNG whose MIME is an unrelated HTML type", () => {
    expect(
      validateUploadFile({
        fileName: "file.png",
        fileSizeBytes: 20,
        mimeType: "text/html",
      })
    ).toBe(UNSUPPORTED_FILE_MESSAGE);
  });

  it("keeps speaker photographs image-only", () => {
    expect(
      validateUploadFile({
        fileName: "speaker.pdf",
        fileSizeBytes: 20,
        kind: "speaker_photo",
      })
    ).toBe(SPEAKER_PHOTO_UNSUPPORTED_MESSAGE);
    expect(PORTAL_SPEAKER_PHOTO_ACCEPT).toBe(".svg,.png,.jpg,.jpeg");
  });

  it("preserves size policy", () => {
    expect(
      validateUploadFile({
        fileName: "logo.png",
        fileSizeBytes: MAX_UPLOAD_BYTES + 1,
      })
    ).not.toBeNull();
    expect(
      validateUploadFile({
        fileName: "ad.ai",
        fileSizeBytes: MAX_UPLOAD_BYTES + 1,
        kind: "ad_creative",
      })
    ).toBeNull();
  });

  it("treats empty and generic MIME as allowed for design formats", () => {
    expect(mimeAllowedForExtension(".cdr", "")).toBe(true);
    expect(mimeAllowedForExtension(".ai", "application/octet-stream")).toBe(true);
    expect(PORTAL_UPLOAD_ACCEPT).toBe(".svg,.png,.jpg,.jpeg,.pdf,.cdr,.ai,.eps");
  });

  it("does not treat PDF or design files as browser-previewable images", () => {
    expect(isBrowserPreviewableImage("file.png", "image/png")).toBe(true);
    expect(isBrowserPreviewableImage("file.pdf", "application/pdf")).toBe(false);
    expect(isBrowserPreviewableImage("file.cdr", "")).toBe(false);
  });
});
