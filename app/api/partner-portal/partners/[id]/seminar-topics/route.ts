import { NextResponse } from "next/server";

import { requirePartnerPortalServiceAuth } from "@/lib/server/partner-portal-service-auth";
import {
  getPartnerSeminarTopicCatalog,
  savePartnerSeminarTopics,
} from "@/lib/server/seminar-topic-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const authError = requirePartnerPortalServiceAuth(request);
  if (authError) return authError;
  const { id } = await context.params;
  const result = await getPartnerSeminarTopicCatalog(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.catalog);
}

export async function PATCH(request: Request, context: RouteContext) {
  const authError = requirePartnerPortalServiceAuth(request);
  if (authError) return authError;
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const result = await savePartnerSeminarTopics(id, body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.catalog);
}
