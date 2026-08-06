import { NextResponse } from "next/server";

import { parseOtpPurpose, verifyOtp } from "@/lib/otp";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

export async function POST(request: Request) {
  let body: { phone?: string; purpose?: string; code?: string } = {};
  try {
    body = (await request.json()) as {
      phone?: string;
      purpose?: string;
      code?: string;
    };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const purpose = parseOtpPurpose(body.purpose ?? "student_registration");
  if (!purpose) {
    return NextResponse.json(
      { error: "Invalid OTP purpose" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const result = await verifyOtp({
    phone: body.phone ?? "",
    purpose,
    code: body.code ?? "",
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: result.message,
      verificationToken: result.verificationToken,
      phone: result.phone,
      purpose: result.purpose,
    },
    { headers: NO_STORE_HEADERS }
  );
}
