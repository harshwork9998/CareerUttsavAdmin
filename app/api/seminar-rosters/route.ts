import { NextResponse } from "next/server";

import {
  listSeminarRostersForApi,
  upsertSeminarRosterForApi,
} from "@/lib/server/seminar-roster-service";
import type { SeminarSessionRoster } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listSeminarRostersForApi());
}

export async function POST(request: Request) {
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
