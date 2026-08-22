import { NextResponse } from "next/server";

import { getEventForApi } from "@/lib/server/event-service";
import { getEventWriteBlockedResponse } from "@/lib/server/event-write-guard";
import {
  deleteEventForApi,
  patchEventForApi,
} from "@/lib/server/event-write-service";
import type { Event } from "@/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const event = await getEventForApi(id);
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(event);
}

export async function PATCH(request: Request, context: RouteContext) {
  const blocked = getEventWriteBlockedResponse();
  if (blocked) return blocked;

  const { id } = await context.params;
  const patch = (await request.json()) as Partial<Event>;

  if (patch.city !== undefined && patch.city.trim().length < 2) {
    return NextResponse.json(
      { error: "Event city is required (at least 2 characters)" },
      { status: 400 }
    );
  }

  const result = await patchEventForApi(id, patch);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const blocked = getEventWriteBlockedResponse();
  if (blocked) return blocked;

  const { id } = await context.params;
  const result = await deleteEventForApi(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
