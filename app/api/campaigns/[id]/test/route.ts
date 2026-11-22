import { NextResponse } from "next/server";

import { requireSuperuser } from "@/lib/server/admin-auth";
import { sendCampaignTest } from "@/lib/server/whatsapp/campaign-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireSuperuser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  let body: { testMobile?: string };
  try {
    body = (await request.json()) as { testMobile?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const result = await sendCampaignTest({
      campaignId: id,
      testMobile: body.testMobile ?? "",
    });
    return NextResponse.json({
      ok: true,
      message: "Test message accepted.",
      dryRun: process.env.WHATSAPP_CAMPAIGN_DRY_RUN === "true",
      messageId: result.messageId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The test could not be sent.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}