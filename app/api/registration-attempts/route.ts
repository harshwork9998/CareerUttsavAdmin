import { NextResponse } from "next/server";

import { consumePhoneVerification } from "@/lib/otp";
import { normalizeAttemptEmail, normalizeAttemptPhone } from "@/lib/registration-attempt";
import { DEFAULT_PARTIAL_ATTEMPT_STATUSES } from "@/lib/registration-attempt";
import { checkStudentRegistrationDuplicate } from "@/lib/server/registration-service";
import { requireAdminUser } from "@/lib/server/admin-auth";
import { listEventsForApi } from "@/lib/server/event-service";
import {
  createWebsiteRegistrationAttempt,
  listRegistrationAttempts,
} from "@/lib/server/registration-attempt-store";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

export async function GET() {
  const auth = await requireAdminUser();
  if (auth instanceof NextResponse) return auth;

  const attempts = await listRegistrationAttempts({
    statuses: DEFAULT_PARTIAL_ATTEMPT_STATUSES,
  });
  return NextResponse.json(attempts, { headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  let body: {
    eventId?: string;
    phone?: string;
    name?: string;
    email?: string;
    phoneVerificationToken?: string;
    source?: string;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const phone = normalizeAttemptPhone(body.phone).phone;
  const email = body.email?.trim() ?? "";
  const name = body.name?.trim() ?? "";
  const eventId = body.eventId?.trim() ?? "";
  if (name.length < 2) {
    return NextResponse.json(
      { error: "Student name is required" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }
  if (!normalizeAttemptEmail(email)) {
    return NextResponse.json(
      { error: "A valid email address is required" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const verification = consumePhoneVerification({
    phone,
    purpose: "student_registration",
    verificationToken: body.phoneVerificationToken ?? "",
    consume: false,
  });
  if (!verification.ok) {
    return NextResponse.json(
      { error: verification.error },
      { status: verification.status, headers: NO_STORE_HEADERS }
    );
  }

  const events = await listEventsForApi();
  if (!events.some((event) => event.id === eventId)) {
    return NextResponse.json(
      { error: "Selected event was not found" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const duplicate = await checkStudentRegistrationDuplicate({
    eventId,
    phone,
    email,
  });
  if (duplicate.duplicate) {
    return NextResponse.json(
      { error: duplicate.message, duplicate: true },
      { status: 409, headers: NO_STORE_HEADERS }
    );
  }

  const attempt = await createWebsiteRegistrationAttempt({
    eventId,
    phone,
    name,
    email,
  });
  return NextResponse.json(
    { attemptId: attempt.id },
    { headers: NO_STORE_HEADERS }
  );
}
