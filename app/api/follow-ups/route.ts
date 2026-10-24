import { NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/server/admin-auth";
import { listFollowUpApiItemsForAdminUser } from "@/lib/server/partner-follow-up-resolver";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminUser();
  if (auth instanceof NextResponse) return auth;

  const items = await listFollowUpApiItemsForAdminUser({ user: auth.user });
  return NextResponse.json({ items });
}
