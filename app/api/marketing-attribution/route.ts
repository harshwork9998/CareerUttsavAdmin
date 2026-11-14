import { NextResponse } from "next/server";

import { requireSuperuser } from "@/lib/server/admin-auth";
import { getMarketingAttributionTreeForApi } from "@/lib/server/marketing-attribution-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSuperuser();
  if (auth instanceof NextResponse) return auth;

  const tree = await getMarketingAttributionTreeForApi();
  return NextResponse.json(tree);
}