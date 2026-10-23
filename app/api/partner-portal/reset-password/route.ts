import { NextResponse } from "next/server";

import { completePartnerPasswordReset } from "@/lib/server/partner-access-service";
import { requirePartnerPortalServiceAuth } from "@/lib/server/partner-portal-service-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = requirePartnerPortalServiceAuth(request);
  if (unauthorized) return unauthorized;

  let body: { token?: string; password?: string } = {};
  try {
    body = (await request.json()) as { token?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await completePartnerPasswordReset({
    token: body.token ?? "",
    password: body.password ?? "",
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    message: "Your password has been reset successfully. Please sign in.",
  });
}
