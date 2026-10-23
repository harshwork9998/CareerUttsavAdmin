import { NextResponse } from "next/server";

import { processPostRegistrationGrowthTriggers } from "@/lib/server/whatsapp/whatsapp-post-registration-processor";
import { processWhatsAppRegistrationReminders } from "@/lib/server/whatsapp/whatsapp-registration-reminder-processor";
import { requireWhatsAppReminderCronAuth } from "@/lib/server/whatsapp/whatsapp-reminder-cron-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authError = requireWhatsAppReminderCronAuth(request);
  if (authError) {
    return authError;
  }

  const reminders = await processWhatsAppRegistrationReminders();
  const growth = await processPostRegistrationGrowthTriggers();
  return NextResponse.json({ ...reminders, growth });
}
