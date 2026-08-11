import { NextResponse } from "next/server";

import {
  applyPartnerCredentialFields,
  toPublicPartner,
} from "@/lib/partner-credentials";
import { loadPartners, savePartners } from "@/lib/server/partners-persistence";
import { validatePartnerContactPhones } from "@/lib/partner-validation";
import type { Partner } from "@/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const partner = loadPartners().find((p) => p.id === id);
  if (!partner) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(toPublicPartner(partner));
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const patch = (await request.json()) as Partial<Partner>;
  const partners = loadPartners();
  const idx = partners.findIndex((p) => p.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const phones = validatePartnerContactPhones(patch, partners[idx]);
  if (!phones.ok) {
    return NextResponse.json({ error: phones.error }, { status: 400 });
  }

  const updated = applyPartnerCredentialFields(partners[idx], {
    ...phones.patch,
    updatedAt: new Date().toISOString(),
  });
  const next = [...partners];
  next[idx] = updated;
  savePartners(next);
  return NextResponse.json(toPublicPartner(updated));
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const partners = loadPartners();
  const next = partners.filter((p) => p.id !== id);
  if (next.length === partners.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  savePartners(next);
  return NextResponse.json(next.map(toPublicPartner));
}
