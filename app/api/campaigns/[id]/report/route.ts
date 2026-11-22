import { NextResponse } from "next/server";

import { requireSuperuser } from "@/lib/server/admin-auth";
import { buildCampaignReportCsv } from "@/lib/server/whatsapp/campaign-report";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireSuperuser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const campaign = await prisma.whatsAppCampaign.findUnique({
    where: { id },
    select: { name: true },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  const csv = await buildCampaignReportCsv(id);
  const safeName = campaign.name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="campaign-${safeName}-${id}.csv"`,
    },
  });
}