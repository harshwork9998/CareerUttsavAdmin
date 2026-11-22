import { detectMobileColumn, type SpreadsheetMatrix } from "@/lib/server/whatsapp/campaign-import";

export type ParsedSpreadsheet = {
  headers: string[];
  rows: SpreadsheetMatrix;
  detectedMobileColumn: string | null;
};

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

export function parseCsvBuffer(buffer: Buffer): ParsedSpreadsheet {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [], detectedMobileColumn: null };
  }
  const headers = splitCsvLine(lines[0]!);
  const rows = lines.slice(1).map((line) => splitCsvLine(line));
  return {
    headers,
    rows,
    detectedMobileColumn: detectMobileColumn(headers),
  };
}

export async function parseXlsxBuffer(buffer: Buffer): Promise<ParsedSpreadsheet> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { headers: [], rows: [], detectedMobileColumn: null };
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return { headers: [], rows: [], detectedMobileColumn: null };
  }

  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  }) as SpreadsheetMatrix;

  const nonEmpty = matrix.filter((row) =>
    row.some((cell) => String(cell ?? "").trim().length > 0)
  );
  if (nonEmpty.length === 0) {
    return { headers: [], rows: [], detectedMobileColumn: null };
  }

  const headers = (nonEmpty[0] ?? []).map((cell) => String(cell).trim());
  const rows = nonEmpty.slice(1).map((row) =>
    headers.map((_, index) => String(row[index] ?? "").trim())
  );

  return {
    headers,
    rows,
    detectedMobileColumn: detectMobileColumn(headers),
  };
}

export async function parseContactUploadBuffer(input: {
  fileName: string;
  buffer: Buffer;
}): Promise<ParsedSpreadsheet> {
  const lower = input.fileName.toLowerCase();
  if (lower.endsWith(".csv")) {
    return parseCsvBuffer(input.buffer);
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return parseXlsxBuffer(input.buffer);
  }
  throw new Error("Unsupported file type. Upload a .csv or .xlsx file.");
}