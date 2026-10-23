import { NextResponse } from "next/server";

import { partnerHasPortalPassword } from "@/lib/partner-credentials";
import { requirePartnerPortalServiceAuth } from "@/lib/server/partner-portal-service-auth";
import { getPartnerByIdForApi } from "@/lib/server/partner-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = requirePartnerPortalServiceAuth(request);
  if (unauthorized) return unauthorized;

  let body: { partnerId?: string } = {};
  try {
    body = (await request.json()) as { partnerId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const partnerId = body.partnerId?.trim() ?? "";
  if (!partnerId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const partner = await getPartnerByIdForApi(partnerId);
  if (!partner) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    partnerId: partner.id,
    name: partner.name,
    portalLogin: partner.portalLogin ?? "",
    portalAccessEnabled: partner.portalAccessEnabled === true,
    portalAuthVersion: partner.portalAuthVersion ?? 0,
    portalPasswordChangedAt: partner.portalPasswordChangedAt ?? null,
    hasPortalPassword: partnerHasPortalPassword(partner),
  });
}
