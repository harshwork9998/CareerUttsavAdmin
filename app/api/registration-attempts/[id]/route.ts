import { NextResponse } from "next/server";

import { consumePhoneVerification } from "@/lib/otp";
import {
  normalizeAttemptPhone,
  type RegistrationAttemptRecord,
} from "@/lib/registration-attempt";
import {
  getRegistrationAttempt,
  updateWebsiteRegistrationAttemptAcademics,
} from "@/lib/server/registration-attempt-store";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

function isGender(value: string): value is NonNullable<RegistrationAttemptRecord["gender"]> {
  return value === "Male" || value === "Female" || value === "Other";
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  let body: {
    phone?: string;
    phoneVerificationToken?: string;
    college?: string;
    classLabel?: string;
    board?: string;
    interestedStream?: string;
    city?: string;
    gender?: string;
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

  const phone = normalizeAttemptPhone(body.phone);
  if (!phone.phoneLast10) {
    return NextResponse.json(
      { error: "Mobile number is invalid" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const verification = consumePhoneVerification({
    phone: phone.phone,
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

  const college = body.college?.trim() ?? "";
  const classLabel = body.classLabel?.trim() ?? "";
  const board = body.board?.trim() ?? "";
  const interestedStream = body.interestedStream?.trim() ?? "";
  const city = body.city?.trim() ?? "";
  const gender = body.gender?.trim() ?? "";
  if (
    college.length < 2 ||
    classLabel.length < 2 ||
    board.length < 2 ||
    interestedStream.length < 2 ||
    city.length < 2 ||
    !isGender(gender)
  ) {
    return NextResponse.json(
      { error: "Academic details are incomplete" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const existing = await getRegistrationAttempt(id);
  if (!existing || existing.status === "COMPLETED") {
    return NextResponse.json(
      { error: "Registration attempt is not open." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }
  if (existing.phoneLast10 !== phone.phoneLast10) {
    return NextResponse.json(
      { error: "Registration attempt does not match this mobile number." },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const updated = await updateWebsiteRegistrationAttemptAcademics({
    attemptId: id,
    phoneLast10: phone.phoneLast10,
    college,
    classLabel,
    board,
    interestedStream,
    city,
    gender,
  });
  if (!updated) {
    return NextResponse.json(
      { error: "Registration attempt is not open." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    { attemptId: updated.id, lastStep: updated.lastStep },
    { headers: NO_STORE_HEADERS }
  );
}
