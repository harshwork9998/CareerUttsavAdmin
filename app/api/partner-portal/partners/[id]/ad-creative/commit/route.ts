import { NextResponse } from "next/server";

import {
  applyMeaningfulPartnerActivity,
  notifyReadinessTransition,
} from "@/lib/server/partner-communication-service";
import { commitPartnerAdCreativeUpload } from "@/lib/server/partner-portal-ad-creative";
import { toPartnerPortalPartnerDto } from "@/lib/server/partner-portal-dto";
import { requirePartnerPortalServiceAuth } from "@/lib/server/partner-portal-service-auth";
import { getPartnerByIdForApi } from "@/lib/server/partner-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authError = requirePartnerPortalServiceAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const before = await getPartnerByIdForApi(id);
  if (!before) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const result = await commitPartnerAdCreativeUpload({
    partner: before,
    label: String(body?.label ?? "Advertisement creative"),
    fileName: String(body?.fileName ?? ""),
    mimeType: String(body?.mimeType ?? ""),
    fileSizeBytes: Number(body?.fileSizeBytes) || 0,
    storageBucket: String(body?.storageBucket ?? ""),
    storagePath: String(body?.storagePath ?? ""),
    ifMatchToken:
      body?.ifMatchToken === undefined ? undefined : String(body.ifMatchToken ?? ""),
  });
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        ...(result.partner ? toPartnerPortalPartnerDto(result.partner) : {}),
      },
      { status: result.status }
    );
  }

  let partner = result.partner;
  try {
    partner = await applyMeaningfulPartnerActivity(before, partner);
    await notifyReadinessTransition(before, partner);
  } catch (error) {
    console.info("[partner-communication]", {
      partnerId: partner.id,
      outcome: "unknown",
      error: error instanceof Error ? error.message : "Partner communication failed",
    });
  }

  return NextResponse.json(toPartnerPortalPartnerDto(partner));
}
