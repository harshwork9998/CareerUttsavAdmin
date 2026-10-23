import { NextResponse } from "next/server";

import { previewPartnerPasswordReset } from "@/lib/server/partner-access-service";
import { requirePartnerPortalServiceAuth } from "@/lib/server/partner-portal-service-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = requirePartnerPortalServiceAuth(request);
  if (unauthorized) return unauthorized;

  let body: { token?: string } = {};
  try {
    body = (await request.json()) as { token?: string };
  } catch {
    return NextResponse.json(
      { valid: false, error: "This reset link is invalid or has expired." },
      { status: 400 }
    );
  }

  const valid = await previewPartnerPasswordReset(body.token ?? "");
  if (!valid) {
    return NextResponse.json(
      { valid: false, error: "This reset link is invalid or has expired." },
      { status: 400 }
    );
  }
  return NextResponse.json({ valid: true });
}
