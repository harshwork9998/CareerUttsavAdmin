export const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;

export const PORTAL_UPLOAD_ACCEPT =
  ".svg,.png,.jpg,.jpeg,.pdf,.cdr,.ai,.eps";

export const UNSUPPORTED_FILE_MESSAGE =
  "Unsupported file format. Please upload a valid file.";

export const OVERSIZE_FILE_MESSAGE = "File size exceeds the 40 MB limit.";

const ALLOWED_EXTENSIONS = new Set([
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".pdf",
  ".cdr",
  ".ai",
  ".eps",
]);

export function fileExtension(fileName: string): string {
  const base = fileName.trim().split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot).toLowerCase();
}

export function validateUploadFile(input: {
  fileName: string;
  fileSizeBytes: number;
}): string | null {
  if (!ALLOWED_EXTENSIONS.has(fileExtension(input.fileName))) {
    return UNSUPPORTED_FILE_MESSAGE;
  }
  if (
    !Number.isFinite(input.fileSizeBytes) ||
    input.fileSizeBytes < 0 ||
    input.fileSizeBytes > MAX_UPLOAD_BYTES
  ) {
    return OVERSIZE_FILE_MESSAGE;
  }
  return null;
}

export function dataUrlByteLength(url: string): number | null {
  const marker = ";base64,";
  const index = url.indexOf(marker);
  if (!url.startsWith("data:") || index === -1) return null;
  const payload = url.slice(index + marker.length).replace(/\s/g, "");
  if (!payload) return 0;
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.floor((payload.length * 3) / 4) - padding;
}

export function validateStoredUpload(input: {
  fileName: string;
  fileSizeBytes: number;
  url?: string;
}): string | null {
  const fileError = validateUploadFile(input);
  if (fileError) return fileError;
  if (typeof input.url === "string" && input.url.startsWith("data:")) {
    const decoded = dataUrlByteLength(input.url);
    if (decoded !== null && decoded > MAX_UPLOAD_BYTES) {
      return OVERSIZE_FILE_MESSAGE;
    }
  }
  return null;
}
