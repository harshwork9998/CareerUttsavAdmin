import { NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/server/admin-auth";
import { checkInRegistrationForApi } from "@/lib/server/registration-check-in";
import type { RegistrationCheckInPayload } from "@/lib/server/registration-check-in-types";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

export async function POST(request: Request) {
  const auth = await requireAdminUser();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as RegistrationCheckInPayload;
  const result = await checkInRegistrationForApi(body);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, code: result.code },
      { status: result.status, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(result.data, {
    status: 200,
    headers: NO_STORE_HEADERS,
  });
}
