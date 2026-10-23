import { readFile } from "fs/promises";
import path from "path";

import { loadSync, type Font } from "opentype.js";
import QRCode from "qrcode";
import sharp from "sharp";

import { CAREER_UTTSAV_SEMINARS } from "@/features/dashboard/seminars";
import { generateRegistrationQrPngBase64 } from "@/lib/email";

export const EVENT_PASS_WIDTH = 1080;
export const EVENT_PASS_HEIGHT = 1350;
export const EVENT_PASS_MIN_QR_PX = 460;
export const EVENT_PASS_QR_MARGIN_MODULES = 4;
export const EVENT_PASS_QR_ERROR_CORRECTION = "H" as const;

export const EVENT_PASS_DATE = "19 \u2013 20 Dec 2026";
export const EVENT_PASS_VENUE_LINES = [
  "Princess Golf, Palace Grounds",
  "Bengaluru",
] as const;

/** Official Career Uttsav mark. Do not substitute another asset. */
export const EVENT_PASS_LOGO_PATH = path.join(
  process.cwd(),
  "public",
  "images",
  "career-uttsav-logo.png"
);

/** Bundled face. Pass text is drawn as outlines so the server font set is irrelevant. */
export const EVENT_PASS_FONT_PATH = path.join(
  process.cwd(),
  "public",
  "fonts",
  "LiberationSans-Bold.ttf"
);

const NAVY = "#0E1848";
const INK = "#1A2344";
const MUTED = "#8B93A3";
const HAIRLINE = "#E3E8EF";
const CARD_X = 64;
const CARD_W = 952;
const LOGO_MAX_WIDTH = 340;
const LOGO_MAX_HEIGHT = 152;
const LOGO_X = 86;
const LOGO_Y = 36;
const SEMINAR_FONT = 30;
const SEMINAR_FONT_COMPACT = 28;
const SEMINAR_CHAR_FACTOR = 0.56;
const CHIP_STYLES = [
  { bg: "#D7EBFD", fg: "#1D4E89" },
  { bg: "#FDE0DE", fg: "#D23B45" },
  { bg: "#D9F8E3", fg: "#178A42" },
] as const;

export class EventPassLayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventPassLayoutError";
  }
}

export type EventPassInput = {
  registrationId: string;
  seminarTitles: readonly string[];
};

export type EventPassLayout = {
  qrSize: number;
  qrX: number;
  qrY: number;
  logoX: number;
  logoY: number;
  logoMaxWidth: number;
  logoMaxHeight: number;
  seminarFontSize: number;
  seminarLineHeight: number;
  seminarLines: string[][];
  seminarNumbers: Array<number | null>;
  dateY: number;
  venueLineYs: number[];
  seminarCardY: number;
  seminarCardHeight: number;
  seminarHeadingY: number;
  seminarRowYs: number[];
  seminarRowHeights: number[];
  registrationCardY: number;
  registrationLabelY: number;
  registrationValueY: number;
};

type StoredSeminarSource = {
  kind?: string;
  seminarInterests?: readonly string[] | null;
} | null | undefined;

export function eventPassQrPayload(registrationId: string): string {
  const value = registrationId.trim();
  if (!value) {
    throw new Error("Registration ID is required for the event pass QR");
  }
  return value;
}

export function canonicalSeminarNumber(title: string): number | null {
  const normalized = title.replace(/\s+/g, " ").trim();
  const index = (CAREER_UTTSAV_SEMINARS as readonly string[]).indexOf(normalized);
  return index >= 0 ? index + 1 : null;
}

export function seminarTitlesForEventPass(registration: StoredSeminarSource): string[] {
  if (!registration || registration.kind !== "student") {
    return [];
  }
  return (registration.seminarInterests ?? [])
    .map((title) => title.replace(/\s+/g, " ").trim())
    .filter((title) => title.length > 0);
}

export function wrapSeminarTitle(
  title: string,
  maxWidth: number,
  fontSize: number
): string[] {
  const normalized = title.replace(/\s+/g, " ").trim();
  const maxChars = Math.max(
    8,
    Math.floor(maxWidth / (fontSize * SEMINAR_CHAR_FACTOR))
  );
  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length > maxChars) {
      throw new EventPassLayoutError(
        "Seminar title does not fit the pass without clipping"
      );
    }
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) {
      lines.push(current);
    }
    current = word;
  }
  if (current) {
    lines.push(current);
  }
  if (lines.length === 0) {
    lines.push(normalized);
  }

  const rebuilt = lines.join(" ");
  if (rebuilt !== normalized) {
    throw new EventPassLayoutError(
      "Seminar title would change during layout"
    );
  }
  return lines;
}

function seminarTextWidth(): number {
  return CARD_W - 56 - 72;
}

export function layoutEventPass(seminarTitles: readonly string[]): EventPassLayout {
  const titles = seminarTitles
    .map((title) => title.replace(/\s+/g, " ").trim())
    .filter((title) => title.length > 0);
  const textWidth = seminarTextWidth();

  let fontSize = SEMINAR_FONT;
  let wrapped = titles.map((title) =>
    wrapSeminarTitle(title, textWidth, fontSize)
  );
  if (wrapped.some((lines) => lines.length > 2)) {
    fontSize = SEMINAR_FONT_COMPACT;
    wrapped = titles.map((title) =>
      wrapSeminarTitle(title, textWidth, fontSize)
    );
  }
  if (wrapped.some((lines) => lines.length > 3)) {
    throw new EventPassLayoutError(
      "A seminar title does not fit the pass without clipping"
    );
  }

  const lineHeight = fontSize === SEMINAR_FONT_COMPACT ? 36 : 40;
  const seminarNumbers = titles.map((title) => canonicalSeminarNumber(title));
  const seminarRowHeights = wrapped.map((lines) =>
    Math.max(lines.length > 1 ? 0 : 58, 8 + lines.length * (lineHeight - 2))
  );
  const seminarCardHeight =
    titles.length === 0
      ? 0
      : 54 + seminarRowHeights.reduce((sum, height) => sum + height, 0);
  const qrY = 258;
  const dateHeight = 100;
  const registrationCardHeight = 84;
  const bottomPad = 18;
  const gapAfterQr = 8;
  const gapBeforeRegistration = 8;
  const footer =
    gapAfterQr +
    dateHeight +
    (titles.length > 0 ? 12 + seminarCardHeight : 0) +
    gapBeforeRegistration +
    registrationCardHeight +
    bottomPad;
  const maxQr = 640;
  let qrSize = Math.floor(Math.min(maxQr, EVENT_PASS_HEIGHT - qrY - footer));
  if (qrSize < EVENT_PASS_MIN_QR_PX) {
    throw new EventPassLayoutError(
      `Event pass QR would be ${qrSize}px, below ${EVENT_PASS_MIN_QR_PX}px`
    );
  }

  const qrX = Math.floor((EVENT_PASS_WIDTH - qrSize) / 2);
  const dateY = qrY + qrSize + gapAfterQr;
  const venueLineYs = [dateY + 20, dateY + 54];
  const seminarCardY = titles.length > 0 ? dateY + dateHeight + 12 : 0;
  const seminarHeadingY = titles.length > 0 ? seminarCardY + 32 : 0;
  const seminarRowYs: number[] = [];
  let cursor = seminarCardY + 54;
  for (const rowHeight of seminarRowHeights) {
    seminarRowYs.push(cursor + Math.round((rowHeight - lineHeight) / 2) + 8);
    cursor += rowHeight;
  }
  const registrationCardY =
    (titles.length > 0 ? seminarCardY + seminarCardHeight : dateY + dateHeight) +
    gapBeforeRegistration;
  const registrationLabelY = registrationCardY + 30;
  const registrationValueY = registrationCardY + 56;
  if (registrationValueY > EVENT_PASS_HEIGHT - 28) {
    throw new EventPassLayoutError(
      "Event pass content does not fit the 1080×1350 canvas"
    );
  }

  return {
    qrSize,
    qrX,
    qrY,
    logoX: LOGO_X,
    logoY: LOGO_Y,
    logoMaxWidth: LOGO_MAX_WIDTH,
    logoMaxHeight: LOGO_MAX_HEIGHT,
    seminarFontSize: fontSize,
    seminarLineHeight: lineHeight,
    seminarLines: wrapped,
    seminarNumbers,
    dateY,
    venueLineYs,
    seminarCardY,
    seminarCardHeight,
    seminarHeadingY,
    seminarRowYs,
    seminarRowHeights,
    registrationCardY,
    registrationLabelY,
    registrationValueY,
  };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

let cachedPassFont: Font | null = null;

function passFont(): Font {
  if (!cachedPassFont) {
    cachedPassFont = loadSync(EVENT_PASS_FONT_PATH);
  }
  return cachedPassFont;
}

function outlinedText(value: string, x: number, y: number, extras: string): string {
  const fontSize = Number(/font-size="([0-9.]+)"/.exec(extras)?.[1]);
  if (!Number.isFinite(fontSize) || fontSize <= 0) {
    throw new Error("Event pass text is missing a font size");
  }
  const letterSpacingPx = Number(/letter-spacing="([0-9.]+)"/.exec(extras)?.[1] ?? 0);
  const anchor = /text-anchor="(middle|end|start)"/.exec(extras)?.[1] ?? "start";
  const fill = /fill="(#[0-9A-Fa-f]{6})"/.exec(extras)?.[1] ?? INK;
  const font = passFont();
  for (const char of value) {
    const glyph = font.charToGlyph(char);
    if (glyph.unicode === undefined) {
      throw new Error(
        `Event pass font cannot draw ${JSON.stringify(char)} in ${JSON.stringify(value)}`
      );
    }
  }
  const options = {
    letterSpacing: letterSpacingPx / fontSize,
    kerning: true,
  };
  const advance = font.getAdvanceWidth(value, fontSize, options);
  const visualWidth = advance - (value.length > 0 ? letterSpacingPx : 0);
  let drawX = x;
  if (anchor === "middle") drawX = x - visualWidth / 2;
  else if (anchor === "end") drawX = x - visualWidth;
  const d = font.getPath(value, drawX, y, fontSize, options).toPathData(2);
  if (!d) {
    throw new Error(`Event pass text produced no outline for ${JSON.stringify(value)}`);
  }
  return `<path data-pass-text="${escapeXml(value)}" d="${d}" fill="${fill}"/>`;
}

function calendarIcon(x: number, y: number): string {
  return `<g fill="none" stroke="${NAVY}" stroke-width="3" stroke-linecap="round">
    <rect x="${x}" y="${y}" width="36" height="34" rx="7"/>
    <path d="M${x} ${y + 12}h36"/>
    <path d="M${x + 10} ${y - 2}v8M${x + 26} ${y - 2}v8"/>
  </g>`;
}

function pinIcon(x: number, y: number): string {
  return `<g fill="none" stroke="${NAVY}" stroke-width="3" stroke-linejoin="round">
    <path d="M${x + 16} ${y + 34}c8-9 14-15 14-22a14 14 0 1 0-28 0c0 7 6 13 14 22z"/>
    <circle cx="${x + 16}" cy="${y + 12}" r="4" fill="${NAVY}" stroke="none"/>
  </g>`;
}

export function buildEventPassSvg(input: {
  registrationId: string;
  layout: EventPassLayout;
}): string {
  const { layout } = input;
  const registrationId = eventPassQrPayload(input.registrationId);
  const text = outlinedText;

  const seminarSvg: string[] = [];
  if (layout.seminarLines.length > 0) {
    seminarSvg.push(
      `<rect x="${CARD_X}" y="${layout.seminarCardY}" width="${CARD_W}" height="${layout.seminarCardHeight}" rx="26" fill="#F4F7FB"/>`
    );
    seminarSvg.push(
      text(
        "YOUR SEMINAR SELECTIONS",
        CARD_X + 28,
        layout.seminarHeadingY,
        `font-size="16" font-weight="700" fill="${MUTED}" letter-spacing="2.4"`
      )
    );
    layout.seminarLines.forEach((lines, index) => {
      const rowHeight = layout.seminarRowHeights[index] ?? 62;
      const firstBaseline = layout.seminarRowYs[index] ?? layout.seminarHeadingY;
      const rowTop = firstBaseline - 34;
      const chip = CHIP_STYLES[index % CHIP_STYLES.length]!;
      const number = layout.seminarNumbers[index];
      if (number !== null && number !== undefined) {
        const chipSize = 48;
        const chipX = CARD_X + 28;
        const chipY = rowTop + Math.round((rowHeight - chipSize) / 2);
        seminarSvg.push(
          `<rect data-seminar-number="${number}" x="${chipX}" y="${chipY}" width="${chipSize}" height="${chipSize}" rx="12" fill="${chip.bg}"/>`
        );
        seminarSvg.push(
          text(
            String(number),
            chipX + chipSize / 2,
            chipY + 32,
            `text-anchor="middle" font-size="22" font-weight="700" fill="${chip.fg}"`
          )
        );
      }
      lines.forEach((line, lineIndex) => {
        seminarSvg.push(
          text(
            line,
            CARD_X + 96,
            firstBaseline + lineIndex * layout.seminarLineHeight,
            `font-size="${layout.seminarFontSize}" font-weight="600" fill="${INK}"`
          )
        );
      });
      if (index < layout.seminarLines.length - 1) {
        const ruleY = rowTop + rowHeight - 1;
        seminarSvg.push(
          `<rect x="${CARD_X + 28}" y="${ruleY}" width="${CARD_W - 56}" height="1" fill="${HAIRLINE}"/>`
        );
      }
    });
  }

  const venueX = 548;
  const venueSvg = EVENT_PASS_VENUE_LINES.map((line, index) =>
    text(
      line,
      venueX,
      layout.venueLineYs[index] ?? layout.dateY,
      `font-size="28" font-weight="700" fill="${NAVY}"`
    )
  ).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${EVENT_PASS_WIDTH}" height="${EVENT_PASS_HEIGHT}" viewBox="0 0 ${EVENT_PASS_WIDTH} ${EVENT_PASS_HEIGHT}">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <rect x="28" y="24" width="${EVENT_PASS_WIDTH - 56}" height="${EVENT_PASS_HEIGHT - 48}" rx="40" fill="#FFFFFF" stroke="${HAIRLINE}" stroke-width="2"/>
  <circle cx="70" cy="520" r="150" fill="#E7F4FC" fill-opacity="0.45"/>
  <circle cx="150" cy="620" r="120" fill="#FFF6E8" fill-opacity="0.45"/>
  <circle cx="1020" cy="180" r="130" fill="#F3F7EA" fill-opacity="0.28"/>
  <circle cx="1000" cy="560" r="150" fill="#F4F8EC" fill-opacity="0.28"/>
  <circle cx="80" cy="760" r="110" fill="#FDEEEC" fill-opacity="0.4"/>
  <line x1="500" y1="78" x2="500" y2="188" stroke="${HAIRLINE}" stroke-width="2"/>
  ${text("SCAN THIS QR", 1000, 112, `text-anchor="end" font-size="34" font-weight="700" fill="${NAVY}"`)}
  ${text("AT THE ENTRY GATE", 1000, 156, `text-anchor="end" font-size="30" font-weight="700" fill="${NAVY}"`)}
  <g stroke="#7EB6F0" stroke-width="6" stroke-linecap="round">
    <path d="M1018 78l16-22"/>
    <path d="M1036 96l18-10"/>
  </g>
  ${text("YOUR EVENT PASS", EVENT_PASS_WIDTH / 2, layout.qrY - 8, `text-anchor="middle" font-size="52" font-weight="700" letter-spacing="1.5" fill="${NAVY}"`)}
  ${calendarIcon(CARD_X + 8, layout.dateY + 4)}
  ${text(EVENT_PASS_DATE, CARD_X + 64, layout.dateY + 33, `font-size="32" font-weight="700" fill="${NAVY}"`)}
  <line x1="440" y1="${layout.dateY + 6}" x2="440" y2="${layout.dateY + 86}" stroke="${HAIRLINE}" stroke-width="2"/>
  ${pinIcon(500, layout.dateY + 12)}
  ${venueSvg}
  ${seminarSvg.join("")}
  <rect x="${CARD_X}" y="${layout.registrationCardY}" width="${CARD_W}" height="84" rx="22" fill="#E8F2FC"/>
  ${text(registrationId, EVENT_PASS_WIDTH / 2, layout.registrationValueY, `text-anchor="middle" font-size="40" font-weight="700" fill="${NAVY}"`)}
</svg>`;
}

let cachedLogo: Promise<{ png: Buffer; width: number; height: number }> | null =
  null;

async function loadOfficialLogo(): Promise<{
  png: Buffer;
  width: number;
  height: number;
}> {
  if (!cachedLogo) {
    cachedLogo = (async () => {
      const source = await readFile(EVENT_PASS_LOGO_PATH);
      const png = await sharp(source)
        .resize({
          width: LOGO_MAX_WIDTH,
          height: LOGO_MAX_HEIGHT,
          fit: "inside",
          withoutEnlargement: true,
        })
        .png()
        .toBuffer();
      const meta = await sharp(png).metadata();
      if (!meta.width || !meta.height) {
        throw new Error("Official Career Uttsav logo could not be measured");
      }
      return { png, width: meta.width, height: meta.height };
    })().catch((error: unknown) => {
      cachedLogo = null;
      throw error;
    });
  }
  return cachedLogo;
}

async function rasterizePassText(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg))
    .resize(EVENT_PASS_WIDTH, EVENT_PASS_HEIGHT, { fit: "fill" })
    .png()
    .toBuffer();
}

export async function renderEventPassQrPng(
  registrationId: string,
  size: number
): Promise<Buffer> {
  const payload = eventPassQrPayload(registrationId);
  return QRCode.toBuffer(payload, {
    errorCorrectionLevel: EVENT_PASS_QR_ERROR_CORRECTION,
    margin: EVENT_PASS_QR_MARGIN_MODULES,
    width: size,
    type: "png",
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
}

export async function renderEventPassPng(input: EventPassInput): Promise<Buffer> {
  const registrationId = eventPassQrPayload(input.registrationId);
  const layout = layoutEventPass(input.seminarTitles);
  const svg = buildEventPassSvg({ registrationId, layout });
  const [logo, qrPng, textLayer] = await Promise.all([
    loadOfficialLogo(),
    renderEventPassQrPng(registrationId, layout.qrSize),
    rasterizePassText(svg),
  ]);

  const png = await sharp(textLayer)
    .composite([
      { input: logo.png, left: layout.logoX, top: layout.logoY },
      { input: qrPng, left: layout.qrX, top: layout.qrY },
    ])
    .png()
    .toBuffer();

  if (png.length === 0) {
    throw new Error("Event pass render produced an empty image");
  }
  return png;
}

export async function generateWhatsAppEntryPassPngBase64(
  input: EventPassInput
): Promise<string> {
  const registrationId = eventPassQrPayload(input.registrationId);
  try {
    const png = await renderEventPassPng({
      registrationId,
      seminarTitles: input.seminarTitles,
    });
    if (png.length === 0) {
      throw new Error("Event pass render produced an empty image");
    }
    return png.toString("base64");
  } catch (error) {
    console.error(
      "[event-pass] pass render failed; sending plain QR",
      error instanceof Error ? error.message : "unknown"
    );
    const fallback = await generateRegistrationQrPngBase64(registrationId);
    if (!fallback) {
      throw new Error("Plain QR fallback produced an empty image");
    }
    return fallback;
  }
}
