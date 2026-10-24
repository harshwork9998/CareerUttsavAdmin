import { NextResponse } from "next/server";

import { constantTimeEqual } from "@/lib/server/partner-portal-service-auth";

export const PARTNER_COMMUNICATION_CRON_KEY_HEADER =
  "x-cu-partner-communication-cron-key";

export function readPartnerCommunicationCronSecret(): string | null {
  const secret = process.env.PARTNER_COMMUNICATION_CRON_SECRET?.trim();
  return secret ? secret : null;
}

export function isPartnerCommunicationCronAuthorized(request: Request): boolean {
  const expected = readPartnerCommunicationCronSecret();
  if (!expected) return false;
  const provided =
    request.headers.get(PARTNER_COMMUNICATION_CRON_KEY_HEADER)?.trim() ?? "";
  if (!provided) return false;
  return constantTimeEqual(provided, expected);
}

export function requirePartnerCommunicationCronAuth(
  request: Request
): NextResponse | null {
  if (!isPartnerCommunicationCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
