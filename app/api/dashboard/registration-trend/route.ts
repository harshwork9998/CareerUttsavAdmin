import { NextResponse } from "next/server";

import { buildRegistrationTrendSeries } from "@/lib/registration-time-series";
import { loadEvents } from "@/lib/server/events-persistence";
import { loadRegistrations } from "@/lib/server/registrations-persistence";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from")?.trim() ?? "";
  const to = searchParams.get("to")?.trim() ?? "";
  const city = (searchParams.get("city")?.trim() || "all") as string | "all";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json(
      { error: "from and to are required as YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const series = buildRegistrationTrendSeries({
    registrations: loadRegistrations(),
    events: loadEvents(),
    city,
    from,
    to,
  });

  return NextResponse.json(series);
}
