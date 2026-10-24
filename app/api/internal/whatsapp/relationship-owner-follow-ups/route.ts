import { NextResponse } from "next/server";

import { requireRelationshipOwnerFollowUpCronAuth } from "@/lib/server/relationship-owner-follow-up-cron-auth";
import { processRelationshipOwnerFollowUpDigests } from "@/lib/server/relationship-owner-follow-up-processor";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authError = requireRelationshipOwnerFollowUpCronAuth(request);
  if (authError) return authError;

  const summary = await processRelationshipOwnerFollowUpDigests();
  return NextResponse.json(summary);
}
