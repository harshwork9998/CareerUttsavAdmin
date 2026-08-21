import { NextResponse } from "next/server";

import { authenticatePartnerPortalLogin } from "@/lib/partner-portal-auth";

export const dynamic = "force-dynamic";

/**
 * Partner Portal authenticates against Admin here so Chapter 8 credentials
 * are the single source of truth (not the portal seed store).
 */
export async function POST(request: Request) {
  let body: { login?: string; password?: string } = {};
  try {
    body = (await request.json()) as { login?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await authenticatePartnerPortalLogin({
    login: body.login ?? "",
    password: body.password ?? "",
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: result.status }
    );
  }

  const { partner, mustChangePassword } = result;
  return NextResponse.json({
    ok: true,
    mustChangePassword,
    partner: {
      id: partner.id,
      name: partner.name,
      portalLogin: partner.portalLogin,
      portalInviteEmail: partner.portalInviteEmail,
      portalInviteSentAt: partner.portalInviteSentAt,
      portalPasswordChangedAt: partner.portalPasswordChangedAt,
      portalAuthVersion: partner.portalAuthVersion ?? 0,
    },
  });
}
