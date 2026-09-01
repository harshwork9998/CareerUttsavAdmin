import { NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/server/admin-auth";
import {
  applyPartnerCredentialFields,
  toPublicPartner,
} from "@/lib/partner-credentials";
import {
  createPartnerForApi,
  listPartnersForApi,
} from "@/lib/server/partner-service";
import { validatePartnerCreate } from "@/lib/partner-validation";
import { generateId } from "@/lib/utils";
import type { Partner } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminUser();
  if (auth instanceof NextResponse) return auth;

  const partners = await listPartnersForApi();
  return NextResponse.json(partners.map(toPublicPartner));
}

export async function POST(request: Request) {
  const auth = await requireAdminUser();
  if (auth instanceof NextResponse) return auth;

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

  const result = await createPartnerForApi(created);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(toPublicPartner(result.partner));
}
