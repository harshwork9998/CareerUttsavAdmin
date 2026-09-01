import { NextResponse } from "next/server";

import { toPartnerPortalEventCatalog } from "@/lib/partner-portal-event-catalog";
import { requirePartnerPortalServiceAuth } from "@/lib/server/partner-portal-service-auth";
import { listEventsForApi } from "@/lib/server/event-service";

export const dynamic = "force-dynamic";

/** Read-only event catalog for the Partner Portal (seminar titles, schedule, halls). */
export async function GET(request: Request) {
  const authError = requirePartnerPortalServiceAuth(request);
  if (authError) return authError;

  return NextResponse.json(
    toPartnerPortalEventCatalog(await listEventsForApi())
  );
}
