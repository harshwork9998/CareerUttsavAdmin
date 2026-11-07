import { NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/server/admin-auth";
import { toPublicPartner } from "@/lib/partner-credentials";
import {
  movePartnerSeminarForApi,
  removePartnerSeminarForApi,
} from "@/lib/server/seminar-admin-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    eventId?: unknown;
    seminarId?: unknown;
    destinationSeminarId?: unknown;
  } | null;
  const eventId = typeof body?.eventId === "string" ? body.eventId.trim() : "";
  const seminarId = typeof body?.seminarId === "string" ? body.seminarId.trim() : "";
  if (!eventId || !seminarId) {
    return NextResponse.json({ error: "That seminar assignment was not found." }, { status: 400 });
  }

  const result =
    body?.action === "move"
      ? await movePartnerSeminarForApi({
          partnerId: id,
          eventId,
          seminarId,
          destinationSeminarId:
            typeof body.destinationSeminarId === "string"
              ? body.destinationSeminarId.trim()
              : "",
        })
      : body?.action === "remove"
        ? await removePartnerSeminarForApi({ partnerId: id, eventId, seminarId })
        : { ok: false as const, status: 400, error: "Choose move or remove." };

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ partner: toPublicPartner(result.partner) });
}
