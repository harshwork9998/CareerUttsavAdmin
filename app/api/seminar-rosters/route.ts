import { NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/server/admin-auth";
import {
  listSeminarRostersForApi,
  upsertSeminarRosterForApi,
} from "@/lib/server/seminar-roster-service";
import type { SeminarSessionRoster } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminUser();
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json(await listSeminarRostersForApi());
}

export async function POST(request: Request) {
  const auth = await requireAdminUser();
  if (auth instanceof NextResponse) return auth;

  const roster = (await request.json()) as SeminarSessionRoster;

  if (!roster.eventId || !roster.seminarId) {
    return NextResponse.json(
      { error: "Seminar session is not linked to a current event" },
      { status: 400 }
    );
  }

  const result = await upsertSeminarRosterForApi(roster);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.roster);
}
