import { NextResponse } from "next/server";

import { validateSpocInput } from "@/lib/spoc-validation";
import {
  findSpocByEmail,
  loadSpocs,
  saveSpocs,
} from "@/lib/server/spocs-persistence";
import { generateId } from "@/lib/utils";
import type { Spoc } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(loadSpocs());
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<Spoc>;
  const validated = validateSpocInput(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const spocs = loadSpocs();
  const existing = findSpocByEmail(spocs, validated.data.email);
  if (existing) {
    const updated: Spoc = {
      ...existing,
      name: validated.data.name,
      organization: validated.data.organization,
      phone: validated.data.phone,
      email: validated.data.email,
      updatedAt: new Date().toISOString(),
    };
    saveSpocs(spocs.map((s) => (s.id === existing.id ? updated : s)));
    return NextResponse.json(updated);
  }

  const now = new Date().toISOString();
  const created: Spoc = {
    id: generateId(),
    ...validated.data,
    createdAt: now,
    updatedAt: now,
  };
  saveSpocs([created, ...spocs]);
  return NextResponse.json(created, { status: 201 });
}
