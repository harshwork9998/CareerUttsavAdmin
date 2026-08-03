import { NextResponse } from "next/server";

import {
  DUPLICATE_STUDENT_REGISTRATION_MESSAGE,
  findStudentRegistrationDuplicate,
} from "@/lib/registration-duplicates";
import { loadRawRegistrations } from "@/lib/server/registrations-persistence";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

/** Live duplicate lookup for the public registration site (always reads current store). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId")?.trim() ?? "";
  const email = searchParams.get("email")?.trim() ?? "";
  const phone = searchParams.get("phone")?.trim() ?? "";

  if (!email && !phone) {
    return NextResponse.json(
      { error: "email or phone is required" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const duplicate = findStudentRegistrationDuplicate(loadRawRegistrations(), {
    ...(eventId ? { eventId } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
  });

  return NextResponse.json(
    {
      duplicate: Boolean(duplicate),
      message: duplicate ? DUPLICATE_STUDENT_REGISTRATION_MESSAGE : null,
      registration: duplicate
        ? {
            id: duplicate.id,
            registrationNumber: duplicate.registrationNumber,
            studentName: duplicate.studentName,
            email: duplicate.email,
            phone: duplicate.phone,
          }
        : null,
    },
    { headers: NO_STORE_HEADERS }
  );
}
