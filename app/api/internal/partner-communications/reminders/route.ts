import { NextResponse } from "next/server";

import { requirePartnerCommunicationCronAuth } from "@/lib/server/partner-communication-cron-auth";
import { processPartnerCommunicationReminders } from "@/lib/server/partner-communication-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authError = requirePartnerCommunicationCronAuth(request);
  if (authError) return authError;

  const summary = await processPartnerCommunicationReminders();
  return NextResponse.json(summary);
}
