import { NextResponse } from "next/server";

import { toPartnerPortalPartnerDto } from "@/lib/server/partner-portal-dto";
import { parsePartnerPortalPatch } from "@/lib/server/partner-portal-patch";
import { requirePartnerPortalServiceAuth } from "@/lib/server/partner-portal-service-auth";
import { updatePartnerForApi } from "@/lib/server/partner-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Partner Portal sync — allowlisted portal-owned fields only. */
export async function PATCH(request: Request, context: RouteContext) {
  const authError = requirePartnerPortalServiceAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = parsePartnerPortalPatch(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const result = await updatePartnerForApi(id, parsed.patch);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(toPartnerPortalPartnerDto(result.partner));
}
