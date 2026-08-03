import { NextResponse } from "next/server";

import { ROLES } from "@/constants";
import {
  sendAccountApprovedEmail,
  sendAccountRejectedEmail,
} from "@/lib/server/auth-email-service";
import { findUserById, reviewUserAccount } from "@/lib/server/users-persistence";
import type { RoleName } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json()) as {
    action?: "approve" | "reject";
    role?: RoleName;
  };

  if (!body.action || !["approve", "reject"].includes(body.action)) {
    return NextResponse.json({ error: "Invalid review action" }, { status: 400 });
  }

  const existing = findUserById(id);
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

    const approved = reviewUserAccount(id, "approve", role);
    if (!approved) {
      return NextResponse.json({ error: "Unable to approve account" }, { status: 400 });
    }

    await sendAccountApprovedEmail(approved);

    return NextResponse.json({
      success: true,
      user: approved,
      message: `Account approved. An email was sent to ${approved.email}.`,
    });
  }

  const rejected = reviewUserAccount(id, "reject");
  if (!rejected) {
    return NextResponse.json({ error: "Unable to reject account" }, { status: 400 });
  }

  await sendAccountRejectedEmail(rejected);

  return NextResponse.json({
    success: true,
    user: rejected,
    message: `Account request rejected for ${rejected.email}.`,
  });
}
