import { NextResponse } from "next/server";

import { isPrismaEventWritePersistence } from "@/lib/server/event-write-persistence-mode";
import { isPrismaRegistrationPersistence } from "@/lib/server/registration-persistence-mode";

export const EVENT_ADMIN_UNAVAILABLE_MESSAGE =
  "Event administration is temporarily unavailable during the database migration.";

/**
 * Blocks Event writes when registration reads are on Prisma but Event writes
 * have not been explicitly enabled via EVENT_WRITE_PERSISTENCE=prisma.
 */
export function getEventWriteBlockedResponse(): NextResponse | null {
  if (!isPrismaRegistrationPersistence()) {
    return null;
  }

  if (isPrismaEventWritePersistence()) {
    return null;
  }

  return NextResponse.json(
    { error: EVENT_ADMIN_UNAVAILABLE_MESSAGE },
    { status: 503 }
  );
}
