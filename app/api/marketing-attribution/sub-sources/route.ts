import { NextResponse } from "next/server";

import { requireSuperuser } from "@/lib/server/admin-auth";
import { createLeadSubSourceForApi } from "@/lib/server/marketing-attribution-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireSuperuser();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as Record<string, unknown>;
  const result = await createLeadSubSourceForApi(body, auth.user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data, { status: result.status ?? 201 });
}