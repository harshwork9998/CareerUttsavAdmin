import { NextResponse } from "next/server";

import { changePartnerPortalPassword } from "@/lib/server/partner-access-service";
import { requirePartnerPortalServiceAuth } from "@/lib/server/partner-portal-service-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = requirePartnerPortalServiceAuth(request);
  if (unauthorized) return unauthorized;

  let body: { partnerId?: string; password?: string } = {};
  try {
    body = (await request.json()) as { partnerId?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await changePartnerPortalPassword({
    partnerId: body.partnerId?.trim() ?? "",
    password: body.password ?? "",
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    portalAuthVersion: result.portalAuthVersion,
    portalPasswordChangedAt: result.portalPasswordChangedAt,
  });
}
