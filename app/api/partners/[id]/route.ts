import { NextResponse } from "next/server";

import { loadPartners, savePartners } from "@/lib/server/partners-persistence";
import type { Partner } from "@/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const partner = loadPartners().find((p) => p.id === id);
  if (!partner) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(partner);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const patch = (await request.json()) as Partial<Partner>;
  const partners = loadPartners();
  const idx = partners.findIndex((p) => p.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const updated: Partner = {
    ...partners[idx],
    ...patch,
    id: partners[idx].id,
    updatedAt: new Date().toISOString(),
  };
  const next = [...partners];
  next[idx] = updated;
  savePartners(next);
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const partners = loadPartners();
  const next = partners.filter((p) => p.id !== id);
  if (next.length === partners.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  savePartners(next);
  return NextResponse.json(next);
}
