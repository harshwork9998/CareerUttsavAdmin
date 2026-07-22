import { NextResponse } from "next/server";

import { resolveRegistration } from "@/lib/enrich-registration";
import { loadEvents } from "@/lib/server/events-persistence";
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

  const updated: Registration = {
    ...registrations[idx],
    ...patch,
    id: registrations[idx].id,
    updatedAt: new Date().toISOString(),
  };

  const next = [...registrations];
  next[idx] = updated;
  saveRegistrations(next);
  return NextResponse.json(resolveRegistration(updated, loadEvents()));
}
