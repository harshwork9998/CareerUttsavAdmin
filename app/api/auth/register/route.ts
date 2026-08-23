import { NextResponse } from "next/server";

import {
  createRegisteredAdminUser,
  isAdminEmailRegistered,
} from "@/lib/server/admin-user-service";
import { isAdminUserError } from "@/lib/server/admin-user-errors";
import {
  formatRegisterApiError,
  registerApiSchema,
} from "@/lib/auth-validation";

export const dynamic = "force-dynamic";

const REGISTRATION_SUCCESS_MESSAGE =
  "Account created successfully. Awaiting administrator approval.";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = registerApiSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: formatRegisterApiError(parsed.error),
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
      message: REGISTRATION_SUCCESS_MESSAGE,
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
