import { NextResponse } from "next/server";

import { resolveRegistration } from "@/lib/enrich-registration";
import {
  buildRegistrationFromInput,
  validateRegistrationCreate,
  type CreateRegistrationInput,
} from "@/lib/registration-validation";
import { loadEvents, saveEvents } from "@/lib/server/events-persistence";
import {
  loadRawRegistrations,
  loadRegistrations,
  saveRegistrations,
} from "@/lib/server/registrations-persistence";
import { generateId } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(loadRegistrations());
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<CreateRegistrationInput> & {
    kind?: CreateRegistrationInput["kind"];
  };
  const events = loadEvents();
  const validated = validateRegistrationCreate(body, events);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const event = events.find((item) => item.id === validated.data.eventId);
  if (!event) {
    return NextResponse.json({ error: "Selected event was not found" }, { status: 400 });
  }

  const registrations = loadRawRegistrations();
  const now = new Date().toISOString();
  const created = buildRegistrationFromInput(
    validated.data,
    event,
    registrations,
    `reg-${generateId()}`,
    now
  );

  saveRegistrations([created, ...registrations]);

  const nextEvents = events.map((item) =>
    item.id === event.id
      ? {
          ...item,
          registrationCount: (item.registrationCount ?? 0) + 1,
          updatedAt: now,
        }
      : item
  );
  saveEvents(nextEvents);

  return NextResponse.json(resolveRegistration(created, nextEvents));
}
