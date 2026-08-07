import { NextResponse } from "next/server";

import {
  applyPartnerCredentialFields,
  toPublicPartner,
} from "@/lib/partner-credentials";
import { loadPartners, savePartners } from "@/lib/server/partners-persistence";
import { validatePartnerCreate } from "@/lib/partner-validation";
import { generateId } from "@/lib/utils";
import type { Partner } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const partners = loadPartners();
  return NextResponse.json(partners.map(toPublicPartner));
}

export async function POST(request: Request) {
  const body = (await request.json()) as Omit<
    Partner,
    "id" | "createdAt" | "updatedAt"
  >;
  const validated = validatePartnerCreate(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const now = new Date().toISOString();
  const created = applyPartnerCredentialFields(
    {
      ...validated.data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    } as Partner,
    validated.data
  );
  const partners = loadPartners();
  savePartners([created, ...partners]);
  return NextResponse.json(toPublicPartner(created));
}
