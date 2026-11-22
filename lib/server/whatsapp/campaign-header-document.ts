const MAX_PDF_BYTES = 16 * 1024 * 1024;

export function validateCampaignPdfBuffer(buffer: Buffer, fileName: string): string | null {
  if (buffer.length === 0) {
    return "Choose a PDF file to upload.";
  }
  if (buffer.length > MAX_PDF_BYTES) {
    return "The PDF is too large. Use a file under 16 MB.";
  }
  if (!buffer.subarray(0, 5).toString("utf8").startsWith("%PDF-")) {
    return "Only PDF files are allowed.";
  }
  if (!fileName.toLowerCase().endsWith(".pdf")) {
    return "The file must have a .pdf extension.";
  }
  return null;
}