import { NextResponse } from "next/server";

import { loginBlockedMessage } from "@/lib/access-control";
import { authenticateUser } from "@/lib/server/users-persistence";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
  };

  const email = body.email?.trim();
  const password = body.password;

  if (!email || !password) {
    return NextResponse.json(
      { success: false, error: "Email and password are required" },
      { status: 400 }
    );
  }

  const result = authenticateUser(email, password);

  if (result.ok) {
    return NextResponse.json({
      success: true,
      user: result.user,
      message: "Signed in successfully",
    });
  }

  if (result.reason === "blocked") {
    return NextResponse.json(
      {
        success: false,
        error: loginBlockedMessage(result.status),
      },
      { status: 403 }
    );
  }

  return NextResponse.json(
    { success: false, error: "Invalid email or password" },
    { status: 401 }
  );
}
