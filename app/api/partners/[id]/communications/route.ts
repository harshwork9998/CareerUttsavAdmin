import { NextResponse } from "next/server";

import {
  lastReminderIndicator,
  presentCommunicationHistory,
} from "@/lib/partner-communication-history";
import {
  PARTNER_MANUAL_REMINDER_TYPES,
  type PartnerManualReminderType,
} from "@/lib/partner-communication-policy";
import { requireAdminUser } from "@/lib/server/admin-auth";
import { listEventsForApi } from "@/lib/server/event-service";
import { createPartnerCommunicationLogStore } from "@/lib/server/partner-communication-log";
import {
  reminderOptionsForPartner,
  sendManualPartnerReminder,
} from "@/lib/server/partner-communication-service";
import { getPartnerByIdForApi } from "@/lib/server/partner-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function isManualType(value: unknown): value is PartnerManualReminderType {
  return (
    typeof value === "string" &&
    (PARTNER_MANUAL_REMINDER_TYPES as readonly string[]).includes(value)
  );
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const partner = await getPartnerByIdForApi(id);
  if (!partner) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const events = await listEventsForApi();
  const options = await reminderOptionsForPartner(partner, events);
  const logs = await createPartnerCommunicationLogStore().listForPartner(partner.id);
  return NextResponse.json({
    institutionName: partner.name,
    recipient:
      partner.portalInviteEmail?.trim() ||
      partner.primaryContact?.email?.trim() ||
      "",
    options,
    history: presentCommunicationHistory(logs),
    lastReminder: lastReminderIndicator(logs),
  });
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { type?: unknown } | null;
  if (!isManualType(body?.type)) {
    return NextResponse.json({ error: "Choose a reminder type." }, { status: 400 });
  }

  const partner = await getPartnerByIdForApi(id);
  if (!partner) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const events = await listEventsForApi();
  const result = await sendManualPartnerReminder({
    partner,
    type: body.type,
    events,
  });
  if (!result.ok) {
    const status = result.error.includes("could not be sent") ? 502 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true });
}
