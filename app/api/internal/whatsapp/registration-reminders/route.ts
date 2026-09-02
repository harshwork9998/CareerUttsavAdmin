import { NextResponse } from "next/server";

import { processWhatsAppRegistrationReminders } from "@/lib/server/whatsapp/whatsapp-registration-reminder-processor";
import { requireWhatsAppReminderCronAuth } from "@/lib/server/whatsapp/whatsapp-reminder-cron-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authError = requireWhatsAppReminderCronAuth(request);
  if (authError) {
    return authError;
  }

  const result = await processWhatsAppRegistrationReminders();
  return NextResponse.json(result);
}
