import { NextResponse } from "next/server";

import { listSpocsForApi, createSpocForApi } from "@/lib/server/spoc-service";
import type { Spoc } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listSpocsForApi());
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<Spoc>;
  const result = await createSpocForApi(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.spoc, { status: result.status ?? 200 });
}
