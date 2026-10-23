import { NextResponse } from "next/server";

import { requestPartnerPasswordReset } from "@/lib/server/partner-access-service";
import { requirePartnerPortalServiceAuth } from "@/lib/server/partner-portal-service-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = requirePartnerPortalServiceAuth(request);
  if (unauthorized) return unauthorized;

  let body: { login?: string } = {};
  try {
    body = (await request.json()) as { login?: string };
  } catch {
    body = {};
  }

  const result = await requestPartnerPasswordReset(body.login ?? "");
  return NextResponse.json({ ok: true, message: result.message });
}
