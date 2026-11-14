import { NextResponse } from "next/server";

import { requireSuperuser } from "@/lib/server/admin-auth";
import {
  createMarketingCampaignForApi,
  suggestCampaignCodeForApi,
} from "@/lib/server/marketing-attribution-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireSuperuser();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as Record<string, unknown>;
  const result = await createMarketingCampaignForApi(body, auth.user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data, { status: result.status ?? 201 });
}

export async function GET(request: Request) {
  const auth = await requireSuperuser();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const suggest = searchParams.get("suggestCode");
  const name = searchParams.get("name") ?? "";
  if (suggest === "1") {
    return NextResponse.json({ code: await suggestCampaignCodeForApi(name) });
  }
  return NextResponse.json({ error: "Unsupported query" }, { status: 400 });
}