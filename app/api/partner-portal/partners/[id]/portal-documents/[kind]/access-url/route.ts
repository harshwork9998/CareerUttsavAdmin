import { NextResponse } from "next/server";

import { resolvePortalDocumentAccessUrl } from "@/lib/server/partner-portal-document-access";
import { requirePartnerPortalServiceAuth } from "@/lib/server/partner-portal-service-auth";
import { getPartnerByIdForApi } from "@/lib/server/partner-service";
import type { PartnerPortalDocumentKind } from "@/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; kind: string }> };

const ALLOWED: PartnerPortalDocumentKind[] = [
  "logo",
  "ad_creative",
  "souvenir_writeup",
  "writeup",
  "banner",
  "brochure",
  "agreement",
];

export async function GET(request: Request, context: RouteContext) {
  const authError = requirePartnerPortalServiceAuth(request);
  if (authError) return authError;

  const { id, kind: kindRaw } = await context.params;
  const kind = kindRaw as PartnerPortalDocumentKind;
  if (!ALLOWED.includes(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  const partner = await getPartnerByIdForApi(id);
  if (!partner) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const resolved = await resolvePortalDocumentAccessUrl(partner, kind);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  return NextResponse.json({ url: resolved.url });
}
