import { NextResponse } from "next/server";

import { mockEvents } from "@/lib/mock-data/events";

export const dynamic = "force-dynamic";

/** Event catalog for the partner portal (seminar titles, schedule, halls). */
export async function GET() {
  const events = mockEvents.map((event) => ({
    id: event.id,
    title: event.title,
    city: event.city,
    startDate: event.startDate,
    endDate: event.endDate,
    seminars: event.seminars.map((seminar) => ({
      id: seminar.id,
      title: seminar.title,
      date: seminar.date,
      startTime: seminar.startTime,
      endTime: seminar.endTime,
      hall: seminar.hall,
    })),
  }));

  return NextResponse.json(events);
}
