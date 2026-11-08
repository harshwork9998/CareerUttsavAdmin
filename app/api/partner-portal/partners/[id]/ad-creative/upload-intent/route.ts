import { NextResponse } from "next/server";

import { createPartnerAdCreativeUploadIntent } from "@/lib/server/partner-portal-ad-creative";
import { requirePartnerPortalServiceAuth } from "@/lib/server/partner-portal-service-auth";
import { getPartnerByIdForApi } from "@/lib/server/partner-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authError = requirePartnerPortalServiceAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const partner = await getPartnerByIdForApi(id);
  if (!partner) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const fileName = String(body?.fileName ?? "");
  const mimeType = String(body?.mimeType ?? "");
  const fileSizeBytes = Number(body?.fileSizeBytes) || 0;

  const result = await createPartnerAdCreativeUploadIntent({
    partner,
    fileName,
    mimeType,
    fileSizeBytes,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.intent);
}
