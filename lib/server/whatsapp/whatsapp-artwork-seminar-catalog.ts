import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CAREER_UTTSAV_SEMINARS } from "@/features/dashboard/seminars";
import type { SeminarOption, WhatsAppBotAction } from "@/lib/server/whatsapp/registration-conversation";

export const WHATSAPP_SEMINAR_ARTWORK_PATH =
  "public/whatsapp/career-uttsav-2026-seminars.png";

export const WHATSAPP_SEMINAR_IMAGE_CAPTION = `🎤 Now build your Career Uttsav shortlist.

Pick up to 3 sessions you’d genuinely like to attend.

Don’t worry - you’re not locking yourself in. This just helps us understand what interests you.

Reply with up to 3 session numbers, separated by commas.
Example: 2 or 2,8 or 2,8,14`;

export const WHATSAPP_SEMINAR_TOO_MANY_SESSIONS_MESSAGE = `You can select a maximum of 3 sessions.

Please reply with up to 3 session numbers, separated by commas.
Example: 2,8,14`;

export const WHATSAPP_SEMINAR_MALFORMED_INPUT_MESSAGE = `Please reply using the session numbers shown in the image, separated by commas.

Example: 2,8,14`;

export const WHATSAPP_SEMINAR_OUT_OF_RANGE_MESSAGE = `Please choose session numbers from 1 to 14.

Example: 2,8,14`;

export const WHATSAPP_SEMINAR_DUPLICATE_NUMBER_MESSAGE = `You’ve selected the same session more than once.

Please choose different session numbers.
Example: 2,8`;

export const WHATSAPP_SEMINAR_FINISH_SAVED_ONE = `Good pick! 👌
I’ve saved it for you.

Tap Finish Registration to continue.`;

export const WHATSAPP_SEMINAR_FINISH_SAVED_TWO = `Nice picks! 👌
I’ve saved them for you.

Tap Finish Registration to continue.`;

export const WHATSAPP_SEMINAR_FINISH_SAVED_THREE = `That’s your three! 🎯
I’ve saved them for you.

Tap Finish Registration to continue.`;

export const WHATSAPP_SEMINAR_FINISH_REMINDER_PROMPT = `I’ve saved your seminar choices.

Tap Finish Registration to continue.`;

export const WHATSAPP_SEMINAR_FINISH_BUTTON_TITLE = "Finish Registration";

export type ArtworkSeminarDefinition = {
  number: number;
  title: string;
  day: 1 | 2;
};

export const WHATSAPP_ARTWORK_SEMINAR_DEFINITIONS: readonly ArtworkSeminarDefinition[] =
  CAREER_UTTSAV_SEMINARS.map((title, index) => ({
    number: index + 1,
    title,
    day: (index < 7 ? 1 : 2) as 1 | 2,
  }));

export type ArtworkSeminarSelectionParseError =
  | "TOO_MANY_SELECTIONS"
  | "DUPLICATE_SELECTION"
  | "OUT_OF_RANGE"
  | "MALFORMED";

export type ParsedArtworkSeminarSelection =
  | { ok: true; seminarIds: string[]; numbers: number[] }
  | { ok: false; error: ArtworkSeminarSelectionParseError };

export type ArtworkSeminarResolution = {
  numberToId: Map<number, string>;
  idToNumber: Map<string, number>;
  idToTitle: Map<string, string>;
};

export class ArtworkSeminarMappingError extends Error {
  readonly unmatched: Array<{ number: number; title: string }>;

  constructor(unmatched: Array<{ number: number; title: string }>) {
    super(
      `Unable to map artwork seminars to registration records: ${unmatched
        .map((entry) => `#${entry.number} ${entry.title}`)
        .join("; ")}`
    );
    this.unmatched = unmatched;
  }
}

export function eventArtworkSeminarsToSeminarOptions(
  eventSeminars: Array<{
    id: string;
    title: string;
    date?: string | null;
    startTime?: string | null;
  }>
): SeminarOption[] {
  return eventSeminars
    .filter((seminar) => seminar.id && seminar.title?.trim())
    .map((seminar) => ({
      id: seminar.id,
      title: seminar.title.trim(),
      date: seminar.date ?? undefined,
      startTime: seminar.startTime ?? undefined,
    }));
}

/**
 * Maps artwork numbers to real current-event seminar IDs only.
 * Matches the current canonical titles to real event seminar IDs.
 * Does not fall back to the legacy 20-title catalogue.
 */
export function resolveArtworkSeminarSelection(
  eventArtworkSeminarOptions: SeminarOption[]
): ArtworkSeminarResolution {
  const numberToId = new Map<number, string>();
  const idToNumber = new Map<string, number>();
  const idToTitle = new Map<string, string>();
  const unmatched: Array<{ number: number; title: string }> = [];
  const seenIds = new Map<string, number>();

  for (const definition of WHATSAPP_ARTWORK_SEMINAR_DEFINITIONS) {
    const matches = eventArtworkSeminarOptions.filter(
      (option) => option.title.trim() === definition.title
    );

    if (matches.length === 0) {
      unmatched.push({ number: definition.number, title: definition.title });
      continue;
    }

    if (matches.length > 1) {
      throw new ArtworkSeminarMappingError([
        {
          number: definition.number,
          title: `${definition.title} (duplicate event records)`,
        },
      ]);
    }

    const match = matches[0]!;
    const priorNumber = seenIds.get(match.id);
    if (priorNumber !== undefined) {
      throw new ArtworkSeminarMappingError([
        {
          number: definition.number,
          title: `${definition.title} (shares event ID with #${priorNumber})`,
        },
      ]);
    }

    seenIds.set(match.id, definition.number);
    numberToId.set(definition.number, match.id);
    idToNumber.set(match.id, definition.number);
    idToTitle.set(match.id, definition.title);
  }

  if (unmatched.length > 0) {
    throw new ArtworkSeminarMappingError(unmatched);
  }

  return { numberToId, idToNumber, idToTitle };
}

function tokenizeSelectionInput(input: string): string[] {
  return input
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

function isNumericToken(token: string): boolean {
  return /^[1-9][0-9]*$/.test(token);
}

export function parseArtworkSeminarSelectionInput(
  input: string,
  resolution: ArtworkSeminarResolution
): ParsedArtworkSeminarSelection {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "MALFORMED" };
  }

  const tokens = tokenizeSelectionInput(trimmed);
  if (tokens.length === 0) {
    return { ok: false, error: "MALFORMED" };
  }
  if (tokens.length > 3) {
    return { ok: false, error: "TOO_MANY_SELECTIONS" };
  }

  const resolvedIds: string[] = [];
  const resolvedNumbers: number[] = [];
  const seenNumbers = new Set<number>();

  for (const token of tokens) {
    if (!isNumericToken(token)) {
      return { ok: false, error: "MALFORMED" };
    }

    const position = Number.parseInt(token, 10);
    if (position < 1 || position > 14) {
      return { ok: false, error: "OUT_OF_RANGE" };
    }

    const seminarId = resolution.numberToId.get(position);
    if (!seminarId) {
      return { ok: false, error: "OUT_OF_RANGE" };
    }

    if (seenNumbers.has(position)) {
      return { ok: false, error: "DUPLICATE_SELECTION" };
    }

    seenNumbers.add(position);
    resolvedNumbers.push(position);
    resolvedIds.push(seminarId);
  }

  if (resolvedIds.length === 0) {
    return { ok: false, error: "MALFORMED" };
  }

  return { ok: true, seminarIds: resolvedIds, numbers: resolvedNumbers };
}

export function artworkSeminarSelectionErrorActions(
  error: ArtworkSeminarSelectionParseError
): Array<{ type: "TEXT"; body: string }> {
  switch (error) {
    case "TOO_MANY_SELECTIONS":
      return [{ type: "TEXT", body: WHATSAPP_SEMINAR_TOO_MANY_SESSIONS_MESSAGE }];
    case "DUPLICATE_SELECTION":
      return [{ type: "TEXT", body: WHATSAPP_SEMINAR_DUPLICATE_NUMBER_MESSAGE }];
    case "OUT_OF_RANGE":
      return [{ type: "TEXT", body: WHATSAPP_SEMINAR_OUT_OF_RANGE_MESSAGE }];
    case "MALFORMED":
      return [{ type: "TEXT", body: WHATSAPP_SEMINAR_MALFORMED_INPUT_MESSAGE }];
  }
}

export function seminarFinishAcknowledgementBody(
  selectionCount: number
): string {
  if (selectionCount === 1) {
    return WHATSAPP_SEMINAR_FINISH_SAVED_ONE;
  }
  if (selectionCount === 2) {
    return WHATSAPP_SEMINAR_FINISH_SAVED_TWO;
  }
  return WHATSAPP_SEMINAR_FINISH_SAVED_THREE;
}

export function selectedArtworkSeminarIdsStillValid(
  selectedSeminarIds: string[],
  resolution: ArtworkSeminarResolution
): boolean {
  if (selectedSeminarIds.length === 0) {
    return false;
  }

  const allowedIds = new Set(resolution.idToNumber.keys());
  return selectedSeminarIds.every((seminarId) => allowedIds.has(seminarId));
}

export function buildSeminarArtworkSummaryBody(
  selectedSeminarIds: string[],
  resolution: ArtworkSeminarResolution
): string {
  const day1Titles: string[] = [];
  const day2Titles: string[] = [];

  for (const seminarId of selectedSeminarIds) {
    const number = resolution.idToNumber.get(seminarId);
    const title = resolution.idToTitle.get(seminarId);
    if (!number || !title) {
      continue;
    }
    if (number >= 1 && number <= 7) {
      day1Titles.push(title);
    } else if (number >= 8 && number <= 14) {
      day2Titles.push(title);
    }
  }

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

let cachedSeminarArtworkBase64: string | null = null;

export function readWhatsAppSeminarArtworkBase64(): string {
  if (cachedSeminarArtworkBase64) {
    return cachedSeminarArtworkBase64;
  }

  const absolutePath = join(process.cwd(), WHATSAPP_SEMINAR_ARTWORK_PATH);
  const buffer = readFileSync(absolutePath);
  cachedSeminarArtworkBase64 = buffer.toString("base64");
  return cachedSeminarArtworkBase64;
}

export function buildWhatsAppSeminarPickerMediaAction(): WhatsAppBotAction {
  return {
    type: "MEDIA",
    mimeType: "image/png",
    filename: "career-uttsav-2026-seminars.png",
    contentBase64: readWhatsAppSeminarArtworkBase64(),
    caption: WHATSAPP_SEMINAR_IMAGE_CAPTION,
  };
}

export function whatsAppSeminarPickerActions(): WhatsAppBotAction[] {
  return [buildWhatsAppSeminarPickerMediaAction()];
}
