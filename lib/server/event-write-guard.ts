import { NextResponse } from "next/server";

import { isPrismaRegistrationPersistence } from "@/lib/server/registration-persistence-mode";

export const EVENT_ADMIN_UNAVAILABLE_MESSAGE =
  "Event administration is temporarily unavailable during the database migration.";

/**
 * When registration persistence is on Prisma, event CRUD is frozen until
 * event writes are migrated. Returns a 503 response or null when allowed.
 */
export function getEventWriteBlockedResponse(): NextResponse | null {
  if (!isPrismaRegistrationPersistence()) {
    return null;
  }

  return NextResponse.json(
    { error: EVENT_ADMIN_UNAVAILABLE_MESSAGE },
    { status: 503 }
  );
}
