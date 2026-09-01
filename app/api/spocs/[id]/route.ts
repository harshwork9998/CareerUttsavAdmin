import { NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/server/admin-auth";
import {
  deleteSpocForApi,
  getSpocByIdForApi,
  updateSpocForApi,
} from "@/lib/server/spoc-service";
import type { Spoc } from "@/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const spoc = await getSpocByIdForApi(id);
  if (!spoc) {
    return NextResponse.json({ error: "SPOC not found" }, { status: 404 });
  }
  return NextResponse.json(spoc);
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const body = (await request.json()) as Partial<Spoc>;
  const result = await updateSpocForApi(id, body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.spoc);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const result = await deleteSpocForApi(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.spocs);
}
