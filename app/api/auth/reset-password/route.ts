import { NextResponse } from "next/server";

import { resetPasswordApiSchema } from "@/lib/auth-validation";
import { isAdminUserError } from "@/lib/server/admin-user-errors";
import { resetAdminPasswordWithToken } from "@/lib/server/admin-password-reset-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = resetPasswordApiSchema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      {
        success: false,
        error: issue?.message ?? "Invalid password reset request",
      },
      { status: 400 }
    );
  }

  try {
    const result = await resetAdminPasswordWithToken(
      parsed.data.token,
      parsed.data.password
    );
    return NextResponse.json({ success: true, message: result.message });
  } catch (error) {
    if (isAdminUserError(error)) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: "Unable to reset password. Please try again.",
      },
      { status: 500 }
    );
  }
}
