import type { SeminarOption } from "@/lib/server/whatsapp/registration-conversation";

export type WhatsAppSeminarDayCatalog = {
  day1: SeminarOption[];
  day2: SeminarOption[];
  day1Date: string | null;
  day2Date: string | null;
};

export const WHATSAPP_SEMINAR_INVALID_SELECTION_MESSAGE = `Please choose up to 3 seminars using the numbers or letters shown above.

Examples:
2
2,7
2,b,j`;

export const WHATSAPP_SEMINAR_FINISH_PROMPT = `Your seminar choices have been recorded.

Tap Finish Registration to continue.`;

export const WHATSAPP_LEGACY_SEMINAR_MIGRATION_MESSAGE =
  "Our seminar options have been updated. Please choose your seminar preferences below.";

export const WHATSAPP_STALE_SEMINAR_RECOVERY_MESSAGE =
  "One or more seminar options have changed. Please choose your seminar preferences again.";

export function catalogSeminarIds(
  catalog: WhatsAppSeminarDayCatalog
): Set<string> {
  return new Set([
    ...catalog.day1.map((seminar) => seminar.id),
    ...catalog.day2.map((seminar) => seminar.id),
  ]);
}

export function selectedSeminarsStillValidInCatalog(
  selectedSeminarIds: string[],
  catalog: WhatsAppSeminarDayCatalog
): boolean {
  if (selectedSeminarIds.length === 0) {
    return false;
  }

  const validIds = catalogSeminarIds(catalog);
  return selectedSeminarIds.every(
    (seminarId) => validIds.has(seminarId) || seminarId.startsWith("cat-")
  );
}

const COMBINED_MESSAGE_HEADER =
  "Choose up to 3 seminars you'd like to attend.";

const COMBINED_MESSAGE_FOOTER = `Reply with the seminar numbers/letters separated by commas.

Examples:
2
2,7
2,b,j

You can choose a maximum of 3 seminars in total.`;

function eachDayInclusive(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function compareSeminarOrder(a: SeminarOption, b: SeminarOption): number {
  const timeCompare = (a.startTime ?? "").localeCompare(b.startTime ?? "");
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.title.localeCompare(b.title);
}

/**
 * Groups scheduled seminars into Day 1 / Day 2 using explicit seminar.date values
 * and the event date range. Only seminars with a date are included.
 */
export function buildWhatsAppSeminarDayCatalog(
  seminarOptions: SeminarOption[],
  eventStartDate?: string | null,
  eventEndDate?: string | null
): WhatsAppSeminarDayCatalog {
  const scheduled = seminarOptions.filter((option) => option.date?.trim());
  if (!eventStartDate || !eventEndDate || scheduled.length === 0) {
    return {
      day1: [],
      day2: [],
      day1Date: null,
      day2Date: null,
    };
  }

  const eventDays = eachDayInclusive(eventStartDate, eventEndDate);
  const day1Date = eventDays[0] ?? null;
  const day2Date = eventDays[1] ?? null;

  const day1 = scheduled
    .filter((option) => option.date === day1Date)
    .sort(compareSeminarOrder);
  const day2 = scheduled
    .filter((option) => option.date === day2Date)
    .sort(compareSeminarOrder);

  return {
    day1,
    day2,
    day1Date,
    day2Date,
  };
}

export function indexToDay2Letter(index: number): string {
  if (index < 0 || index > 25) {
    throw new Error(`Day 2 display index out of range: ${index}`);
  }
  return String.fromCharCode(97 + index);
}

export function day2LetterToIndex(letter: string): number | null {
  const normalized = letter.trim().toLowerCase();
  if (normalized.length !== 1 || normalized < "a" || normalized > "z") {
    return null;
  }
  return normalized.charCodeAt(0) - 97;
}

function formatDay1Lines(day1: SeminarOption[]): string[] {
  return day1.map((seminar, index) => `${index + 1}. ${seminar.title}`);
}

function formatDay2Lines(day2: SeminarOption[]): string[] {
  return day2.map(
    (seminar, index) => `${indexToDay2Letter(index)}. ${seminar.title}`
  );
}

export function formatCombinedSeminarSelectionMessage(
  catalog: WhatsAppSeminarDayCatalog
): string {
  const sections: string[] = [COMBINED_MESSAGE_HEADER];

  if (catalog.day1.length > 0) {
    sections.push("", "Day 1", "", ...formatDay1Lines(catalog.day1));
  }

  if (catalog.day2.length > 0) {
    sections.push("", "Day 2", "", ...formatDay2Lines(catalog.day2));
  }

  sections.push("", COMBINED_MESSAGE_FOOTER);
  return sections.join("\n");
}

export type ParsedSeminarSelection =
  | { ok: true; seminarIds: string[] }
  | { ok: false };

function tokenizeSelectionInput(input: string): string[] {
  return input
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

function isNumericToken(token: string): boolean {
  return /^[1-9][0-9]*$/.test(token);
}

function isAlphaToken(token: string): boolean {
  return /^[a-zA-Z]$/.test(token);
}

export function parseSeminarSelectionInput(
  input: string,
  catalog: WhatsAppSeminarDayCatalog
): ParsedSeminarSelection {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false };
  }

  const tokens = tokenizeSelectionInput(trimmed);
  if (tokens.length === 0 || tokens.length > 3) {
    return { ok: false };
  }

  const resolvedIds: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    if (!isNumericToken(token) && !isAlphaToken(token)) {
      return { ok: false };
    }

    if (isNumericToken(token)) {
      const position = Number.parseInt(token, 10);
      const seminar = catalog.day1[position - 1];
      if (!seminar) {
        return { ok: false };
      }
      const key = `d1:${seminar.id}`;
      if (seen.has(key)) {
        return { ok: false };
      }
      seen.add(key);
      resolvedIds.push(seminar.id);
      continue;
    }

    const index = day2LetterToIndex(token);
    if (index === null) {
      return { ok: false };
    }
    const seminar = catalog.day2[index];
    if (!seminar) {
      return { ok: false };
    }
    const key = `d2:${seminar.id}`;
    if (seen.has(key)) {
      return { ok: false };
    }
    seen.add(key);
    resolvedIds.push(seminar.id);
  }

  if (resolvedIds.length === 0) {
    return { ok: false };
  }

  return { ok: true, seminarIds: resolvedIds };
}

export function buildSeminarFinishSummaryBody(
  catalog: WhatsAppSeminarDayCatalog,
  selectedSeminarIds: string[],
  seminarOptions: SeminarOption[]
): string {
  const optionById = new Map(seminarOptions.map((option) => [option.id, option]));
  const day1Titles = selectedSeminarIds
    .filter((id) => catalog.day1.some((seminar) => seminar.id === id))
    .map((id) => optionById.get(id)?.title ?? "")
    .filter(Boolean);
  const day2Titles = selectedSeminarIds
    .filter((id) => catalog.day2.some((seminar) => seminar.id === id))
    .map((id) => optionById.get(id)?.title ?? "")
    .filter(Boolean);

  const lines = ["✅ Seminar preferences selected", ""];

  if (day1Titles.length > 0) {
    lines.push("Day 1");
    for (const title of day1Titles) {
      lines.push(`• ${title}`);
    }
    lines.push("");
  }

  if (day2Titles.length > 0) {
    lines.push("Day 2");
    for (const title of day2Titles) {
      lines.push(`• ${title}`);
    }
    lines.push("");
  }

  lines.push("Your seminar preferences are saved. Completing your registration...");
  return lines.join("\n");
}

export function combinedSeminarSelectionActions(
  catalog: WhatsAppSeminarDayCatalog
): Array<{ type: "TEXT"; body: string }> {
  return [
    {
      type: "TEXT",
      body: formatCombinedSeminarSelectionMessage(catalog),
    },
  ];
}

export function invalidSeminarSelectionActions(
  catalog: WhatsAppSeminarDayCatalog
): Array<{ type: "TEXT"; body: string }> {
  return [
    { type: "TEXT", body: WHATSAPP_SEMINAR_INVALID_SELECTION_MESSAGE },
    ...combinedSeminarSelectionActions(catalog),
  ];
}
