import { NextResponse } from "next/server";

import { constantTimeEqual } from "@/lib/server/partner-portal-service-auth";

export const RELATIONSHIP_OWNER_FOLLOWUP_CRON_KEY_HEADER =
  "x-cu-relationship-owner-followup-cron-key";

export function readRelationshipOwnerFollowUpCronSecret(): string | null {
  const secret = process.env.RELATIONSHIP_OWNER_FOLLOWUP_CRON_SECRET?.trim();
  return secret ? secret : null;
}

export function isRelationshipOwnerFollowUpCronAuthorized(
  request: Request
): boolean {
  const expected = readRelationshipOwnerFollowUpCronSecret();
  if (!expected) return false;
  const provided =
    request.headers.get(RELATIONSHIP_OWNER_FOLLOWUP_CRON_KEY_HEADER)?.trim() ??
    "";
  if (!provided) return false;
  return constantTimeEqual(provided, expected);
}

export function requireRelationshipOwnerFollowUpCronAuth(
  request: Request
): NextResponse | null {
  if (!isRelationshipOwnerFollowUpCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
