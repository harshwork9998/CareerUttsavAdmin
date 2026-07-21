import { NextResponse } from "next/server";

import { loadPartners, savePartners } from "@/lib/server/partners-persistence";
import { generateId } from "@/lib/utils";
import type { Partner } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const partners = loadPartners();
  return NextResponse.json(partners);
}

export async function POST(request: Request) {
  const body = (await request.json()) as Omit<
    Partner,
    "id" | "createdAt" | "updatedAt"
  >;
  const now = new Date().toISOString();
  const created: Partner = {
    ...body,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  const partners = loadPartners();
  savePartners([created, ...partners]);
  return NextResponse.json(created);
}
