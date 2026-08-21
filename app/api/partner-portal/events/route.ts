import { NextResponse } from "next/server";

import { toPartnerPortalEventCatalog } from "@/lib/partner-portal-event-catalog";
import { listEventsForApi } from "@/lib/server/event-service";

export const dynamic = "force-dynamic";

/** Read-only event catalog for the Partner Portal (seminar titles, schedule, halls). */
export async function GET() {
  return NextResponse.json(
    toPartnerPortalEventCatalog(await listEventsForApi())
  );
}
