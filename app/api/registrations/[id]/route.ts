import { NextResponse } from "next/server";

import { resolveRegistration } from "@/lib/enrich-registration";
import { loadEvents, saveEvents } from "@/lib/server/events-persistence";
import {
  loadRawRegistrations,
  saveRegistrations,
} from "@/lib/server/registrations-persistence";
import type { Registration } from "@/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const registrations = loadRawRegistrations();
  const registration = registrations.find((entry) => entry.id === id);
  if (!registration) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(
    resolveRegistration(registration, loadEvents())
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const patch = (await request.json()) as Partial<Registration>;
  const registrations = loadRawRegistrations();
  const idx = registrations.findIndex((entry) => entry.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = registrations[idx];
  const updated = {
    ...existing,
    ...patch,
    id: existing.id,
    kind: existing.kind,
    updatedAt: new Date().toISOString(),
  } as Registration;

  const next = [...registrations];
  next[idx] = updated;
  saveRegistrations(next);
  return NextResponse.json(resolveRegistration(updated, loadEvents()));
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const registrations = loadRawRegistrations();
  const removed = registrations.find((entry) => entry.id === id);
  if (!removed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  saveRegistrations(registrations.filter((entry) => entry.id !== id));

  const events = loadEvents();
  const eventId = removed.eventId;
  if (events.some((event) => event.id === eventId)) {
    const now = new Date().toISOString();
    saveEvents(
      events.map((event) =>
        event.id === eventId
          ? {
              ...event,
              registrationCount: Math.max(0, (event.registrationCount ?? 0) - 1),
              updatedAt: now,
            }
          : event
      )
    );
  }

  return NextResponse.json({ success: true, id });
}
