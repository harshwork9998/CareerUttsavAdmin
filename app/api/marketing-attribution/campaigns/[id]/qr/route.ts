import { NextResponse } from "next/server";
import QRCode from "qrcode";

import { requireSuperuser } from "@/lib/server/admin-auth";
import { buildCampaignTrackingUrl } from "@/lib/marketing-attribution/tracking-url";
import { getMarketingCampaignById } from "@/lib/server/marketing-attribution-prisma-store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperuser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const campaign = await getMarketingCampaignById(id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const url = buildCampaignTrackingUrl(campaign.trackingCode);
  const png = await QRCode.toBuffer(url, {
    type: "png",
    width: 512,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  const filename = `${campaign.trackingCode}-qr.png`;
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}