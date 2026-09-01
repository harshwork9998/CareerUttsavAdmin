import { NextResponse } from "next/server";

import { listPartnerPortalPartnerDtos } from "@/lib/server/partner-portal-dto";
import { requirePartnerPortalServiceAuth } from "@/lib/server/partner-portal-service-auth";
import { listPartnersForApi } from "@/lib/server/partner-service";

export const dynamic = "force-dynamic";

/** Activated partners for Partner Portal server sync (service auth only). */
export async function GET(request: Request) {
  const authError = requirePartnerPortalServiceAuth(request);
  if (authError) return authError;

  const partners = await listPartnersForApi();
  return NextResponse.json(listPartnerPortalPartnerDtos(partners));
}
