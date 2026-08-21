import { NextResponse } from "next/server";

import { checkStudentRegistrationDuplicate } from "@/lib/server/registration-service";

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

  const result = await checkStudentRegistrationDuplicate({
    ...(eventId ? { eventId } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
  });

  return NextResponse.json(result, { headers: NO_STORE_HEADERS });
}
