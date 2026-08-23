import { NextResponse } from "next/server";

import {
  createRegisteredAdminUser,
  isAdminEmailRegistered,
} from "@/lib/server/admin-user-service";
import { isAdminUserError } from "@/lib/server/admin-user-errors";
import { registerSchema } from "@/lib/auth-validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid registration data",
      },
      { status: 400 }
    );
  }

  if (await isAdminEmailRegistered(parsed.data.email)) {
    return NextResponse.json(
      { success: false, error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  try {
    await createRegisteredAdminUser(parsed.data);
    return NextResponse.json({
      success: true,
      message:
        "Account submitted for approval. You'll receive an email once a superuser approves your access.",
    });
  } catch (error) {
    if (isAdminUserError(error)) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    throw error;
  }
}
