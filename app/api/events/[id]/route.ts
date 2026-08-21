import { NextResponse } from "next/server";

import {
  partnerNeedsEventLinkPrune,
  prunePartnerEventLinks,
} from "@/lib/partner-event-config";
import { filterRegistrationsForEventCatalog } from "@/lib/registration-event-links";
import { filterRostersForEventCatalog } from "@/lib/seminar-roster-links";
import { getEventForApi } from "@/lib/server/event-service";
import { loadEvents, saveEvents } from "@/lib/server/events-persistence";
import { loadPartners, savePartners } from "@/lib/server/partners-persistence";
import {
  loadRawRegistrations,
  saveRegistrations,
} from "@/lib/server/registrations-persistence";
import {
  loadRawSeminarRosters,
  saveSeminarRosters,
} from "@/lib/server/seminar-rosters-persistence";
import type { Event, Partner } from "@/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function prunePartnersForEventCatalog(events: Event[]): Partner[] {
  const validEventIds = new Set(events.map((event) => event.id));
  const partners = loadPartners();
  let changed = false;

  const next = partners.map((partner) => {
    if (!partnerNeedsEventLinkPrune(partner, validEventIds)) {
      return partner;
    }
    changed = true;
    return prunePartnerEventLinks(partner, validEventIds);
  });

  return changed ? savePartners(next) : partners;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const event = await getEventForApi(id);
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(event);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const patch = (await request.json()) as Partial<Event>;

  if (patch.city !== undefined && patch.city.trim().length < 2) {
    return NextResponse.json(
      { error: "Event city is required (at least 2 characters)" },
      { status: 400 }
    );
  }

  const events = loadEvents();
  const idx = events.findIndex((entry) => entry.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated: Event = {
    ...events[idx],
    ...patch,
    ...(patch.city !== undefined ? { city: patch.city.trim() } : {}),
    id: events[idx].id,
    updatedAt: new Date().toISOString(),
  };

  const next = [...events];
  next[idx] = updated;
  saveEvents(next);
  pruneSeminarRostersForEventCatalog(next);
  return NextResponse.json(updated);
}

function pruneRegistrationsForEventCatalog(events: Event[]): void {
  const validEventIds = new Set(events.map((event) => event.id));
  const registrations = loadRawRegistrations();
  const next = filterRegistrationsForEventCatalog(registrations, validEventIds);
  if (next.length !== registrations.length) {
    saveRegistrations(next);
  }
}

function pruneSeminarRostersForEventCatalog(events: Event[]): void {
  const rosters = loadRawSeminarRosters();
  const next = filterRostersForEventCatalog(rosters, events);
  if (next.length !== rosters.length) {
    saveSeminarRosters(next);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const current = loadEvents();
  const events = current.filter((entry) => entry.id !== id);
  if (events.length === current.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  saveEvents(events);
  prunePartnersForEventCatalog(events);
  pruneRegistrationsForEventCatalog(events);
  pruneSeminarRostersForEventCatalog(events);
  return NextResponse.json(events);
}
