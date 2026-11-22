import { NextResponse } from "next/server";

import { requireSuperuser } from "@/lib/server/admin-auth";
import {
  createNewCampaign,
  listCampaigns,
} from "@/lib/server/whatsapp/campaign-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSuperuser();
  if (auth instanceof NextResponse) return auth;

  const items = await listCampaigns();
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const auth = await requireSuperuser();
  if (auth instanceof NextResponse) return auth;

  let body: { name?: string };
  try {
    body = (await request.json()) as { name?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Enter a campaign name." }, { status: 400 });
  }

  const campaign = await createNewCampaign(name, auth.user.id);
  return NextResponse.json({ campaign });
}