import { NextResponse } from "next/server";

import {
  buildLeadAttributionTrackingUrl,
  buildWhatsAppClickToChatUrl,
  normalizeLeadAttributionTrackingCode,
} from "@/lib/lead-attribution/placements";
import {
  leadAttributionPlacementForCode,
  resolveActiveLeadAttribution,
} from "@/lib/lead-attribution/resolve";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

/** Public read-only resolution for website QR / ref links. No secrets. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ref = searchParams.get("ref")?.trim() ?? "";
  if (!ref) {
    return NextResponse.json(
      { error: "ref query parameter is required" },
      { status: 400, headers: NO_STORE }
    );
  }

  const normalized = normalizeLeadAttributionTrackingCode(ref);
  const resolved = resolveActiveLeadAttribution(normalized);
  const placement = leadAttributionPlacementForCode(normalized);

  if (!resolved || !placement?.isActive) {
    return NextResponse.json(
      { active: false, trackingCode: normalized },
      { status: 200, headers: NO_STORE }
    );
  }

  return NextResponse.json(
    {
      active: true,
      trackingCode: resolved.trackingCode,
      leadSource: resolved.leadSource,
      leadSubSource: resolved.leadSubSource,
      trackingUrl: buildLeadAttributionTrackingUrl(resolved.trackingCode),
      whatsappPrefill: placement.whatsappIntroMessage,
      whatsappUrl: buildWhatsAppClickToChatUrl(placement.whatsappIntroMessage),
    },
    { headers: NO_STORE }
  );
}