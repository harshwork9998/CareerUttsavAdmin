import { NextResponse } from "next/server";

import { parseOtpPurpose, sendOtp } from "@/lib/otp";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

export async function POST(request: Request) {
  let body: { phone?: string; purpose?: string } = {};
  try {
    body = (await request.json()) as { phone?: string; purpose?: string };
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

  const result = await sendOtp({
    phone: body.phone ?? "",
    purpose,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        retryAfterSeconds: result.retryAfterSeconds,
      },
      { status: result.status, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: result.message,
      expiresInSeconds: result.expiresInSeconds,
      resendAfterSeconds: result.resendAfterSeconds,
      ...(result.debugCode ? { debugCode: result.debugCode } : {}),
    },
    { headers: NO_STORE_HEADERS }
  );
}
