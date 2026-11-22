import { NextResponse } from "next/server";

import { requireSuperuser } from "@/lib/server/admin-auth";
import { startCampaign } from "@/lib/server/whatsapp/campaign-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireSuperuser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;

  try {
    const result = await startCampaign(id);
    return NextResponse.json({
      ok: true,
      message: "Campaign started.",
      pending: result.pending,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "This campaign could not be started.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}