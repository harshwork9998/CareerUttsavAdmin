import type { PartnerPortalDocumentKind } from "@/types";

export const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;

export const DOCUMENT_UPLOAD_EXTENSIONS = [
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".pdf",
  ".cdr",
  ".ai",
  ".eps",
] as const;

export const SPEAKER_PHOTO_EXTENSIONS = [".svg", ".png", ".jpg", ".jpeg"] as const;

export const PORTAL_UPLOAD_ACCEPT = DOCUMENT_UPLOAD_EXTENSIONS.join(",");
export const PORTAL_SPEAKER_PHOTO_ACCEPT = SPEAKER_PHOTO_EXTENSIONS.join(",");

export const PORTAL_DOCUMENT_FORMAT_LABEL =
  "SVG, PNG, JPG, PDF, CDR, AI or EPS";
export const PORTAL_SPEAKER_PHOTO_FORMAT_LABEL = "SVG, PNG or JPG";

export const AD_CREATIVE_UNSUPPORTED_MESSAGE =
  `Please upload ${PORTAL_DOCUMENT_FORMAT_LABEL}.`;

export const UNSUPPORTED_FILE_MESSAGE = AD_CREATIVE_UNSUPPORTED_MESSAGE;

export const SPEAKER_PHOTO_UNSUPPORTED_MESSAGE =
  `Please upload ${PORTAL_SPEAKER_PHOTO_FORMAT_LABEL}.`;

export const OVERSIZE_FILE_MESSAGE = "File size exceeds the 40 MB limit.";

export const PORTAL_STORAGE_SIZE_MESSAGE =
  "This file exceeds the current storage upload limit. Please contact the Career Uttsav team.";

export const PORTAL_ZERO_BYTE_MESSAGE = "The selected file is empty.";

export const PORTAL_UPLOAD_CONFLICT_MESSAGE =
  "This file was updated from another session. The latest submitted file has been kept.";

const DOCUMENT_EXTENSION_SET = new Set<string>(DOCUMENT_UPLOAD_EXTENSIONS);
const SPEAKER_PHOTO_EXTENSION_SET = new Set<string>(SPEAKER_PHOTO_EXTENSIONS);

const GENERIC_MIME_TYPES = new Set([
  "",
  "application/octet-stream",
  "binary/octet-stream",
  "application/download",
  "application/x-download",
  "application/force-download",
  "application/x-msdownload",
]);

const MIME_ALIASES_BY_EXT: Record<string, Set<string>> = {
  ".svg": new Set(["image/svg+xml", "image/svg", "text/xml", "application/xml"]),
  ".png": new Set(["image/png", "image/x-png"]),
  ".jpg": new Set(["image/jpeg", "image/jpg", "image/pjpeg"]),
  ".jpeg": new Set(["image/jpeg", "image/jpg", "image/pjpeg"]),
  ".pdf": new Set(["application/pdf", "application/x-pdf"]),
  ".cdr": new Set([
    "application/cdr",
    "application/x-cdr",
    "application/coreldraw",
    "application/x-coreldraw",
    "application/vnd.corel-draw",
    "image/cdr",
    "image/x-coreldraw",
  ]),
  ".ai": new Set([
    "application/postscript",
    "application/illustrator",
    "application/vnd.adobe.illustrator",
    "application/pdf",
  ]),
  ".eps": new Set([
    "application/postscript",
    "application/eps",
    "application/x-eps",
    "image/eps",
    "image/x-eps",
  ]),
};

const DESIGN_EXTENSIONS = new Set([".cdr", ".ai", ".eps"]);

export function fileExtension(fileName: string): string {
  const base = fileName.trim().split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot).toLowerCase();
}

export function normalizeUploadMime(mimeType?: string | null): string {
  return (mimeType ?? "").trim().toLowerCase().split(";")[0]?.trim() ?? "";
}

export function isGenericUploadMime(mimeType?: string | null): boolean {
  return GENERIC_MIME_TYPES.has(normalizeUploadMime(mimeType));
}

export function mimeAllowedForExtension(
  extension: string,
  mimeType?: string | null
): boolean {
  const mime = normalizeUploadMime(mimeType);
  if (isGenericUploadMime(mime)) return true;
  const aliases = MIME_ALIASES_BY_EXT[extension];
  if (aliases?.has(mime)) return true;
  return DESIGN_EXTENSIONS.has(extension);
}

export function resolvedUploadContentType(
  fileName: string,
  mimeType?: string | null
): string {
  const mime = normalizeUploadMime(mimeType);
  if (mime && !isGenericUploadMime(mime)) return mime;
  return (
    {
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".pdf": "application/pdf",
      ".cdr": "application/octet-stream",
      ".ai": "application/postscript",
      ".eps": "application/postscript",
    }[fileExtension(fileName)] ?? "application/octet-stream"
  );
}

export function isBrowserPreviewableImage(
  fileName?: string | null,
  mimeType?: string | null
): boolean {
  const extension = fileExtension(fileName ?? "");
  if (extension === ".png" || extension === ".jpg" || extension === ".jpeg" || extension === ".svg") {
    return true;
  }
  const mime = normalizeUploadMime(mimeType);
  return mime === "image/png" || mime === "image/jpeg" || mime === "image/jpg" || mime === "image/svg+xml";
}

export type PortalUploadKindPolicy = "default" | "ad_creative" | "speaker_photo";

export function validateUploadFile(input: {
  fileName: string;
  fileSizeBytes: number;
  kind?: PortalUploadKindPolicy;
  mimeType?: string;
}): string | null {
  const extension = fileExtension(input.fileName);
  const kind = input.kind ?? "default";
  const allowed =
    kind === "speaker_photo" ? SPEAKER_PHOTO_EXTENSION_SET : DOCUMENT_EXTENSION_SET;
  const unsupported =
    kind === "speaker_photo"
      ? SPEAKER_PHOTO_UNSUPPORTED_MESSAGE
      : AD_CREATIVE_UNSUPPORTED_MESSAGE;
  if (!allowed.has(extension)) {
    return unsupported;
  }
  if (
    !Number.isFinite(input.fileSizeBytes) ||
    input.fileSizeBytes < 0 ||
    input.fileSizeBytes === 0
  ) {
    return PORTAL_ZERO_BYTE_MESSAGE;
  }
  if (kind !== "ad_creative" && input.fileSizeBytes > MAX_UPLOAD_BYTES) {
    return OVERSIZE_FILE_MESSAGE;
  }

  if (!mimeAllowedForExtension(extension, input.mimeType)) {
    return unsupported;
  }

  return null;
}

export function dataUrlByteLength(url: string): number | null {
  const marker = ";base64,";
  const index = url.indexOf(marker);
  if (!url.startsWith("data:") || index === -1) return null;
  const payload = url.slice(index + marker.length).replace(/\s+/g, "");
  if (!payload) return 0;
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.floor((payload.length * 3) / 4) - padding;
}

export function validateStoredUpload(input: {
  fileName: string;
  fileSizeBytes: number;
  url?: string;
  kind?: PartnerPortalDocumentKind | "speaker_photo";
  storagePath?: string;
}): string | null {
  const storageBacked = Boolean(input.storagePath?.trim());
  const policy: PortalUploadKindPolicy =
    input.kind === "ad_creative"
      ? "ad_creative"
      : input.kind === "speaker_photo"
        ? "speaker_photo"
        : "default";
  if (storageBacked && (!Number.isFinite(input.fileSizeBytes) || input.fileSizeBytes <= 0)) {
    return PORTAL_ZERO_BYTE_MESSAGE;
  }

  const fileError = validateUploadFile({
    fileName: input.fileName,
    fileSizeBytes: input.fileSizeBytes,
    kind: policy,
  });
  if (fileError) return fileError;

  if (typeof input.url === "string" && input.url.startsWith("data:")) {
    const decoded = dataUrlByteLength(input.url);
    if (decoded !== null && decoded === 0) {
      return PORTAL_ZERO_BYTE_MESSAGE;
    }
    if (
      policy !== "ad_creative" &&
      decoded !== null &&
      decoded > MAX_UPLOAD_BYTES
    ) {
      return OVERSIZE_FILE_MESSAGE;
    }
  }
  return null;
}
