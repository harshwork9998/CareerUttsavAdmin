import { NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/server/admin-auth";
import { buildRegistrationTrendSeries } from "@/lib/registration-time-series";
import { listEventsForApi } from "@/lib/server/event-service";
import { listRegistrationsForApi } from "@/lib/server/registration-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminUser();
  if (auth instanceof NextResponse) return auth;

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

  const [registrations, events] = await Promise.all([
    listRegistrationsForApi(),
    listEventsForApi(),
  ]);

  const series = buildRegistrationTrendSeries({
    registrations,
    events,
    city,
    from,
    to,
  });

  return NextResponse.json(series);
}
