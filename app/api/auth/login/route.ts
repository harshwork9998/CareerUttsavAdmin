import { NextResponse } from "next/server";

import { authLookupToResponse } from "@/lib/server/admin-auth";
import { authenticateAdminUser } from "@/lib/server/admin-user-service";
import {
  buildAdminSessionSetCookie,
  createAdminSessionToken,
} from "@/lib/server/admin-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
    rememberMe?: boolean;
  };

  const email = body.email?.trim();
  const password = body.password;

  if (!email || !password) {
    return NextResponse.json(
      { success: false, error: "Email and password are required" },
      { status: 400 }
    );
  }

  const result = await authenticateAdminUser(email, password);
  const errorResponse = authLookupToResponse(result);
  if (errorResponse) return errorResponse;

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const token = createAdminSessionToken({
    userId: result.user.id,
    rememberMe: Boolean(body.rememberMe),
  });

  const response = NextResponse.json({
    success: true,
    user: result.user,
    message: "Signed in successfully",
  });
  response.headers.set(
    "Set-Cookie",
    buildAdminSessionSetCookie(token, Boolean(body.rememberMe))
  );
  return response;
}
