import { NextResponse } from "next/server";

import { requireSuperuser } from "@/lib/server/admin-auth";
import { updateLeadSourceForApi } from "@/lib/server/marketing-attribution-service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperuser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;
  const result = await updateLeadSourceForApi(id, body, auth.user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}