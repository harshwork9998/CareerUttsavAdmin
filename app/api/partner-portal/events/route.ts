import { NextResponse } from "next/server";

import { toPartnerPortalEventCatalog } from "@/lib/partner-portal-event-catalog";
import { loadEvents } from "@/lib/server/events-persistence";

export const dynamic = "force-dynamic";

/** Read-only event catalog for the Partner Portal (seminar titles, schedule, halls). */
export async function GET() {
  return NextResponse.json(toPartnerPortalEventCatalog(loadEvents()));
}
