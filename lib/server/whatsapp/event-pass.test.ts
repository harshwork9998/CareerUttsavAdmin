import { readFile } from "fs/promises";

import QRCode from "qrcode";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import {
  CAREER_UTTSAV_SEMINARS,
  LEGACY_CAREER_UTTSAV_SEMINARS,
} from "@/features/dashboard/seminars";
import {
  EVENT_PASS_DATE,
  EVENT_PASS_HEIGHT,
  EVENT_PASS_LOGO_PATH,
  EVENT_PASS_MIN_QR_PX,
  EVENT_PASS_QR_ERROR_CORRECTION,
  EVENT_PASS_QR_MARGIN_MODULES,
  EVENT_PASS_VENUE_LINES,
  EVENT_PASS_WIDTH,
  buildEventPassSvg,
  canonicalSeminarNumber,
  eventPassQrPayload,
  layoutEventPass,
  renderEventPassPng,
  renderEventPassQrPng,
  seminarTitlesForEventPass,
  wrapSeminarTitle,
} from "@/lib/server/whatsapp/event-pass";

const REGISTRATION_ID = "CU-BLR-2026-00042";
const LONG_TITLE =
  "Design, Architecture & Creative Careers for Students Exploring Many Paths";

function titles(count: number): string[] {
  return CAREER_UTTSAV_SEMINARS.slice(0, count);
}

describe("event pass data", () => {
  it("uses the actual registration id as the only QR payload", () => {
    expect(eventPassQrPayload(`  ${REGISTRATION_ID}  `)).toBe(REGISTRATION_ID);
    expect(eventPassQrPayload(REGISTRATION_ID)).not.toContain("{");
    expect(eventPassQrPayload(REGISTRATION_ID)).not.toContain("http");
    expect(eventPassQrPayload(REGISTRATION_ID)).not.toContain("@");
    expect(eventPassQrPayload(REGISTRATION_ID)).not.toContain("919876543210");
  });

  it("reads only stored student seminar titles", () => {
    expect(
      seminarTitlesForEventPass({
        kind: "student",
        seminarInterests: ["  Do What You Love, Love What You Do  ", ""],
      })
    ).toEqual(["Do What You Love, Love What You Do"]);
    expect(
      seminarTitlesForEventPass({
        kind: "student",
        seminarInterests: undefined,
      })
    ).toEqual([]);
    expect(seminarTitlesForEventPass({ kind: "school", seminarInterests: ["Nope"] })).toEqual(
      []
    );
    expect(seminarTitlesForEventPass(null)).toEqual([]);
  });

  it.each([1, 2, 3])("lays out %i selected seminar row(s) and no blanks", (count) => {
    const selected = titles(count);
    const layout = layoutEventPass(selected);
    expect(layout.seminarLines).toHaveLength(count);
    expect(layout.seminarRowYs).toHaveLength(count);
    expect(layout.seminarLines.map((lines) => lines.join(" "))).toEqual(selected);
    const svg = buildEventPassSvg({ registrationId: REGISTRATION_ID, layout });
    for (const title of selected) {
      expect(svg).toContain(title.replace(/&/g, "&amp;"));
    }
    for (const unused of CAREER_UTTSAV_SEMINARS.slice(count)) {
      expect(svg).not.toContain(unused.replace(/&/g, "&amp;"));
    }
    expect(svg).not.toContain(LEGACY_CAREER_UTTSAV_SEMINARS[0]);
    expect(svg).not.toContain("CU26-001234");
    expect(svg).toContain(REGISTRATION_ID);
    expect(svg).toContain(EVENT_PASS_DATE);
    for (const line of EVENT_PASS_VENUE_LINES) {
      expect(svg).toContain(line);
    }
    expect(svg).not.toContain("9876543210");
    expect(svg).not.toContain("aarav@example.com");
    expect(svg).not.toContain("919876543210");
  });

  it("omits the seminar section when nothing was stored", () => {
    const layout = layoutEventPass([]);
    expect(layout.seminarLines).toHaveLength(0);
    const svg = buildEventPassSvg({ registrationId: REGISTRATION_ID, layout });
    expect(svg).not.toContain("YOUR SEMINAR SELECTIONS");
    expect(svg).not.toContain("REGISTRATION ID");
    expect(svg).toContain(REGISTRATION_ID);
  });

  it("keeps long seminar titles intact", () => {
    const selected = [LONG_TITLE, LONG_TITLE, LONG_TITLE];
    const layout = layoutEventPass(selected);
    expect(layout.seminarLines).toHaveLength(3);
    for (const lines of layout.seminarLines) {
      expect(lines.length).toBeGreaterThan(1);
      expect(lines.length).toBeLessThanOrEqual(2);
      expect(lines.join(" ")).toBe(LONG_TITLE);
      expect(lines.join(" ")).not.toContain("...");
    }
    expect(layout.qrSize).toBeGreaterThanOrEqual(EVENT_PASS_MIN_QR_PX);
    expect(layout.seminarRowYs[2]! + layout.seminarLineHeight * 2).toBeLessThan(
      layout.registrationLabelY
    );
  });

  it("keeps the QR large for one, two, and three canonical titles", () => {
    for (const count of [1, 2, 3]) {
      const layout = layoutEventPass(titles(count));
      expect(layout.qrSize).toBeGreaterThanOrEqual(EVENT_PASS_MIN_QR_PX);
      expect(layout.qrSize).toBeGreaterThan(EVENT_PASS_WIDTH * 0.42);
      expect(layout.qrX).toBeGreaterThanOrEqual(EVENT_PASS_QR_MARGIN_MODULES);
      expect(layout.qrY).toBeGreaterThan(160);
    }
  });

  it("uses canonical catalogue numbers on chips and skips unknown titles", () => {
    expect(canonicalSeminarNumber("Engineering Next: What’s Ahead?")).toBe(2);
    expect(canonicalSeminarNumber("Careers in Medicine & Health Sciences")).toBe(8);
    expect(canonicalSeminarNumber("How to Score Better in Board Exams?")).toBe(14);
    expect(canonicalSeminarNumber(LEGACY_CAREER_UTTSAV_SEMINARS[0])).toBeNull();

    const selected = [
      CAREER_UTTSAV_SEMINARS[1],
      CAREER_UTTSAV_SEMINARS[7],
      LEGACY_CAREER_UTTSAV_SEMINARS[0],
    ];
    const layout = layoutEventPass(selected);
    expect(layout.seminarNumbers).toEqual([2, 8, null]);
    const svg = buildEventPassSvg({ registrationId: REGISTRATION_ID, layout });
    expect(svg).toContain('data-seminar-number="2"');
    expect(svg).toContain('data-seminar-number="8"');
    expect(svg).not.toContain('data-seminar-number="3"');
    expect(layout.seminarLines[2]?.join(" ")).toBe(LEGACY_CAREER_UTTSAV_SEMINARS[0]);
    expect(svg).not.toContain("CU26-001234");
  });
});

describe("event pass image", () => {
  it("renders a 1080×1350 PNG with the official logo and a real QR", async () => {
    const logo = await readFile(EVENT_PASS_LOGO_PATH);
    expect(EVENT_PASS_LOGO_PATH.replace(/\\/g, "/")).toMatch(
      /public\/images\/career-uttsav-logo\.png$/
    );
    const logoMeta = await sharp(logo).metadata();
    expect(logoMeta.width).toBe(824);
    expect(logoMeta.height).toBe(586);
    expect(logoMeta.hasAlpha).toBe(true);

    const spy = vi.spyOn(QRCode, "toBuffer");
    const selected = titles(3);
    const png = await renderEventPassPng({
      registrationId: REGISTRATION_ID,
      seminarTitles: selected,
    });
    expect(png.length).toBeGreaterThan(10_000);
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");

    const meta = await sharp(png).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBe(EVENT_PASS_WIDTH);
    expect(meta.height).toBe(EVENT_PASS_HEIGHT);

    expect(spy).toHaveBeenCalledWith(
      REGISTRATION_ID,
      expect.objectContaining({
        errorCorrectionLevel: EVENT_PASS_QR_ERROR_CORRECTION,
        margin: EVENT_PASS_QR_MARGIN_MODULES,
        color: { dark: "#000000", light: "#FFFFFF" },
      })
    );
    const qrCall = spy.mock.calls.find((call) => call[0] === REGISTRATION_ID);
    expect(qrCall?.[0]).toBe(REGISTRATION_ID);
    expect(JSON.stringify(qrCall?.[1])).not.toContain("http");
    spy.mockRestore();

    const { data, info } = await sharp(png)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const channels = info.channels;
    let coloredLogoPixel = false;
    for (let y = 48; y < 140 && !coloredLogoPixel; y += 2) {
      for (let x = 64; x < 280; x += 2) {
        const offset = (y * info.width + x) * channels;
        const red = data[offset] ?? 0;
        const green = data[offset + 1] ?? 0;
        const blue = data[offset + 2] ?? 0;
        const max = Math.max(red, green, blue);
        const min = Math.min(red, green, blue);
        if (max > 80 && max - min > 40) {
          coloredLogoPixel = true;
        }
      }
    }
    expect(coloredLogoPixel).toBe(true);

    const corner = (info.width - 1) * channels;
    expect(data[0]).toBeGreaterThan(250);
    expect(data[corner]).toBeGreaterThan(250);
  });

  it("renders one and three long seminars without clipping the canvas", async () => {
    const one = await renderEventPassPng({
      registrationId: "CU-BLR-2026-00007",
      seminarTitles: [CAREER_UTTSAV_SEMINARS[9]],
    });
    const three = await renderEventPassPng({
      registrationId: REGISTRATION_ID,
      seminarTitles: [LONG_TITLE, LONG_TITLE, `${LONG_TITLE} today`],
    });
    for (const png of [one, three]) {
      const meta = await sharp(png).metadata();
      expect(meta.width).toBe(1080);
      expect(meta.height).toBe(1350);
      expect(png.length).toBeGreaterThan(10_000);
    }
  });

  it("keeps a real quiet zone around the QR modules", async () => {
    const qr = await renderEventPassQrPng(REGISTRATION_ID, 760);
    const { data, info } = await sharp(qr)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let nearest = info.width;
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const offset = (y * info.width + x) * info.channels;
        const red = data[offset] ?? 255;
        if (red < 250) {
          nearest = Math.min(nearest, x, y, info.width - 1 - x, info.height - 1 - y);
        }
      }
    }
    expect(nearest).toBeGreaterThanOrEqual(16);
    expect(wrapSeminarTitle(CAREER_UTTSAV_SEMINARS[2], 900, 32).join(" ")).toBe(
      CAREER_UTTSAV_SEMINARS[2]
    );
  });
});
