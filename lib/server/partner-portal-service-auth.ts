import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

export const PARTNER_PORTAL_SERVICE_KEY_HEADER = "x-cu-partner-service-key";

/** Constant-time string compare; safe when lengths differ. */
export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function readPartnerPortalServiceSecret(): string | null {
  const secret = process.env.PARTNER_PORTAL_SERVICE_SECRET?.trim();
  return secret ? secret : null;
}

export function isPartnerPortalServiceAuthorized(request: Request): boolean {
  const expected = readPartnerPortalServiceSecret();
  if (!expected) return false;
  const provided =
    request.headers.get(PARTNER_PORTAL_SERVICE_KEY_HEADER)?.trim() ?? "";
  if (!provided) return false;
  return constantTimeEqual(provided, expected);
}

export function requirePartnerPortalServiceAuth(
  request: Request
): NextResponse | null {
  if (!isPartnerPortalServiceAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
