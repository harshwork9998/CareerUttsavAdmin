import { NextResponse } from "next/server";

import { requireSuperuser } from "@/lib/server/admin-auth";
import {
  sendAccountApprovedEmail,
  sendAccountRejectedEmail,
} from "@/lib/server/auth-email-service";
import {
  findAdminUserById,
  reviewAdminUserAccount,
} from "@/lib/server/admin-user-service";
import { isAdminUserError } from "@/lib/server/admin-user-errors";
import { ROLES } from "@/constants";
import type { RoleName } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperuser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = (await request.json()) as {
    action?: "approve" | "reject";
    role?: RoleName;
  };

  if (!body.action || !["approve", "reject"].includes(body.action)) {
    return NextResponse.json({ error: "Invalid review action" }, { status: 400 });
  }

  const existing = await findAdminUserById(id);
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (existing.status !== "Pending Approval") {
    return NextResponse.json(
      { error: "Only pending accounts can be reviewed" },
      { status: 400 }
    );
  }

  if (body.action === "approve") {
    const role = body.role;
    if (!role || !ROLES.includes(role)) {
      return NextResponse.json(
        { error: "A valid role is required to approve an account" },
        { status: 400 }
      );
    }

    try {
      const approved = await reviewAdminUserAccount(id, "approve", role);
      await sendAccountApprovedEmail(approved);
      return NextResponse.json({
        success: true,
        user: approved,
        message: `Account approved. An email was sent to ${approved.email}.`,
      });
    } catch (error) {
      if (isAdminUserError(error)) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }

  try {
    const rejected = await reviewAdminUserAccount(id, "reject");
    await sendAccountRejectedEmail(rejected);
    return NextResponse.json({
      success: true,
      user: rejected,
      message: `Account request rejected for ${rejected.email}.`,
    });
  } catch (error) {
    if (isAdminUserError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
