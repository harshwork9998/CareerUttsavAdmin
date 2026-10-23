import { NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/server/admin-auth";
import {
  generatePartnerPortalPassword,
  sendPartnerPortalAccessEmail,
  setPartnerPortalAccess,
} from "@/lib/server/partner-access-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  let body: {
    action?: string;
    enabled?: boolean;
    temporaryPassword?: string;
    portalLogin?: string;
    portalInviteEmail?: string;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.action === "generate_password") {
    const result = await generatePartnerPortalPassword(id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  }

  if (body.action === "set_access") {
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "enabled is required" }, { status: 400 });
    }
    const result = await setPartnerPortalAccess(id, body.enabled);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  }

  if (body.action === "send_access_email") {
    const result = await sendPartnerPortalAccessEmail({
      partnerId: id,
      temporaryPassword: body.temporaryPassword ?? "",
      portalLogin: body.portalLogin,
      portalInviteEmail: body.portalInviteEmail,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
