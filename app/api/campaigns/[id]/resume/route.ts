import { NextResponse } from "next/server";

import { requireSuperuser } from "@/lib/server/admin-auth";
import { setCampaignStatus } from "@/lib/server/whatsapp/campaign-store";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireSuperuser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const campaign = await prisma.whatsAppCampaign.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }
  if (campaign.status !== "PAUSED") {
    return NextResponse.json({
      error: "Only a paused campaign can be resumed.",
    }, { status: 400 });
  }

  await setCampaignStatus(id, "RUNNING");
  return NextResponse.json({ ok: true, message: "Campaign resumed." });
}