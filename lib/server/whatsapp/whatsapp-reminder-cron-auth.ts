import { NextResponse } from "next/server";

import { constantTimeEqual } from "@/lib/server/partner-portal-service-auth";

export const WHATSAPP_REMINDER_CRON_KEY_HEADER = "x-cu-reminder-cron-key";

export function readWhatsAppReminderCronSecret(): string | null {
  const secret = process.env.WHATSAPP_REMINDER_CRON_SECRET?.trim();
  return secret ? secret : null;
}

export function isWhatsAppReminderCronAuthorized(request: Request): boolean {
  const expected = readWhatsAppReminderCronSecret();
  if (!expected) {
    return false;
  }
  const provided =
    request.headers.get(WHATSAPP_REMINDER_CRON_KEY_HEADER)?.trim() ?? "";
  if (!provided) {
    return false;
  }
  return constantTimeEqual(provided, expected);
}

export function requireWhatsAppReminderCronAuth(
  request: Request
): NextResponse | null {
  if (!isWhatsAppReminderCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
