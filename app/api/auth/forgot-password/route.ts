import { NextResponse } from "next/server";

import { forgotPasswordSchema } from "@/lib/auth-validation";
import { requestAdminPasswordReset } from "@/lib/server/admin-password-reset-service";

export const dynamic = "force-dynamic";

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? null;
  }
  return request.headers.get("x-real-ip");
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = forgotPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Please enter a valid email address" },
      { status: 400 }
    );
  }

  const result = await requestAdminPasswordReset(parsed.data.email, {
    ip: getClientIp(request),
  });

  return NextResponse.json({
    success: true,
    message: result.message,
  });
}
