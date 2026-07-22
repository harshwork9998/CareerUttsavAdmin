import { NextResponse } from "next/server";

import { loadRegistrations } from "@/lib/server/registrations-persistence";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(loadRegistrations());
}
