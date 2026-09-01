import { NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/server/admin-auth";
import { listSpocsForApi, createSpocForApi } from "@/lib/server/spoc-service";
import type { Spoc } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminUser();
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json(await listSpocsForApi());
}

export async function POST(request: Request) {
  const auth = await requireAdminUser();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as Partial<Spoc>;
  const result = await createSpocForApi(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.spoc, { status: result.status ?? 200 });
}
