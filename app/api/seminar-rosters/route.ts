import { NextResponse } from "next/server";

import {
  loadRawSeminarRosters,
  loadSeminarRosters,
  upsertSeminarRoster,
} from "@/lib/server/seminar-rosters-persistence";
import { loadEvents } from "@/lib/server/events-persistence";
import { applySeminarSpeakerMobileValidation } from "@/lib/seminar-roster-mobile";
import { buildValidSeminarSessionKeys } from "@/lib/seminar-roster-links";
import type { SeminarSessionRoster } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(loadSeminarRosters());
}

export async function POST(request: Request) {
  const roster = (await request.json()) as SeminarSessionRoster;
  const events = loadEvents();
  const validSessions = buildValidSeminarSessionKeys(events);

  if (
    !roster.eventId ||
    !roster.seminarId ||
    !validSessions.has(`${roster.eventId}:${roster.seminarId}`)
  ) {
    return NextResponse.json(
      { error: "Seminar session is not linked to a current event" },
      { status: 400 }
    );
  }

  const existing = loadRawSeminarRosters().find(
    (entry) =>
      entry.eventId === roster.eventId && entry.seminarId === roster.seminarId
  );

  const mobiles = applySeminarSpeakerMobileValidation(roster, existing);
  if (!mobiles.ok) {
    return NextResponse.json({ error: mobiles.error }, { status: 400 });
  }

  const saved = upsertSeminarRoster({
    ...mobiles.roster,
    eventId: roster.eventId,
    seminarId: roster.seminarId,
  });
  return NextResponse.json(saved);
}
