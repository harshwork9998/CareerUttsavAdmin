import { normalizeIndianMobileInput } from "@/lib/indian-mobile";
import { toWhatsAppRecipientWaId } from "@/lib/server/whatsapp/campaign-phone";

export type ParsedContactRow = {
  rowNumber: number;
  waId: string;
  phoneLast10: string;
  rowData: Record<string, string>;
};

export type ContactImportSkip = {
  rowNumber: number;
  reason: string;
};

export type ContactImportResult = {
  accepted: ParsedContactRow[];
  skipped: ContactImportSkip[];
  duplicateCount: number;
  invalidCount: number;
  emptyCount: number;
};

export type SpreadsheetMatrix = string[][];

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

export function detectMobileColumn(headers: string[]): string | null {
  const preferred = [
    "mobile",
    "phone",
    "whatsapp",
    "contact",
    "number",
    "mobilenumber",
    "mobile number",
    "phone number",
  ];
  for (const header of headers) {
    const n = normalizeHeader(header);
    if (preferred.includes(n)) return header;
  }
  for (const header of headers) {
    const n = normalizeHeader(header);
    if (n.includes("mobile") || n.includes("phone")) return header;
  }
  return null;
}

export function matrixFromObjects(
  rows: Record<string, unknown>[]
): { headers: string[]; matrix: SpreadsheetMatrix } {
  if (rows.length === 0) {
    return { headers: [], matrix: [] };
  }
  const headers = Object.keys(rows[0] ?? {});
  const matrix = rows.map((row) =>
    headers.map((header) => String(row[header] ?? "").trim())
  );
  return { headers, matrix };
}

export function parseContactsFromMatrix(input: {
  headers: string[];
  rows: SpreadsheetMatrix;
  mobileColumn: string;
  optedOutLast10: Set<string>;
}): ContactImportResult {
  const accepted: ParsedContactRow[] = [];
  const skipped: ContactImportSkip[] = [];
  const seenWaIds = new Set<string>();

  let duplicateCount = 0;
  let invalidCount = 0;
  let emptyCount = 0;

  const columnIndex = input.headers.findIndex(
    (h) => h === input.mobileColumn
  );
  if (columnIndex < 0) {
    return {
      accepted: [],
      skipped: [{ rowNumber: 0, reason: "Selected mobile column was not found." }],
      duplicateCount: 0,
      invalidCount: 0,
      emptyCount: 0,
    };
  }

  input.rows.forEach((cells, index) => {
    const rowNumber = index + 2;
    const rawMobile = cells[columnIndex]?.trim() ?? "";
    if (!rawMobile) {
      const allEmpty = cells.every((cell) => !cell?.trim());
      if (allEmpty) {
        emptyCount += 1;
        return;
      }
      emptyCount += 1;
      skipped.push({ rowNumber, reason: "Missing mobile number" });
      return;
    }

    const waId = toWhatsAppRecipientWaId(rawMobile);
    const phoneLast10 = normalizeIndianMobileInput(rawMobile);
    if (!waId || !phoneLast10) {
      invalidCount += 1;
      skipped.push({ rowNumber, reason: "Invalid mobile number" });
      return;
    }

    if (input.optedOutLast10.has(phoneLast10)) {
      skipped.push({ rowNumber, reason: "On opt-out list" });
      return;
    }

    if (seenWaIds.has(waId)) {
      duplicateCount += 1;
      skipped.push({ rowNumber, reason: "Duplicate number in file" });
      return;
    }
    seenWaIds.add(waId);

    const rowData: Record<string, string> = {};
    input.headers.forEach((header, i) => {
      rowData[header] = cells[i]?.trim() ?? "";
    });

    accepted.push({
      rowNumber,
      waId,
      phoneLast10,
      rowData,
    });
  });

  return {
    accepted,
    skipped,
    duplicateCount,
    invalidCount,
    emptyCount,
  };
}