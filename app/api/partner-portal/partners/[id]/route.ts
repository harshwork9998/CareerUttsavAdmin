import { NextResponse } from "next/server";

import {
  applyMeaningfulPartnerActivity,
  notifyReadinessTransition,
  notifySpeakerReceived,
} from "@/lib/server/partner-communication-service";
import { toPartnerPortalPartnerDto } from "@/lib/server/partner-portal-dto";
import { validatePartnerPortalContent } from "@/lib/server/partner-portal-content";
import { parsePartnerPortalPatch } from "@/lib/server/partner-portal-patch";
import { requirePartnerPortalServiceAuth } from "@/lib/server/partner-portal-service-auth";
import {
  getPartnerByIdForApi,
  updatePartnerForApi,
} from "@/lib/server/partner-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Partner Portal sync — allowlisted portal-owned fields only. */
export async function PATCH(request: Request, context: RouteContext) {
  const authError = requirePartnerPortalServiceAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const before = await getPartnerByIdForApi(id);
  const body = await request.json().catch(() => null);
  const parsed = parsePartnerPortalPatch(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const contentError = validatePartnerPortalContent(parsed.patch);
  if (contentError) {
    return NextResponse.json({ error: contentError }, { status: 400 });
  }

  const result = await updatePartnerForApi(id, parsed.patch);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  let partner = result.partner;
  if (before) {
    try {
      partner = await applyMeaningfulPartnerActivity(before, partner);
      await notifySpeakerReceived(before, partner);
      await notifyReadinessTransition(before, partner);
    } catch (error) {
      console.info("[partner-communication]", {
        partnerId: partner.id,
        outcome: "unknown",
        error: error instanceof Error ? error.message : "Partner communication failed",
      });
    }
  }

  return NextResponse.json(toPartnerPortalPartnerDto(partner));
}
