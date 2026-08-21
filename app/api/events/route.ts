import { NextResponse } from "next/server";

import { loadEvents, saveEvents } from "@/lib/server/events-persistence";
import { listEventsForApi } from "@/lib/server/event-service";
import { generateId } from "@/lib/utils";
import type { Event } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listEventsForApi());
}

export async function POST(request: Request) {
  const body = (await request.json()) as Omit<
    Event,
    "id" | "createdAt" | "updatedAt"
  >;

  const city = body.city?.trim() ?? "";
  if (city.length < 2) {
    return NextResponse.json(
      { error: "Event city is required (at least 2 characters)" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const created: Event = {
    ...body,
    city,
    id: generateId(),
    seminars: body.seminars ?? [],
    startTime: body.startTime ?? "09:00",
    endTime: body.endTime ?? "18:00",
    hallCount: body.hallCount ?? 1,
    venue: body.venue ?? "",
    createdAt: now,
    updatedAt: now,
  };

  const events = [created, ...loadEvents()];
  saveEvents(events);
  return NextResponse.json(created);
}
