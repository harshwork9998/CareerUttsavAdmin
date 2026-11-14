/**
 * Generate PNG QR codes for configured lead-attribution tracking URLs.
 *
 *   npx tsx scripts/generate-lead-attribution-qrs.ts
 *
 * Output: ./lead-attribution-qr/*.png (gitignored path — copy for print vendors).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import QRCode from "qrcode";

import {
  buildLeadAttributionTrackingUrl,
  LEAD_ATTRIBUTION_PLACEMENTS,
} from "@/lib/lead-attribution/placements";

async function main() {
  const outDir = join(process.cwd(), "lead-attribution-qr");
  mkdirSync(outDir, { recursive: true });

  for (const placement of LEAD_ATTRIBUTION_PLACEMENTS) {
    if (!placement.isActive) continue;
    const url = buildLeadAttributionTrackingUrl(placement.trackingCode);
    const file = join(outDir, `${placement.trackingCode}.png`);
    const png = await QRCode.toBuffer(url, {
      type: "png",
      width: 512,
      margin: 2,
      errorCorrectionLevel: "M",
    });
    writeFileSync(file, png);
    console.log(`${placement.trackingCode} -> ${url} -> ${file}`);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});