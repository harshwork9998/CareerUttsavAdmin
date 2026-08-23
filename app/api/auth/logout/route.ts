import { NextResponse } from "next/server";

import { buildAdminSessionClearCookie } from "@/lib/server/admin-session";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.headers.set("Set-Cookie", buildAdminSessionClearCookie());
  return response;
}
