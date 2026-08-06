import { NextResponse } from "next/server";

import { validateSpocInput } from "@/lib/spoc-validation";
import {
  findSpocByEmail,
  loadSpocs,
  saveSpocs,
} from "@/lib/server/spocs-persistence";
import type { Spoc } from "@/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const spoc = loadSpocs().find((s) => s.id === id);
  if (!spoc) {
    return NextResponse.json({ error: "SPOC not found" }, { status: 404 });
  }
  return NextResponse.json(spoc);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as Partial<Spoc>;
  const spocs = loadSpocs();
  const index = spocs.findIndex((s) => s.id === id);
  if (index < 0) {
    return NextResponse.json({ error: "SPOC not found" }, { status: 404 });
  }

  const current = spocs[index];
  const validated = validateSpocInput({
    name: body.name ?? current.name,
    organization: body.organization ?? current.organization,
    phone: body.phone ?? current.phone,
    email: body.email ?? current.email,
  });
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const emailOwner = findSpocByEmail(spocs, validated.data.email);
  if (emailOwner && emailOwner.id !== id) {
    return NextResponse.json(
      { error: "Another SPOC already uses this email" },
      { status: 409 }
    );
  }

  const updated: Spoc = {
    ...current,
    ...validated.data,
    updatedAt: new Date().toISOString(),
  };
  spocs[index] = updated;
  saveSpocs(spocs);
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const spocs = loadSpocs();
  if (!spocs.some((s) => s.id === id)) {
    return NextResponse.json({ error: "SPOC not found" }, { status: 404 });
  }
  const next = spocs.filter((s) => s.id !== id);
  saveSpocs(next);
  return NextResponse.json(next);
}
