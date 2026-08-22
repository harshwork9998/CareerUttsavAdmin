import { NextResponse } from "next/server";

import { listEventsForApi } from "@/lib/server/event-service";
import { getEventWriteBlockedResponse } from "@/lib/server/event-write-guard";
import { createEventForApi } from "@/lib/server/event-write-service";
import type { Event } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listEventsForApi());
}

export async function POST(request: Request) {
  const blocked = getEventWriteBlockedResponse();
  if (blocked) return blocked;

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

  const result = await createEventForApi(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
